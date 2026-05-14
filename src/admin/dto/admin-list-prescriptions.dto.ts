/* Copyright (c) 2026. All rights reserved. */
import { PrescriptionStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { SEARCH_QUERY_MAX_LENGTH } from '../../common/constants';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { BaseListQueryDto } from '../../common/dto/list-query.dto';
import { PrescriptionSortBy } from '../../prescriptions/dto/pagination-filter.dto';

/**
 * Admin-only filters for GET /admin/prescriptions. Inherits page/limit/sortOrder
 * from BaseListQueryDto. Date params are `fromDate`/`toDate` to mirror
 * the public endpoint (renamed from the legacy `from`/`to` — breaking).
 */
export class AdminListPrescriptionsDto extends BaseListQueryDto {
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
    description: 'Filter by author identifier — Doctor.id or related User.id.',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  authorId?: string;

  @ApiPropertyOptional({
    description:
      'Filter by patient identifier — Patient.id or related User.id.',
    example: '456e7890-e89b-12d3-a456-426614174001',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional({
    description: 'Filter by createdAt >= fromDate (ISO 8601).',
    example: '2026-01-01',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by createdAt <= toDate (ISO 8601).',
    example: '2026-01-31',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by consumedAt >= consumedFromDate (ISO 8601).',
    example: '2026-03-01',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  consumedFromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by consumedAt <= consumedToDate (ISO 8601).',
    example: '2026-03-31',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  consumedToDate?: string;

  @ApiPropertyOptional({
    description:
      'Match case-insensitive substring against Prescription.code (e.g. "RX-AB").',
    example: 'RX-AB',
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @ApiPropertyOptional({
    description:
      'Filter by presence of notes. true → notes IS NOT NULL; false → notes IS NULL.',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  hasNotes?: boolean;

  @ApiPropertyOptional({
    description: 'Substring match (case-insensitive) on patient.user.email.',
    example: 'jane@clinic.com',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  patientEmail?: string;

  @ApiPropertyOptional({
    description: 'Substring match (case-insensitive) on author.user.email.',
    example: 'doctor@clinic.com',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  doctorEmail?: string;

  @ApiPropertyOptional({
    description:
      'Free-text query. Case-insensitive substring against prescription notes and item names.',
    example: 'amoxi',
    maxLength: SEARCH_QUERY_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(SEARCH_QUERY_MAX_LENGTH)
  q?: string;

  @ApiPropertyOptional({
    description: 'Field to sort by (whitelist).',
    enum: PrescriptionSortBy,
    enumName: 'PrescriptionSortBy',
    default: PrescriptionSortBy.CreatedAt,
  })
  @IsOptional()
  @IsEnum(PrescriptionSortBy)
  sortBy?: PrescriptionSortBy = PrescriptionSortBy.CreatedAt;
}
