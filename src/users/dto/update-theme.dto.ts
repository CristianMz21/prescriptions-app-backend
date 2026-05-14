/* Copyright (c) 2026. All rights reserved. */
import { IsEnum, IsNotEmpty } from 'class-validator';
import { ThemePreference } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateThemeDto {
  @ApiProperty({
    enum: ThemePreference,
    enumName: 'ThemePreference',
    example: 'DARK',
    description:
      'UI theme preference for the current user. SYSTEM follows the OS preference.',
  })
  @IsEnum(ThemePreference)
  @IsNotEmpty()
  themePreference!: ThemePreference;
}
