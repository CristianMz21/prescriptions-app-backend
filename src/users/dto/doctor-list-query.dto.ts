/* Copyright (c) 2026. All rights reserved. */
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserListQueryDto } from './user-list-query.dto';

/**
 * Doctor-list-specific filters layered on top of `UserListQueryDto`.
 * Only meaningful for GET /users/doctors.
 */
export class DoctorListQueryDto extends UserListQueryDto {
  @ApiPropertyOptional({
    description:
      'Case-insensitive substring match on Doctor.specialty (e.g. "cardio").',
    example: 'cardio',
    maxLength: 128,
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  specialty?: string;

  @ApiPropertyOptional({
    description:
      'Case-insensitive substring match on Doctor.medicalId (e.g. "MED-1234").',
    example: 'MED-1234',
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  medicalId?: string;
}
