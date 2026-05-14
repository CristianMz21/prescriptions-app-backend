/* Copyright (c) 2026. All rights reserved. */
import { ApiProperty } from '@nestjs/swagger';

export class LogoutResponseDto {
  @ApiProperty({
    example: 'Logged out successfully',
    description: 'Confirmation message',
  })
  message!: string;
}
