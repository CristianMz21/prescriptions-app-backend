/* Copyright (c) 2026. All rights reserved. */
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CONSUME_REASON_MAX_LENGTH } from '../../common/constants';

export class ConsumePrescriptionDto {
  @ApiPropertyOptional({
    example: 'Picked up at the pharmacy on May 13',
    description:
      'Optional free-text reason persisted in the prescription audit log.',
    maxLength: CONSUME_REASON_MAX_LENGTH,
  })
  @IsString()
  @IsOptional()
  @MaxLength(CONSUME_REASON_MAX_LENGTH)
  reason?: string;
}
