/* Copyright (c) 2026. All rights reserved. */
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PrescriptionStatus } from '@prisma/client';
import { SEARCH_QUERY_MAX_LENGTH } from '../../common/constants';
import { BaseListQueryDto } from '../../common/dto/list-query.dto';

/**
 * Whitelist of fields the prescription list endpoint accepts as `sortBy`.
 * Validated by class-validator's @IsEnum so unknown values return 400.
 */
export enum PrescriptionSortBy {
  CreatedAt = 'createdAt',
  ConsumedAt = 'consumedAt',
  Code = 'code',
  Status = 'status',
}

/**
 * Filters/sort/pagination accepted by GET /prescriptions.
 * Role-scoped tenant boundary still applies — patientId/authorId overrides
 * are silently ignored when the caller is the resource owner role.
 */
export class PaginationFilterDto extends BaseListQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por estado de prescripción.',
    enum: PrescriptionStatus,
  })
  @IsOptional()
  @IsEnum(PrescriptionStatus)
  status?: PrescriptionStatus;

  @ApiPropertyOptional({
    description: 'Filtrar por createdAt >= fromDate (ISO 8601).',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por createdAt <= toDate (ISO 8601).',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por consumedAt >= consumedFromDate (ISO 8601).',
    example: '2026-03-01',
  })
  @IsOptional()
  @IsDateString()
  consumedFromDate?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por consumedAt <= consumedToDate (ISO 8601).',
    example: '2026-03-31',
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
      'Filter by patient. Accepts either Patient.id or the related User.id (server resolves either form). Ignored when caller role is PATIENT (tenant boundary).',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional({
    description:
      'Filter by doctor (author). Accepts either Doctor.id or the related User.id. Ignored when caller role is DOCTOR (tenant boundary).',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  authorId?: string;

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
