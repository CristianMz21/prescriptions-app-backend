/* Copyright (c) 2026. All rights reserved. */
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PASSWORD_MIN_LENGTH } from '../../common/constants';

export class LoginDto {
  @ApiProperty({ example: 'doctor@clinic.com', description: 'User email' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    example: '***REDACTED-DEV-PASSWORD***',
    description: 'User password',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(PASSWORD_MIN_LENGTH)
  password!: string;
}
