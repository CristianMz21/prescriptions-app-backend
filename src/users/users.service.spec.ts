import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
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
        data: {
          email: dto.email,
          passwordHash: 'hashed-password',
          role: dto.role,
        },
      });
      expect(result.id).toEqual(mockUser.id);
      expect(result.email).toEqual(mockUser.email);
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
    it('should find user by id and return UserEntity', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.findById('user-1');
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
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

  describe('findAllByRole', () => {
    it('should find all users by role', async () => {
      prismaService.user.findMany.mockResolvedValue([mockUser]);
      const result = await service.findAllByRole(Role.PATIENT);
      expect(prismaService.user.findMany).toHaveBeenCalledWith({
        where: { role: Role.PATIENT },
      });
      expect(result.length).toBe(1);
      expect(result[0].id).toEqual(mockUser.id);
    });
  });
});
