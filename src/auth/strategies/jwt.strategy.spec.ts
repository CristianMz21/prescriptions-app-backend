import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy, cookieExtractor } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const mockConfigService = {
      getOrThrow: jest.fn().mockReturnValue('secret'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  describe('cookieExtractor', () => {
    it('should extract token from cookie', () => {
      const req = { cookies: { accessToken: 'token' } } as any;
      expect(cookieExtractor(req)).toBe('token');
    });

    it('should return undefined if no cookie', () => {
      const req = { cookies: {} } as any;
      expect(cookieExtractor(req)).toBeUndefined();
    });
  });

  describe('validate', () => {
    it('should validate and return user payload', async () => {
      const payload = { sub: 'user-1', email: 'test@c.com', role: 'PATIENT' };
      const result = await strategy.validate(payload);
      expect(result).toEqual({ id: 'user-1', email: 'test@c.com', role: 'PATIENT' });
    });

    it('should throw if payload missing sub', async () => {
      const payload = { email: 'test@c.com', role: 'PATIENT' };
      await expect(strategy.validate(payload as any)).rejects.toThrow(UnauthorizedException);
    });
  });
});
