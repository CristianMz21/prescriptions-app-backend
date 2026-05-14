import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 400, description: 'HTTP status code of the error' })
  statusCode!: number;

  @ApiProperty({
    example: 'Invalid JSON payload',
    description: 'Error message describing what went wrong',
  })
  message!: string;

  @ApiProperty({
    example: '/auth/login',
    description: 'The request path that caused the error',
  })
  path!: string;

  @ApiProperty({
    example: '2026-05-13T10:30:00.000Z',
    description: 'ISO 8601 timestamp when the error occurred',
  })
  timestamp!: string;
}
