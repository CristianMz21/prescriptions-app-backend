import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role, ThemePreference, User } from '@prisma/client';
import { UserEntity } from '../users/entities/user.entity';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser: User = {
    id: 'user-1',
    email: 'test@clinic.com',
    passwordHash: 'hashed-password',
    name: 'Test Patient',
    phone: null,
    role: Role.PATIENT,
    themePreference: ThemePreference.SYSTEM,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  const mockUserEntity = new UserEntity(mockUser);

  beforeEach(async () => {
    // Create isolated mocks
    const mockUsersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
    };
    const mockJwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };
    const mockConfigService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'JWT_ACCESS_TTL') return '15m';
        if (key === 'JWT_REFRESH_TTL') return '7d';
        return `mock-${key}`;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user details without passwordHash on successful validation', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.validateUser(
        'test@clinic.com',
        'password123',
      );

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(usersService.findByEmail).toHaveBeenCalledWith('test@clinic.com');
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'password123',
        'hashed-password',
      );
    });

    it('should return null if password does not match', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await authService.validateUser(
        'test@clinic.com',
        'wrong-password',
      );

      expect(result).toBeNull();
    });

    it('should return null if user does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await authService.validateUser(
        'notfound@clinic.com',
        'password123',
      );

      expect(result).toBeNull();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should generate and return access and refresh tokens', async () => {
      jwtService.signAsync
        .mockResolvedValueOnce('mock-access-token')
        .mockResolvedValueOnce('mock-refresh-token');

      const user = {
        id: 'user-1',
        email: 'test@clinic.com',
        role: Role.PATIENT,
      };
      const result = await authService.login(user);

      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });

      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('refresh', () => {
    it('should generate a new access token for a valid refresh token', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });
      usersService.findById.mockResolvedValue(mockUserEntity);
      jwtService.signAsync.mockResolvedValue('new-access-token');

      const result = await authService.refresh('valid-refresh-token');

      expect(result).toEqual({ accessToken: 'new-access-token' });
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(
        'valid-refresh-token',
        {
          secret: 'mock-JWT_REFRESH_SECRET',
        },
      );
      expect(usersService.findById).toHaveBeenCalledWith('user-1');
    });

    it('should throw UnauthorizedException if token verification fails', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await expect(
        authService.refresh('invalid-refresh-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is not found', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });
      usersService.findById.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(authService.refresh('valid-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('config validation', () => {
    it('should throw UnauthorizedException when JWT secret is not a string', async () => {
      configService.getOrThrow.mockImplementationOnce(() => 12345);

      await expect(
        authService.login({
          id: 'u',
          email: 'u@clinic.com',
          role: Role.PATIENT,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when JWT secret is an empty string', async () => {
      configService.getOrThrow.mockImplementationOnce(() => '');

      await expect(
        authService.login({
          id: 'u',
          email: 'u@clinic.com',
          role: Role.PATIENT,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw Error for an invalid TTL format', async () => {
      configService.getOrThrow.mockImplementation((key: string) => {
        if (key === 'JWT_ACCESS_TTL') return 'forever';
        if (key === 'JWT_REFRESH_TTL') return '7d';
        return `mock-${key}`;
      });

      await expect(
        authService.login({
          id: 'u',
          email: 'u@clinic.com',
          role: Role.PATIENT,
        }),
      ).rejects.toThrow(Error);
    });

    it('should parse h and s duration units', async () => {
      configService.getOrThrow.mockImplementation((key: string) => {
        if (key === 'JWT_ACCESS_TTL') return '2h';
        if (key === 'JWT_REFRESH_TTL') return '30s';
        return `mock-${key}`;
      });
      jwtService.signAsync
        .mockResolvedValueOnce('access')
        .mockResolvedValueOnce('refresh');

      const result = await authService.login({
        id: 'u',
        email: 'u@clinic.com',
        role: Role.PATIENT,
      });

      expect(result.accessToken).toBe('access');
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ expiresIn: 2 * 60 * 60 }),
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ expiresIn: 30 }),
      );
    });
  });
});
