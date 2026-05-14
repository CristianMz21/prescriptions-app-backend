/* Copyright (c) 2026. All rights reserved. */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';

export class AdminMetricsDto {
  @ApiPropertyOptional({
    description: 'Start date for filtering metrics (ISO 8601 date string)',
    example: '2026-01-01',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'End date for filtering metrics (ISO 8601 date string)',
    example: '2026-01-31',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
