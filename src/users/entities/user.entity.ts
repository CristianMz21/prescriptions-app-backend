import { Exclude } from 'class-transformer';
import { Role } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

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

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}
