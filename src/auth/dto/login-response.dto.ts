/* Copyright (c) 2026. All rights reserved. */
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class AuthUserDto {
  @ApiProperty({
    description: 'User unique identifier',
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

  @ApiProperty({
    description: 'User role for RBAC',
    enum: Role,
    enumName: 'Role',
    example: 'DOCTOR',
  })
  role!: Role;
}

export class LoginResponseDto {
  @ApiProperty({
    example: 'Login successful',
    description: 'Confirmation message',
  })
  message!: string;

  @ApiProperty({
    type: () => AuthUserDto,
    description: 'Authenticated user profile',
  })
  user!: AuthUserDto;
}
