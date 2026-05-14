/* Copyright (c) 2026. All rights reserved. */
import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ example: 1, description: 'Current page number (1-indexed)' })
  page!: number;

  @ApiProperty({ example: 10, description: 'Number of items per page' })
  limit!: number;

  @ApiProperty({
    example: 42,
    description: 'Total number of items across all pages',
  })
  total!: number;

  @ApiProperty({ example: 5, description: 'Total number of pages' })
  totalPages!: number;
}
