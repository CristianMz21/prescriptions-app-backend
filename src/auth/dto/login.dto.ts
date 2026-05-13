import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
  @MinLength(6)
  password!: string;
}
