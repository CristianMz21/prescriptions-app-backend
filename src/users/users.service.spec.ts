import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: {
    user: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@clinic.com',
    passwordHash: 'hashed-password',
    name: 'Test Patient',
    phone: '+54 11 0000-0000',
    role: Role.PATIENT,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('CreateUserDto contract', () => {
    // Smoke guard: a regression where someone marks `name` as @IsOptional()
    // would silently allow nameless users — and that's banned by the product
    // contract. Keep this test as a sentinel.
    it('rejects payload without name (class-validator)', async () => {
      const dto = plainToInstance(CreateUserDto, {
        email: 'noname@clinic.com',
        password: 'Password123!',
        role: Role.PATIENT,
      });
      const errors = await validate(dto);
      const nameError = errors.find(e => e.property === 'name');
      expect(nameError).toBeDefined();
      expect(nameError?.constraints).toMatchObject({
        isNotEmpty: expect.any(String),
      });
    });

    it('accepts payload with non-empty name', async () => {
      const dto = plainToInstance(CreateUserDto, {
        email: 'withname@clinic.com',
        password: 'Password123!',
        name: 'Has A Name',
        role: Role.PATIENT,
      });
      const errors = await validate(dto);
      expect(errors.find(e => e.property === 'name')).toBeUndefined();
    });
  });

  describe('create', () => {
    it('should hash password and create a user', async () => {
      const dto = {
        email: 'test@clinic.com',
        password: 'password',
        name: 'Test Patient',
        phone: '+54 11 1111-1111',
        role: Role.PATIENT,
      };
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prismaService.user.create.mockResolvedValue(mockUser);

      const result = await service.create(dto);

      expect(bcrypt.hash).toHaveBeenCalledWith('password', 10);
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: dto.email,
          passwordHash: 'hashed-password',
          name: dto.name,
          phone: dto.phone,
          role: dto.role,
          patient: { create: { birthDate: null } },
        }),
      });
      expect(result.id).toEqual(mockUser.id);
      expect(result.email).toEqual(mockUser.email);
    });

    it('should throw ConflictException on P2002 (duplicate email)', async () => {
      const dto = {
        email: 'dupe@clinic.com',
        password: 'pw',
        name: 'Dupe',
        role: Role.PATIENT,
      };
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      const prismaErr = new Error('Unique constraint failed') as Error & {
        code: string;
      };
      prismaErr.code = 'P2002';
      prismaService.user.create.mockRejectedValue(prismaErr);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should rethrow unknown prisma errors', async () => {
      const dto = {
        email: 'other@clinic.com',
        password: 'pw',
        name: 'Other',
        role: Role.PATIENT,
      };
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      prismaService.user.create.mockRejectedValue(new Error('boom'));

      await expect(service.create(dto)).rejects.toThrow('boom');
    });
  });

  describe('updateProfile', () => {
    it('should patch name and phone and return UserEntity', async () => {
      prismaService.user.update.mockResolvedValue(mockUser);
      const result = await service.updateProfile('user-1', {
        name: 'New Name',
        phone: '+54 11 9999-9999',
      });
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { name: 'New Name', phone: '+54 11 9999-9999' },
        include: expect.objectContaining({
          doctor: expect.any(Object),
          patient: expect.any(Object),
        }),
      });
      expect(result.id).toBe(mockUser.id);
    });

    it('should be idempotent when no fields are provided', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.updateProfile('user-1', {});
      expect(prismaService.user.update).not.toHaveBeenCalled();
      expect(result.id).toBe(mockUser.id);
    });

    it('should throw NotFoundException on P2025', async () => {
      const prismaErr = new Error('Record not found') as Error & {
        code: string;
      };
      prismaErr.code = 'P2025';
      prismaService.user.update.mockRejectedValue(prismaErr);
      await expect(
        service.updateProfile('missing', { name: 'X' }),
      ).rejects.toThrow('User not found');
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.findByEmail('test@clinic.com');
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@clinic.com' },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('findById', () => {
    it('should find user by id and return UserEntity with role profile included', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.findById('user-1');
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        include: expect.objectContaining({
          doctor: expect.any(Object),
          patient: expect.any(Object),
        }),
      });
      expect(result).toBeDefined();
      expect(result?.id).toEqual('user-1');
    });

    it('should throw NotFoundException if user not found', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      await expect(service.findById('user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateTheme', () => {
    it('should update themePreference and return UserEntity', async () => {
      prismaService.user.update.mockResolvedValue({
        ...mockUser,
        themePreference: 'DARK',
      });
      const result = await service.updateTheme('user-1', 'DARK');
      expect(prismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { themePreference: 'DARK' },
        }),
      );
      expect(result.id).toEqual('user-1');
    });

    it('should throw NotFoundException on P2025', async () => {
      const err = new Error('not found') as Error & { code: string };
      err.code = 'P2025';
      prismaService.user.update.mockRejectedValue(err);
      await expect(service.updateTheme('missing', 'SYSTEM')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAllByRole', () => {
    it('should find all users by role', async () => {
      prismaService.user.findMany.mockResolvedValue([mockUser]);
      prismaService.user.count.mockResolvedValue(1);
      const result = await service.findAllByRole(Role.PATIENT);
      expect(prismaService.user.findMany).toHaveBeenCalledWith({
        where: { role: Role.PATIENT },
        skip: 0,
        take: 10,
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
      });
      expect(prismaService.user.count).toHaveBeenCalledWith({
        where: { role: Role.PATIENT },
      });
      expect(result.data.length).toBe(1);
      expect(result.data[0].id).toEqual(mockUser.id);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });

    it('should apply doctor specialty + medicalId filters', async () => {
      prismaService.user.findMany.mockResolvedValue([]);
      prismaService.user.count.mockResolvedValue(0);
      await service.findAllByRole(Role.DOCTOR, {
        specialty: 'cardio',
        medicalId: 'MED-1',
      });
      const call = prismaService.user.findMany.mock.calls[0][0];
      expect(call.where).toMatchObject({
        role: Role.DOCTOR,
        doctor: {
          specialty: { contains: 'cardio', mode: 'insensitive' },
          medicalId: { contains: 'MED-1', mode: 'insensitive' },
        },
      });
    });

    it('should apply patient birthDate range filter', async () => {
      prismaService.user.findMany.mockResolvedValue([]);
      prismaService.user.count.mockResolvedValue(0);
      await service.findAllByRole(Role.PATIENT, {
        birthDateFromDate: '1990-01-01',
        birthDateToDate: '2000-12-31',
      });
      const call = prismaService.user.findMany.mock.calls[0][0];
      expect(call.where.patient.birthDate.gte).toBeInstanceOf(Date);
      expect(call.where.patient.birthDate.lte).toBeInstanceOf(Date);
    });

    it('should apply patient minAge/maxAge as birthDate bounds', async () => {
      prismaService.user.findMany.mockResolvedValue([]);
      prismaService.user.count.mockResolvedValue(0);
      await service.findAllByRole(Role.PATIENT, { minAge: 18, maxAge: 65 });
      const call = prismaService.user.findMany.mock.calls[0][0];
      // gte = 65 years ago + 1 (lower bound), lte = 18 years ago (upper bound)
      expect(call.where.patient.birthDate.gte).toBeInstanceOf(Date);
      expect(call.where.patient.birthDate.lte).toBeInstanceOf(Date);
      expect(call.where.patient.birthDate.gte.getTime()).toBeLessThan(
        call.where.patient.birthDate.lte.getTime(),
      );
    });
  });

  describe('findAll (admin generic)', () => {
    it('should accept role override + createdAt range + theme + sort', async () => {
      prismaService.user.findMany.mockResolvedValue([]);
      prismaService.user.count.mockResolvedValue(0);
      await service.findAll({
        role: Role.DOCTOR,
        createdFromDate: '2026-01-01',
        createdToDate: '2026-12-31',
        themePreference: 'DARK' as never,
        q: 'jane',
        sortBy: 'email' as never,
        sortOrder: 'asc' as never,
      });
      const call = prismaService.user.findMany.mock.calls[0][0];
      expect(call.where.role).toBe(Role.DOCTOR);
      // q now matches email OR name (case-insensitive substring)
      expect(call.where.OR).toEqual([
        { email: { contains: 'jane', mode: 'insensitive' } },
        { name: { contains: 'jane', mode: 'insensitive' } },
      ]);
      expect(call.where.createdAt.gte).toBeInstanceOf(Date);
      expect(call.where.createdAt.lte).toBeInstanceOf(Date);
      expect(call.where.themePreference).toBe('DARK');
      expect(call.orderBy).toEqual({ email: 'asc' });
    });
  });
});
