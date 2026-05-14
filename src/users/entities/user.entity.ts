/* Copyright (c) 2026. All rights reserved. */
import { Exclude } from 'class-transformer';
import { Role, ThemePreference } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DoctorProfileSummary {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ example: 'Cardiology' })
  specialty?: string | null;

  @ApiPropertyOptional({ example: 'MED-12345' })
  medicalId?: string | null;

  @ApiPropertyOptional({ example: 'Dr. Jane Doe' })
  signatureText?: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.clinic.com/signatures/jane-doe.png',
    format: 'uri',
  })
  signatureImageUrl?: string | null;
}

export class PatientProfileSummary {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({
    example: '1990-05-21',
    format: 'date',
  })
  birthDate?: Date | null;
}

export class UserEntity {
  @ApiProperty({
    description: 'Unique user identifier (UUID v4)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    description: 'User email address',
    example: 'doctor@clinic.com',
    format: 'email',
  })
  email!: string;

  @Exclude()
  passwordHash!: string;

  @ApiProperty({
    description: 'User role for RBAC',
    enum: Role,
    enumName: 'Role',
    example: 'DOCTOR',
  })
  role!: Role;

  @ApiProperty({
    description: 'ISO 8601 timestamp when the user was created',
    example: '2026-01-01T00:00:00.000Z',
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'ISO 8601 timestamp when the user was last updated',
    example: '2026-01-15T12:30:00.000Z',
    format: 'date-time',
  })
  updatedAt!: Date;

  @ApiProperty({
    description: 'UI theme preference',
    enum: ThemePreference,
    enumName: 'ThemePreference',
    example: 'SYSTEM',
  })
  themePreference!: ThemePreference;

  @ApiPropertyOptional({ type: () => DoctorProfileSummary })
  doctor?: DoctorProfileSummary | null;

  @ApiPropertyOptional({ type: () => PatientProfileSummary })
  patient?: PatientProfileSummary | null;

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}
