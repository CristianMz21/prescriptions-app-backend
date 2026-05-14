import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
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

  describe('create', () => {
    it('should hash password and create a user', async () => {
      const dto = {
        email: 'test@clinic.com',
        password: 'password',
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
        role: Role.PATIENT,
      };
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      prismaService.user.create.mockRejectedValue(new Error('boom'));

      await expect(service.create(dto)).rejects.toThrow('boom');
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
  });
});
