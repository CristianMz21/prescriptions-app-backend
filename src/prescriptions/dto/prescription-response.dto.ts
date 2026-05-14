/* Copyright (c) 2026. All rights reserved. */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrescriptionStatus, Role } from '@prisma/client';

const EXAMPLE_UUID = '123e4567-e89b-12d3-a456-426614174000';

export class PrescriptionItemResponseDto {
  @ApiProperty({
    description: 'Prescription item unique identifier',
    example: 'aaaa1111-bbbb-2222-cccc-3333dddd4444',
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    example: 'Amoxicillin',
    description: 'Name of the medication',
  })
  name!: string;

  @ApiPropertyOptional({
    example: '500mg',
    description: 'Dosage of the medication',
  })
  dosage?: string;

  @ApiPropertyOptional({
    example: 30,
    description: 'Quantity to dispense (number of units)',
  })
  quantity?: number;

  @ApiPropertyOptional({
    example: 'Take 1 pill every 8 hours',
    description: 'Instructions for the patient',
  })
  instructions?: string;
}

export class PrescriptionUserSummaryDto {
  @ApiProperty({
    description: 'User unique identifier',
    example: EXAMPLE_UUID,
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({ example: 'user@clinic.com', format: 'email' })
  email!: string;

  @ApiProperty({ enum: Role, enumName: 'Role' })
  role!: Role;
}

export class PrescriptionAuthorSummaryDto {
  @ApiProperty({
    description: 'Doctor unique identifier',
    example: EXAMPLE_UUID,
    format: 'uuid',
  })
  id!: string;

  @ApiPropertyOptional({
    example: 'Cardiology',
    description: 'Medical specialty',
  })
  specialty?: string;

  @ApiPropertyOptional({
    example: 'MED-12345',
    description: 'Medical license / registration number',
  })
  medicalId?: string;

  @ApiPropertyOptional({
    example: 'Dr. Jane Doe',
    description: 'Text rendering of the doctor signature',
  })
  signatureText?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.clinic.com/signatures/jane-doe.png',
    description: 'URL to the doctor signature image',
    format: 'uri',
  })
  signatureImageUrl?: string;

  @ApiProperty({
    type: () => PrescriptionUserSummaryDto,
    description: 'Doctor account',
  })
  user!: PrescriptionUserSummaryDto;
}

export class PrescriptionPatientSummaryDto {
  @ApiProperty({
    description: 'Patient unique identifier',
    example: '456e7890-e89b-12d3-a456-426614174001',
    format: 'uuid',
  })
  id!: string;

  @ApiPropertyOptional({
    example: '1990-05-21',
    description: 'Patient date of birth (ISO-8601 date)',
    format: 'date',
  })
  birthDate?: Date;

  @ApiProperty({
    type: () => PrescriptionUserSummaryDto,
    description: 'Patient account',
  })
  user!: PrescriptionUserSummaryDto;
}

export class PrescriptionResponseDto {
  @ApiProperty({
    description: 'Prescription unique identifier',
    example: '789e0123-e89b-12d3-a456-426614174002',
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    description: 'Short URL-safe code used by the QR on the PDF',
    example: 'RX-A1B2C3D4E5',
  })
  code!: string;

  @ApiProperty({
    description: 'Current status of the prescription',
    enum: PrescriptionStatus,
    enumName: 'PrescriptionStatus',
    example: 'PENDING',
  })
  status!: PrescriptionStatus;

  @ApiProperty({
    description: 'List of medications in the prescription',
    type: [PrescriptionItemResponseDto],
  })
  items!: PrescriptionItemResponseDto[];

  @ApiPropertyOptional({
    example: 'Follow up in 2 weeks',
    description: 'Additional notes from the doctor',
  })
  notes?: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp when the prescription was created',
    example: '2026-01-01T00:00:00.000Z',
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'ISO 8601 timestamp when the prescription was last updated',
    example: '2026-01-15T12:30:00.000Z',
    format: 'date-time',
  })
  updatedAt!: Date;

  @ApiPropertyOptional({
    description: 'ISO 8601 timestamp when the prescription was consumed',
    example: '2026-01-16T08:45:00.000Z',
    format: 'date-time',
  })
  consumedAt?: Date;

  @ApiProperty({
    description: 'Author (Doctor) unique identifier',
    example: EXAMPLE_UUID,
    format: 'uuid',
  })
  authorId!: string;

  @ApiProperty({
    description: 'Patient unique identifier',
    example: '456e7890-e89b-12d3-a456-426614174001',
    format: 'uuid',
  })
  patientId!: string;

  @ApiProperty({
    type: () => PrescriptionAuthorSummaryDto,
    description: 'Prescribing doctor summary',
  })
  author!: PrescriptionAuthorSummaryDto;

  @ApiProperty({
    type: () => PrescriptionPatientSummaryDto,
    description: 'Patient summary',
  })
  patient!: PrescriptionPatientSummaryDto;
}
