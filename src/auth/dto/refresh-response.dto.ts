import { ApiProperty } from '@nestjs/swagger';

export class RefreshResponseDto {
  @ApiProperty({
    example: 'Token refreshed',
    description: 'Confirmation message',
  })
  message!: string;
}
