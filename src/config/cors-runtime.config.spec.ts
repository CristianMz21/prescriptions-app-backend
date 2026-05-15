import type { ConfigService } from '@nestjs/config';
import { getCorsRuntimeConfig } from './cors-runtime.config';

describe('cors-runtime.config', () => {
  const buildConfigService = (
    values: Record<string, string | undefined>,
  ): ConfigService => {
    return {
      get: <T = string>(key: string): T | undefined => values[key] as T,
    } as ConfigService;
  };

  it('builds preview rule when all preview env vars exist', () => {
    const configService = buildConfigService({
      APP_ORIGIN: 'https://app.example.com',
      FRONTEND_URL: 'https://frontend.example.com',
      CORS_ADDITIONAL_ORIGINS: 'https://extra.example.com',
      CORS_PREVIEW_PREFIX: 'https://prescriptions-',
      CORS_PREVIEW_REQUIRED_SEGMENT: 'cristians-projects-04637ff3',
      CORS_PREVIEW_SUFFIX: '.vercel.app',
    });

    expect(getCorsRuntimeConfig(configService)).toEqual({
      appOrigin: 'https://app.example.com',
      frontendUrl: 'https://frontend.example.com',
      additionalOrigins: 'https://extra.example.com',
      previewRule: {
        prefix: 'https://prescriptions-',
        requiredSegment: 'cristians-projects-04637ff3',
        suffix: '.vercel.app',
      },
    });
  });

  it('does not build preview rule when values are incomplete', () => {
    const configService = buildConfigService({
      APP_ORIGIN: 'https://app.example.com',
      FRONTEND_URL: 'https://frontend.example.com',
      CORS_PREVIEW_PREFIX: 'https://prescriptions-',
      CORS_PREVIEW_REQUIRED_SEGMENT: 'cristians-projects-04637ff3',
    });

    expect(getCorsRuntimeConfig(configService).previewRule).toBeUndefined();
  });
});
