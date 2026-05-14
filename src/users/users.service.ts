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
import { UserListQueryDto } from './dto/user-list-query.dto';

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
    return this.findUsersPaginated({}, query);
  }

  /**
   * Directory Use: Lists users by role, instantiated as secure UserEntities.
   */
  async updateTheme(
    userId: string,
    themePreference: ThemePreference,
  ): Promise<UserEntity> {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { themePreference },
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
    query: UserListQueryDto = {},
  ): Promise<{
    data: UserEntity[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    return this.findUsersPaginated({ role }, query);
  }

  private async findUsersPaginated(
    where: Prisma.UserWhereInput,
    query: UserListQueryDto,
  ): Promise<{
    data: UserEntity[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const { page = 1, limit = 10, q } = query;
    const normalizedQuery = q?.trim();
    const skip = (page - 1) * limit;

    const emailFilter =
      normalizedQuery && normalizedQuery.length > 0
        ? { email: { contains: normalizedQuery, mode: 'insensitive' as const } }
        : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { ...where, ...emailFilter },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
      this.prisma.user.count({ where: { ...where, ...emailFilter } }),
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
