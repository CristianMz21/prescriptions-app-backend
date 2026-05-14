/* Copyright (c) 2026. All rights reserved. */
import { IsEnum, IsInt, IsOptional, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PrescriptionStatus } from '@prisma/client';

/**
 * DTO para filtros de paginación en listados de prescripciones.
 *
 * Todos los campos son opcionales (IsOptional).
 * Los valores por defecto evitan necesidad de especificar página 1, límite 10, etc.
 */
export class PaginationFilterDto {
  @ApiPropertyOptional({
    description: 'Número de página (1-indexed).',
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
    description: 'Cantidad de items por página.',
    default: 10,
    minimum: 1,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filtrar por estado de prescripción.',
    enum: PrescriptionStatus,
  })
  @IsOptional()
  @IsEnum(PrescriptionStatus)
  status?: PrescriptionStatus;

  @ApiPropertyOptional({
    description: 'Filtrar desde fecha (ISO 8601).',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filtrar hasta fecha (ISO 8601).',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
