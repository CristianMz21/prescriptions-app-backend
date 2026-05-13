import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PrescriptionItemDto {
  @ApiProperty({ example: 'Amoxicillin', description: 'Name of the medication' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '500mg', description: 'Dosage of the medication' })
  @IsString()
  @IsNotEmpty()
  dosage: string;

  @ApiProperty({ example: '30', description: 'Quantity to dispense' })
  @IsString()
  @IsNotEmpty()
  quantity: string;

  @ApiPropertyOptional({ example: 'Take 1 pill every 8 hours', description: 'Instructions for the patient' })
  @IsString()
  @IsOptional()
  instructions?: string;
}

export class CreatePrescriptionDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'UUID of the patient' })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({ type: [PrescriptionItemDto], description: 'List of medications in the prescription' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  @IsNotEmpty()
  items: PrescriptionItemDto[];

  @ApiPropertyOptional({ example: 'Follow up in 2 weeks', description: 'Additional notes from the doctor' })
  @IsString()
  @IsOptional()
  notes?: string;
}
