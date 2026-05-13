import { IsEnum, IsInt, IsOptional, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PrescriptionStatus } from '@prisma/client';

/**
 * DTO para filtros de paginación en listados de prescripciones.
 *
 * Todos los campos son opcionales (IsOptional).
 * Los valores por defecto evitan necesidad de especificar página 1, límite 10, etc.
 */
export class PaginationFilterDto {
  /** Número de página (1-indexed). Default: 1 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /** Cantidad de items por página. Default: 10 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  /** Filtrar por estado de prescripción */
  @IsOptional()
  @IsEnum(PrescriptionStatus)
  status?: PrescriptionStatus;

  /** Filtrar desde fecha (ISO 8601: YYYY-MM-DD) */
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  /** Filtrar hasta fecha (ISO 8601: YYYY-MM-DD) */
  @IsOptional()
  @IsDateString()
  toDate?: string;
}