/* Copyright (c) 2026. All rights reserved. */
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Whitelist of sort directions accepted across all list endpoints.
 * `class-validator` enforces this enum at the DTO level so unknown
 * values return 400 (and never reach Prisma).
 */
export enum SortOrder {
  Asc = 'asc',
  Desc = 'desc',
}

/**
 * Base shape every paginated list endpoint extends. Subclasses add their
 * own `sortBy` field with an endpoint-specific enum (whitelist) plus any
 * filter-specific fields.
 */
export class BaseListQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (1-indexed).',
    default: 1,
    minimum: 1,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page (capped at 100 to bound DB cost).',
    default: 10,
    minimum: 1,
    maximum: 100,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Sort direction.',
    enum: SortOrder,
    enumName: 'SortOrder',
    default: SortOrder.Desc,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.Desc;
}
