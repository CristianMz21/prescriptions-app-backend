import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy, cookieExtractor } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';

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
      const req = { cookies: { accessToken: 'token' } };
      expect(cookieExtractor(req as unknown as Request)).toBe('token');
    });

    it('should return undefined if no cookie', () => {
      const req = { cookies: {} };
      expect(cookieExtractor(req as unknown as Request)).toBeNull();
    });
  });

  describe('validate', () => {
    it('should validate and return user payload', () => {
      const payload = {
        sub: 'user-1',
        email: 'test@c.com',
        role: Role.PATIENT,
      };
      const result = strategy.validate(payload);
      expect(result).toEqual({
        id: 'user-1',
        email: 'test@c.com',
        role: 'PATIENT',
      });
    });

    it('should throw if payload missing sub', () => {
      const payload = { sub: '', email: 'test@c.com', role: Role.PATIENT };
      expect(() => strategy.validate(payload)).toThrow(UnauthorizedException);
    });
  });
});
