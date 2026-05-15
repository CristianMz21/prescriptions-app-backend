import 'reflect-metadata';
import { validate } from './env.validation';

const baseConfig = {
  NODE_ENV: 'development',
  PORT: '3000',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_ACCESS_SECRET: 'access-secret',
  JWT_REFRESH_SECRET: 'refresh-secret',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '7d',
  CORS_PREVIEW_PREFIX: 'https://prescriptions-',
  CORS_PREVIEW_REQUIRED_SEGMENT: 'cristians-projects-04637ff3',
  CORS_PREVIEW_SUFFIX: '.vercel.app',
};

describe('env.validation', () => {
  it('throws when APP_ORIGIN and FRONTEND_URL are both missing', () => {
    expect(() => validate(baseConfig)).toThrow(
      'Environment validation failed: At least one of APP_ORIGIN or FRONTEND_URL must be provided',
    );
  });

  it('throws when APP_ORIGIN lacks protocol', () => {
    expect(() =>
      validate({
        ...baseConfig,
        APP_ORIGIN: 'prescriptions-app-eight.vercel.app',
      }),
    ).toThrow(
      'Environment validation failed: APP_ORIGIN must start with http:// or https://',
    );
  });

  it('accepts valid APP_ORIGIN and FRONTEND_URL and normalizes values', () => {
    const result = validate({
      ...baseConfig,
      APP_ORIGIN: 'https://prescriptions-app-eight.vercel.app/some/path',
      FRONTEND_URL: 'http://localhost:3001',
    });

    expect(result.APP_ORIGIN).toBe(
      'https://prescriptions-app-eight.vercel.app',
    );
    expect(result.FRONTEND_URL).toBe('http://localhost:3001');
  });

  it('throws when CORS_PREVIEW_PREFIX is not https', () => {
    expect(() =>
      validate({
        ...baseConfig,
        APP_ORIGIN: 'https://prescriptions-app-eight.vercel.app',
        CORS_PREVIEW_PREFIX: 'http://prescriptions-',
      }),
    ).toThrow(
      'Environment validation failed: CORS_PREVIEW_PREFIX must start with https://',
    );
  });

  it('throws when preview rule env vars are partially provided', () => {
    expect(() =>
      validate({
        ...baseConfig,
        APP_ORIGIN: 'https://prescriptions-app-eight.vercel.app',
        CORS_PREVIEW_PREFIX: 'https://prescriptions-',
        CORS_PREVIEW_REQUIRED_SEGMENT: undefined,
        CORS_PREVIEW_SUFFIX: undefined,
      }),
    ).toThrow(
      'Environment validation failed: CORS_PREVIEW_PREFIX, CORS_PREVIEW_REQUIRED_SEGMENT and CORS_PREVIEW_SUFFIX must be provided together',
    );
  });

  it('throws when class-validator detects invalid enum values', () => {
    expect(() =>
      validate({
        ...baseConfig,
        APP_ORIGIN: 'https://prescriptions-app-eight.vercel.app',
        NODE_ENV: 'prod',
      }),
    ).toThrow('Environment validation failed:');
  });
});
