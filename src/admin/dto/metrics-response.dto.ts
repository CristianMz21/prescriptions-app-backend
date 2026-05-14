/* Copyright (c) 2026. All rights reserved. */
import { ApiProperty } from '@nestjs/swagger';

export class MetricsTotalsDto {
  @ApiProperty({ example: 5, description: 'Total number of doctors' })
  doctors!: number;

  @ApiProperty({ example: 20, description: 'Total number of patients' })
  patients!: number;

  @ApiProperty({ example: 100, description: 'Total number of prescriptions' })
  prescriptions!: number;
}

export class MetricsByStatusDto {
  @ApiProperty({ example: 60, description: 'Number of pending prescriptions' })
  pending!: number;

  @ApiProperty({ example: 40, description: 'Number of consumed prescriptions' })
  consumed!: number;
}

export class MetricsByDayItemDto {
  @ApiProperty({
    example: '2026-01-15',
    description: 'Date string (YYYY-MM-DD)',
  })
  date!: string;

  @ApiProperty({
    example: 12,
    description: 'Number of prescriptions created on this day',
  })
  count!: number;
}

export class MetricsTopDoctorItemDto {
  @ApiProperty({
    description: 'Doctor unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  doctorId!: string;

  @ApiProperty({
    example: 15,
    description: 'Number of prescriptions by this doctor',
  })
  count!: number;
}

export class MetricsResponseDto {
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
    type: [MetricsByDayItemDto],
    description:
      'Daily prescription counts for the last 30 days (or filtered range)',
  })
  byDay!: MetricsByDayItemDto[];

  @ApiProperty({
    type: [MetricsTopDoctorItemDto],
    description: 'Top 5 doctors by prescription count in the filtered period',
  })
  topDoctors!: MetricsTopDoctorItemDto[];
}
