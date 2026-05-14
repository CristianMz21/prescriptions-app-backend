/* Copyright (c) 2026. All rights reserved. */
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class JwtPayloadDto {
  @ApiProperty({
    description: 'Unique user identifier (UUID v4)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    description: 'Authenticated user email address',
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
