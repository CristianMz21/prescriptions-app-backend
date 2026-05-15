/* Copyright (c) 2026. All rights reserved. */
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PASSWORD_MIN_LENGTH,
  SIGNATURE_TEXT_MAX_LENGTH,
} from '../../common/constants';

const MEDICAL_ID_MAX_LENGTH = 64;

export class CreateUserDto {
  @ApiProperty({
    example: 'user@clinic.com',
    description: 'User email address',
    format: 'email',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    example: '***REDACTED-DEV-PASSWORD***',
    description: 'User password (minimum 6 characters)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(PASSWORD_MIN_LENGTH)
  password!: string;

  /**
   * Full display name. Required by product contract — every user MUST have a
   * name. Do NOT make this optional or add a default; downstream UI/PDF
   * rendering depends on a non-empty value.
   */
  @ApiProperty({
    example: 'Jane Doe',
    description: 'Full display name (UI). Required.',
    minLength: 1,
    maxLength: 120,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    example: '+54 11 1234-5678',
    description:
      'Optional contact phone (E.164-ish, free-form up to 32 chars).',
    maxLength: 32,
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiProperty({
    enum: Role,
    enumName: 'Role',
    description: 'User role (ADMIN, DOCTOR, PATIENT)',
    example: 'PATIENT',
  })
  @IsEnum(Role)
  @IsNotEmpty()
  role!: Role;

  @ApiPropertyOptional({
    example: 'Cardiology',
    description: 'Medical specialty (only applies when role=DOCTOR)',
  })
  @IsString()
  @IsOptional()
  specialty?: string;

  @ApiPropertyOptional({
    example: '1990-05-21',
    description: 'Date of birth ISO-8601 (only applies when role=PATIENT)',
    format: 'date',
  })
  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @ApiPropertyOptional({
    example: 'MED-12345',
    description: 'Medical license number (only applies when role=DOCTOR)',
    maxLength: MEDICAL_ID_MAX_LENGTH,
  })
  @IsString()
  @IsOptional()
  @MaxLength(MEDICAL_ID_MAX_LENGTH)
  medicalId?: string;

  @ApiPropertyOptional({
    example: 'Dr. Jane Doe',
    description:
      'Text-based handwritten-style signature label rendered on PDFs (DOCTOR only)',
    maxLength: SIGNATURE_TEXT_MAX_LENGTH,
  })
  @IsString()
  @IsOptional()
  @MaxLength(SIGNATURE_TEXT_MAX_LENGTH)
  signatureText?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.clinic.com/signatures/jane-doe.png',
    description: 'URL to a signature image rendered on PDFs (DOCTOR only)',
    format: 'uri',
  })
  @IsUrl()
  @IsOptional()
  signatureImageUrl?: string;
}
