/* Copyright (c) 2026. All rights reserved. */
import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from './pagination-meta.dto';

export class PaginatedResultDto<T> {
  @ApiProperty({ isArray: true })
  data!: T[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
