/* Copyright (c) 2026. All rights reserved. */
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Role, Prisma, ThemePreference } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { hash } from 'bcrypt';
import { UserEntity } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserListQueryDto, UserSortBy } from './dto/user-list-query.dto';
import { DoctorListQueryDto } from './dto/doctor-list-query.dto';
import { PatientListQueryDto } from './dto/patient-list-query.dto';
import {
  caseInsensitiveContains,
  dateRangeFilter,
  toPrismaSort,
  yearsAgo,
} from '../common/utils/filter.utils';

const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private buildDoctorCreate(
    dto: CreateUserDto,
  ): Prisma.DoctorCreateNestedOneWithoutUserInput | undefined {
    if (dto.role !== Role.DOCTOR) {
      return undefined;
    }
    return {
      create: {
        specialty: dto.specialty,
        medicalId: dto.medicalId,
        signatureText: dto.signatureText,
        signatureImageUrl: dto.signatureImageUrl,
      },
    };
  }

  private parseBirthDate(value: string | undefined): Date | null {
    if (!value) {
      return null;
    }
    return new Date(value);
  }

  private buildPatientCreate(
    dto: CreateUserDto,
  ): Prisma.PatientCreateNestedOneWithoutUserInput | undefined {
    if (dto.role !== Role.PATIENT) {
      return undefined;
    }
    return {
      create: {
        birthDate: this.parseBirthDate(dto.birthDate),
      },
    };
  }

  /**
   * Creates a new user with enterprise-grade password hashing.
   */
  async create(createUserDto: CreateUserDto): Promise<UserEntity> {
    const hashedPassword = await hash(
      createUserDto.password,
      BCRYPT_SALT_ROUNDS,
    );

    try {
      const user = await this.prisma.user.create({
        data: {
          email: createUserDto.email,
          passwordHash: hashedPassword,
          name: createUserDto.name,
          phone: createUserDto.phone,
          role: createUserDto.role,
          doctor: this.buildDoctorCreate(createUserDto),
          patient: this.buildPatientCreate(createUserDto),
        },
      });
      return new UserEntity(user);
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException('A user with this email already exists');
      }
      throw err;
    }
  }

  /**
   * Internal Use Only: Fetches a user by email for the Auth workflow.
   * This method intentionally returns the raw Prisma object (including passwordHash)
   * because AuthService needs the hash to perform bcrypt.compare().
   */
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Public/Profile Use: Fetches a user by ID.
   * Crucially returns an instantiated UserEntity. When this hits a controller
   * using ClassSerializerInterceptor, the passwordHash is automatically stripped.
   */
  async findById(id: string): Promise<UserEntity> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        doctor: {
          select: {
            id: true,
            specialty: true,
            medicalId: true,
            signatureText: true,
            signatureImageUrl: true,
          },
        },
        patient: {
          select: {
            id: true,
            birthDate: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return new UserEntity(user);
  }

  async findAll(query: UserListQueryDto = {}): Promise<{
    data: UserEntity[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    // On the generic /users endpoint admins MAY filter by role via the query.
    const baseWhere: Prisma.UserWhereInput = {};
    if (query.role) baseWhere.role = query.role;
    return this.findUsersPaginated(baseWhere, query);
  }

  /**
   * Directory Use: Lists users by role, instantiated as secure UserEntities.
   */
  async updateTheme(
    userId: string,
    themePreference: ThemePreference,
  ): Promise<UserEntity> {
    return this.updateAndIncludeProfiles(userId, { themePreference });
  }

  /**
   * Internal helper: runs prisma.user.update with the canonical doctor/patient
   * include and translates Prisma's P2025 (record-not-found) into a domain
   * NotFoundException. Centralized to avoid duplicating the include block +
   * error mapping across `updateTheme` and `updateProfile`.
   */
  private async updateAndIncludeProfiles(
    userId: string,
    data: Prisma.UserUpdateInput,
  ): Promise<UserEntity> {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data,
        include: {
          doctor: {
            select: {
              id: true,
              specialty: true,
              medicalId: true,
              signatureText: true,
              signatureImageUrl: true,
            },
          },
          patient: { select: { id: true, birthDate: true } },
        },
      });
      return new UserEntity(user);
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        'code' in err &&
        (err as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundException('User not found');
      }
      throw err;
    }
  }

  async findAllByRole(
    role: Role,
    query: UserListQueryDto | DoctorListQueryDto | PatientListQueryDto = {},
  ): Promise<{
    data: UserEntity[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    // Role is fixed by the endpoint; ignore any role override on the DTO.
    const baseWhere: Prisma.UserWhereInput = { role };

    if (role === Role.DOCTOR) {
      const dto = query as DoctorListQueryDto;
      const specialtyFilter = caseInsensitiveContains(dto.specialty);
      const medicalIdFilter = caseInsensitiveContains(dto.medicalId);
      if (specialtyFilter || medicalIdFilter) {
        baseWhere.doctor = {
          ...(specialtyFilter ? { specialty: specialtyFilter } : {}),
          ...(medicalIdFilter ? { medicalId: medicalIdFilter } : {}),
        };
      }
    }

    if (role === Role.PATIENT) {
      const dto = query as PatientListQueryDto;
      // Combine explicit birthDate range with min/max age (also a birthDate range).
      const explicit = dateRangeFilter(
        dto.birthDateFromDate,
        dto.birthDateToDate,
      );
      const ageRange =
        dto.minAge !== undefined || dto.maxAge !== undefined
          ? {
              ...(dto.maxAge !== undefined
                ? { gte: yearsAgo(dto.maxAge + 1) }
                : {}),
              ...(dto.minAge !== undefined
                ? { lte: yearsAgo(dto.minAge) }
                : {}),
            }
          : undefined;
      const merged: Prisma.DateTimeFilter = {
        ...(explicit ?? {}),
        ...(ageRange ?? {}),
      };
      if (Object.keys(merged).length > 0) {
        baseWhere.patient = { birthDate: merged };
      }
    }

    return this.findUsersPaginated(baseWhere, query);
  }

  /**
   * Patches the authenticated user's own profile (name/phone). No role/email/password
   * mutation here — those flow through admin endpoints or a dedicated password route.
   */
  async updateProfile(userId: string, dto: UpdateUserDto): Promise<UserEntity> {
    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.phone !== undefined) data.phone = dto.phone;

    if (Object.keys(data).length === 0) {
      // Idempotent: return current state without hitting the writer.
      return this.findById(userId);
    }

    return this.updateAndIncludeProfiles(userId, data);
  }

  private async findUsersPaginated(
    where: Prisma.UserWhereInput,
    query: UserListQueryDto,
  ): Promise<{
    data: UserEntity[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const {
      page = 1,
      limit = 10,
      q,
      createdFromDate,
      createdToDate,
      themePreference,
      sortBy = UserSortBy.CreatedAt,
      sortOrder,
    } = query;
    const skip = (page - 1) * limit;

    const qFilter = caseInsensitiveContains(q);
    const createdAtFilter = dateRangeFilter(createdFromDate, createdToDate);

    const composedWhere: Prisma.UserWhereInput = { ...where };
    if (qFilter) {
      // Top-level OR is AND-combined with the rest of the where clause by Prisma.
      composedWhere.OR = [{ email: qFilter }, { name: qFilter }];
    }
    if (createdAtFilter) composedWhere.createdAt = createdAtFilter;
    if (themePreference) composedWhere.themePreference = themePreference;

    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [sortBy]: toPrismaSort(sortOrder),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: composedWhere,
        skip,
        take: limit,
        orderBy,
        include: {
          patient: { select: { id: true, birthDate: true } },
          doctor: {
            select: {
              id: true,
              specialty: true,
              medicalId: true,
              signatureText: true,
              signatureImageUrl: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where: composedWhere }),
    ]);

    return {
      data: users.map(user => new UserEntity(user)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
