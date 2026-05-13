import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let usersService: jest.Mocked<UsersService>;

  const mockUser = {
    id: 'user-1',
    email: 'test@clinic.com',
    role: Role.PATIENT,
  };

  const mockResponse = () => {
    const res: any = {};
    res.cookie = jest.fn();
    res.clearCookie = jest.fn();
    return res;
  };

  const mockRequest = (cookies: any) => {
    return { cookies } as any;
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
          useValue: { getOrThrow: jest.fn().mockReturnValue('test') },
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
      const res = mockResponse();

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
      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(res.cookie).toHaveBeenCalledWith(
        'accessToken',
        'access-token',
        expect.any(Object),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh-token',
        expect.any(Object),
      );
      expect(result).toEqual({ message: 'Login successful', user: mockUser });
    });

    it('should throw UnauthorizedException if validation fails', async () => {
      const loginDto = { email: 'test@clinic.com', password: 'wrong' };
      const res = mockResponse();

      authService.validateUser.mockResolvedValue(null);

      await expect(controller.login(loginDto, res)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refresh', () => {
    it('should set new access token cookie and return success message', async () => {
      const req = mockRequest({ refreshToken: 'valid-refresh-token' });
      const res = mockResponse();

      authService.refresh.mockResolvedValue({
        accessToken: 'new-access-token',
      });

      const result = await controller.refresh(req, res);

      expect(authService.refresh).toHaveBeenCalledWith('valid-refresh-token');
      expect(res.cookie).toHaveBeenCalledTimes(1);
      expect(res.cookie).toHaveBeenCalledWith(
        'accessToken',
        'new-access-token',
        expect.any(Object),
      );
      expect(result).toEqual({ message: 'Token refreshed' });
    });

    it('should throw UnauthorizedException if refresh token is missing', async () => {
      const req = mockRequest({});
      const res = mockResponse();

      await expect(controller.refresh(req, res)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if refresh service throws', async () => {
      const req = mockRequest({ refreshToken: 'invalid-refresh-token' });
      const res = mockResponse();

      authService.refresh.mockRejectedValue(new UnauthorizedException());

      await expect(controller.refresh(req, res)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should clear cookies and return success message', () => {
      const res = mockResponse();

      const result = controller.logout(res);

      expect(res.clearCookie).toHaveBeenCalledTimes(2);
      expect(res.clearCookie).toHaveBeenCalledWith('accessToken');
      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', {
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
      const fullUserEntity = {
        ...requestUser,
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordHash: 'hash',
      };

      usersService.findById.mockResolvedValue(fullUserEntity);

      const result = await controller.getProfile(requestUser);

      expect(usersService.findById).toHaveBeenCalledWith(requestUser.id);
      expect(result).toEqual(fullUserEntity);
    });
  });
});
