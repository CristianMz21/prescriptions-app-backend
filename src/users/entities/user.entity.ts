/* Copyright (c) 2026. All rights reserved. */
import { Exclude } from 'class-transformer';
import { Role, ThemePreference } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DoctorProfileSummary {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ type: String, example: 'Cardiology', nullable: true })
  specialty?: string | null;

  @ApiPropertyOptional({ type: String, example: 'MED-12345', nullable: true })
  medicalId?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'Dr. Jane Doe',
    nullable: true,
  })
  signatureText?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'https://cdn.clinic.com/signatures/jane-doe.png',
    format: 'uri',
    nullable: true,
  })
  signatureImageUrl?: string | null;
}

export class PatientProfileSummary {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({
    type: String,
    example: '1990-05-21T00:00:00.000Z',
    format: 'date-time',
    nullable: true,
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

  /**
   * Display name. Required at the schema level (NOT NULL) — guaranteed
   * non-empty for every persisted User. Do NOT mark optional in subclasses.
   */
  @ApiProperty({
    description: 'Display name shown in the UI.',
    example: 'Jane Doe',
  })
  name!: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Optional contact phone (canonical contact field).',
    example: '+54 11 1234-5678',
    nullable: true,
  })
  phone?: string | null;

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

  @ApiPropertyOptional({ type: () => DoctorProfileSummary, nullable: true })
  doctor?: DoctorProfileSummary | null;

  @ApiPropertyOptional({ type: () => PatientProfileSummary, nullable: true })
  patient?: PatientProfileSummary | null;

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}
