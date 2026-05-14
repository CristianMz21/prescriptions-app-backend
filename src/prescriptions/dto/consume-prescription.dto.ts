/* Copyright (c) 2026. All rights reserved. */
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ConsumePrescriptionDto {
  @ApiPropertyOptional({
    example: 'Picked up at the pharmacy on May 13',
    description:
      'Optional free-text reason persisted in the prescription audit log.',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}
