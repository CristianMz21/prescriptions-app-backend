/* Copyright (c) 2026. All rights reserved. */
import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsString,
  IsUrl,
  validateSync,
  IsOptional,
} from 'class-validator';
import { normalizeConfiguredOrigin } from './cors.config';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  PORT: number = 3000;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  JWT_ACCESS_TTL!: string;

  @IsString()
  JWT_REFRESH_TTL!: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  APP_ORIGIN?: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  FRONTEND_URL?: string;

  @IsString()
  @IsOptional()
  CORS_ADDITIONAL_ORIGINS?: string;

  @IsString()
  CORS_PREVIEW_PREFIX!: string;

  @IsString()
  CORS_PREVIEW_REQUIRED_SEGMENT!: string;

  @IsString()
  CORS_PREVIEW_SUFFIX!: string;

  @IsString()
  @IsOptional()
  SMTP_HOST?: string;

  @IsString()
  @IsOptional()
  SMTP_PORT?: string;

  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @IsOptional()
  SMTP_PASS?: string;

  @IsString()
  @IsOptional()
  SMTP_FROM?: string;
}

export function validate(config: Record<string, unknown>) {
  if (!config['APP_ORIGIN'] && !config['FRONTEND_URL']) {
    throw new Error(
      'Environment validation failed: At least one of APP_ORIGIN or FRONTEND_URL must be provided',
    );
  }

  const stringToNumberConfig: Record<string, unknown> = { ...config };
  if (stringToNumberConfig['PORT'] !== undefined) {
    stringToNumberConfig['PORT'] = Number(stringToNumberConfig['PORT']);
  }

  const appOriginValue = stringToNumberConfig['APP_ORIGIN'];
  const frontendUrlValue = stringToNumberConfig['FRONTEND_URL'];
  if (typeof appOriginValue === 'string') {
    stringToNumberConfig['APP_ORIGIN'] = normalizeConfiguredOrigin(
      'APP_ORIGIN',
      appOriginValue,
    );
  }
  if (typeof frontendUrlValue === 'string') {
    stringToNumberConfig['FRONTEND_URL'] = normalizeConfiguredOrigin(
      'FRONTEND_URL',
      frontendUrlValue,
    );
  }
  const previewPrefix = stringToNumberConfig['CORS_PREVIEW_PREFIX'];
  if (
    typeof previewPrefix === 'string' &&
    !previewPrefix.startsWith('https://')
  ) {
    throw new Error(
      'Environment validation failed: CORS_PREVIEW_PREFIX must start with https://',
    );
  }

  const validatedConfig = plainToInstance(
    EnvironmentVariables,
    stringToNumberConfig,
    {
      enableImplicitConversion: true,
    },
  );

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(`Environment validation failed: ${errors.toString()}`);
  }

  return validatedConfig;
}
