/* Copyright (c) 2026. All rights reserved. */
import { PrescriptionStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { SEARCH_QUERY_MAX_LENGTH } from '../../common/constants';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsDateString,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminListPrescriptionsDto {
  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    default: 1,
    minimum: 1,
    type: Number,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 10,
    minimum: 1,
    type: Number,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by prescription status',
    enum: PrescriptionStatus,
    enumName: 'PrescriptionStatus',
    example: 'PENDING',
  })
  @IsOptional()
  @IsEnum(PrescriptionStatus)
  status?: PrescriptionStatus;

  @ApiPropertyOptional({
    description: 'Filter by author UUID (Doctor.id)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  authorId?: string;

  @ApiPropertyOptional({
    description: 'Filter by patient UUID (Patient.id)',
    example: '456e7890-e89b-12d3-a456-426614174001',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional({
    description:
      'Filter prescriptions created on or after this date (ISO 8601)',
    example: '2026-01-01',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description:
      'Filter prescriptions created on or before this date (ISO 8601)',
    example: '2026-01-31',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description:
      'Free-text query. Case-insensitive substring match against prescription notes and item names.',
    example: 'amoxi',
    maxLength: SEARCH_QUERY_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(SEARCH_QUERY_MAX_LENGTH)
  q?: string;
}
