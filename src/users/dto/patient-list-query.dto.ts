/* Copyright (c) 2026. All rights reserved. */
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserListQueryDto } from './user-list-query.dto';

/**
 * Patient-list-specific filters layered on top of `UserListQueryDto`.
 * Only meaningful for GET /users/patients.
 */
export class PatientListQueryDto extends UserListQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by patient.birthDate >= birthDateFromDate (ISO 8601).',
    example: '1960-01-01',
  })
  @IsOptional()
  @IsDateString()
  birthDateFromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by patient.birthDate <= birthDateToDate (ISO 8601).',
    example: '2010-12-31',
  })
  @IsOptional()
  @IsDateString()
  birthDateToDate?: string;

  @ApiPropertyOptional({
    description:
      'Lower bound on patient age in years (inclusive). Computed naively as today minus N years.',
    example: 18,
    minimum: 0,
    maximum: 150,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(150)
  minAge?: number;

  @ApiPropertyOptional({
    description:
      'Upper bound on patient age in years (inclusive). Computed naively as today minus N years.',
    example: 65,
    minimum: 0,
    maximum: 150,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(150)
  maxAge?: number;
}
