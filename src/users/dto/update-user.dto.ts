/* Copyright (c) 2026. All rights reserved. */
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Subset of user fields the authenticated user is allowed to edit on
 * themselves via PATCH /users/me. Email/role/password changes are NOT
 * exposed here — those flow through admin endpoints or a dedicated
 * password-change route (out of scope of this DTO).
 */
export class UpdateUserDto {
  @ApiPropertyOptional({
    example: 'Jane Doe Updated',
    description: 'New display name (UI).',
    minLength: 1,
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    example: '+54 11 9999-0000',
    description:
      'New contact phone (free-form up to 32 chars). Send empty string to clear (currently treated as set-to-empty; not nullified).',
    maxLength: 32,
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;
}
