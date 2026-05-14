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
