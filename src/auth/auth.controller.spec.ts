import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { UnauthorizedException } from '@nestjs/common';
import { Role, ThemePreference } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { UserEntity } from '../users/entities/user.entity';

interface ResponseMocks {
  res: Response;
  cookieMock: jest.Mock;
  clearCookieMock: jest.Mock;
}

const buildResponseMocks = (): ResponseMocks => {
  const cookieMock = jest.fn();
  const clearCookieMock = jest.fn();
  // Express Response has dozens of fields; this test exercises only `cookie`
  // and `clearCookie`. The intermediate `unknown` cast is the standard TS
  // idiom for typed test doubles without pulling in jest-mock-extended.
  const res = {
    cookie: cookieMock,
    clearCookie: clearCookieMock,
  } as unknown as Response;
  return { res, cookieMock, clearCookieMock };
};

const buildRequestMock = (cookies: Record<string, string>): Request =>
  ({ cookies }) as unknown as Request;

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let usersService: jest.Mocked<UsersService>;

  const mockUser = {
    id: 'user-1',
    email: 'test@clinic.com',
    role: Role.PATIENT,
  };

  beforeEach(async () => {
    const mockAuthService = {
      validateUser: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
    };

    const mockUsersService = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: UsersService, useValue: mockUsersService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn<string | undefined, [string]>(),
            getOrThrow: jest.fn<string, [string]>((key: string) => {
              if (key === 'JWT_ACCESS_TTL') return '15m';
              if (key === 'JWT_REFRESH_TTL') return '7d';
              if (key === 'NODE_ENV') return 'development';
              return 'mock-secret';
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
    usersService = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should set cookies and return user info on success', async () => {
      const loginDto = { email: 'test@clinic.com', password: 'password123' };
      const { res, cookieMock } = buildResponseMocks();

      authService.validateUser.mockResolvedValue(mockUser);
      authService.login.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: mockUser,
      });

      const result = await controller.login(loginDto, res);

      expect(authService.validateUser).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password,
      );
      expect(authService.login).toHaveBeenCalledWith(mockUser);
      expect(cookieMock).toHaveBeenCalledTimes(2);
      expect(cookieMock).toHaveBeenCalledWith(
        'accessToken',
        'access-token',
        expect.any(Object),
      );
      expect(cookieMock).toHaveBeenCalledWith(
        'refreshToken',
        'refresh-token',
        expect.any(Object),
      );
      expect(result).toEqual({ message: 'Login successful', user: mockUser });
    });

    it('should throw UnauthorizedException if validation fails', async () => {
      const loginDto = { email: 'test@clinic.com', password: 'wrong' };
      const { res } = buildResponseMocks();

      authService.validateUser.mockResolvedValue(null);

      await expect(controller.login(loginDto, res)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refresh', () => {
    it('should set new access token cookie and return success message', async () => {
      const req = buildRequestMock({ refreshToken: 'valid-refresh-token' });
      const { res, cookieMock } = buildResponseMocks();

      authService.refresh.mockResolvedValue({
        accessToken: 'new-access-token',
      });

      const result = await controller.refresh(req, res);

      expect(authService.refresh).toHaveBeenCalledWith('valid-refresh-token');
      expect(cookieMock).toHaveBeenCalledTimes(1);
      expect(cookieMock).toHaveBeenCalledWith(
        'accessToken',
        'new-access-token',
        expect.any(Object),
      );
      expect(result).toEqual({ message: 'Token refreshed' });
    });

    it('should throw UnauthorizedException if refresh token is missing', async () => {
      const req = buildRequestMock({});
      const { res } = buildResponseMocks();

      await expect(controller.refresh(req, res)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if refresh service throws', async () => {
      const req = buildRequestMock({ refreshToken: 'invalid-refresh-token' });
      const { res } = buildResponseMocks();

      authService.refresh.mockRejectedValue(new UnauthorizedException());

      await expect(controller.refresh(req, res)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should clear cookies and return success message', () => {
      const { res, clearCookieMock } = buildResponseMocks();

      const result = controller.logout(res);

      expect(clearCookieMock).toHaveBeenCalledTimes(2);
      expect(clearCookieMock).toHaveBeenCalledWith('accessToken');
      expect(clearCookieMock).toHaveBeenCalledWith('refreshToken', {
        path: '/auth/refresh',
      });
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  describe('getProfile', () => {
    it('should return the user profile from the database', async () => {
      const requestUser = {
        id: 'user-1',
        email: 'test@clinic.com',
        role: Role.PATIENT,
      };
      const fullUserEntity = new UserEntity({
        ...requestUser,
        name: 'Test Patient',
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordHash: 'hash',
        themePreference: ThemePreference.SYSTEM,
      });

      usersService.findById.mockResolvedValue(fullUserEntity);

      const result = await controller.getProfile(requestUser);

      expect(usersService.findById).toHaveBeenCalledWith(requestUser.id);
      expect(result).toEqual(fullUserEntity);
    });
  });
});
