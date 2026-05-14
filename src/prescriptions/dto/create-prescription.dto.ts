import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PrescriptionItemDto {
  @ApiProperty({
    example: 'Amoxicillin',
    description: 'Name of the medication',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: '500mg', description: 'Dosage of the medication' })
  @IsString()
  @IsNotEmpty()
  dosage!: string;

  @ApiProperty({
    example: 30,
    description: 'Quantity to dispense (number of units)',
  })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({
    example: 'Take 1 pill every 8 hours',
    description: 'Instructions for the patient',
  })
  @IsString()
  @IsOptional()
  instructions?: string;
}

export class CreatePrescriptionDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'UUID of the patient',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  patientId!: string;

  @ApiProperty({
    type: [PrescriptionItemDto],
    description: 'List of medications in the prescription',
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Items array must not be empty' })
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  @IsNotEmpty()
  items!: PrescriptionItemDto[];

  @ApiPropertyOptional({
    example: 'Follow up in 2 weeks',
    description: 'Additional notes from the doctor',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
