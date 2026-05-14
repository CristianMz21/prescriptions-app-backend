/* Copyright (c) 2026. All rights reserved. */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrescriptionStatus } from '@prisma/client';

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

  @ApiProperty({ example: '500mg', description: 'Dosage of the medication' })
  dosage!: string;

  @ApiProperty({
    example: 30,
    description: 'Quantity to dispense (number of units)',
  })
  quantity!: number;

  @ApiPropertyOptional({
    example: 'Take 1 pill every 8 hours',
    description: 'Instructions for the patient',
  })
  instructions?: string;
}

export class PrescriptionDoctorSummaryDto {
  @ApiProperty({
    description: 'Doctor unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({ example: 'doctor@clinic.com', format: 'email' })
  email!: string;

  @ApiProperty({ enum: PrescriptionStatus, enumName: 'Role' })
  role!: string;
}

export class PrescriptionPatientSummaryDto {
  @ApiProperty({
    description: 'Patient unique identifier',
    example: '456e7890-e89b-12d3-a456-426614174001',
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({ example: 'patient@clinic.com', format: 'email' })
  email!: string;

  @ApiProperty({ enum: PrescriptionStatus, enumName: 'Role' })
  role!: string;
}

export class PrescriptionResponseDto {
  @ApiProperty({
    description: 'Prescription unique identifier',
    example: '789e0123-e89b-12d3-a456-426614174002',
    format: 'uuid',
  })
  id!: string;

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

  @ApiProperty({
    description: 'Prescribing doctor unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  doctorId!: string;

  @ApiProperty({
    description: 'Patient unique identifier',
    example: '456e7890-e89b-12d3-a456-426614174001',
    format: 'uuid',
  })
  patientId!: string;

  @ApiProperty({
    type: () => PrescriptionDoctorSummaryDto,
    description: 'Prescribing doctor summary',
  })
  doctor!: PrescriptionDoctorSummaryDto;

  @ApiProperty({
    type: () => PrescriptionPatientSummaryDto,
    description: 'Patient summary',
  })
  patient!: PrescriptionPatientSummaryDto;
}
