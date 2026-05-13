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

/**
 * Strict Environment Validation Schema.
 * Guarantees that the application will fast-fail on startup
 * if any required environment variable is missing or malformed.
 */
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
  FRONTEND_URL!: string;
}

export function validate(config: Record<string, unknown>) {
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
