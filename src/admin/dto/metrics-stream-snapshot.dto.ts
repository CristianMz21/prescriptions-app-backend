/* Copyright (c) 2026. All rights reserved. */
import { ApiProperty } from '@nestjs/swagger';
import { MetricsTotalsDto, MetricsByStatusDto } from './metrics-response.dto';

export class MetricsStreamSnapshotDto {
  @ApiProperty({
    type: () => MetricsTotalsDto,
    description: 'Aggregate counts',
  })
  totals!: MetricsTotalsDto;

  @ApiProperty({
    type: () => MetricsByStatusDto,
    description: 'Prescription counts by status',
  })
  byStatus!: MetricsByStatusDto;

  @ApiProperty({
    example: '2026-05-13T10:30:00.000Z',
    format: 'date-time',
    description: 'ISO 8601 timestamp of the snapshot',
  })
  timestamp!: string;
}
