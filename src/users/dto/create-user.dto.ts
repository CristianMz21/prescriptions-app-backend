import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

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
  @MinLength(6)
  password!: string;

  @ApiProperty({
    enum: Role,
    enumName: 'Role',
    description: 'User role (ADMIN, DOCTOR, PATIENT)',
    example: 'PATIENT',
  })
  @IsEnum(Role)
  @IsNotEmpty()
  role!: Role;
}
