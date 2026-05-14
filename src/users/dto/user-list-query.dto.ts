/* Copyright (c) 2026. All rights reserved. */
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role, ThemePreference } from '@prisma/client';
import { BaseListQueryDto } from '../../common/dto/list-query.dto';

/**
 * Whitelist of fields that GET /users (and the role-scoped variants) accept
 * as `sortBy`. Validated by class-validator @IsEnum so unknown values 400.
 */
export enum UserSortBy {
  CreatedAt = 'createdAt',
  UpdatedAt = 'updatedAt',
  Email = 'email',
  Role = 'role',
}

/**
 * Filters/sort/pagination for GET /users (admin-only). The role-scoped
 * variants `/users/patients` and `/users/doctors` extend this DTO with
 * profile-specific fields (specialty/medicalId, birthDate*).
 */
export class UserListQueryDto extends BaseListQueryDto {
  @ApiPropertyOptional({
    description:
      'Case-insensitive substring search on user email (and doctor specialty/medicalId on /users/doctors).',
    example: 'patient@test.com',
    type: String,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  q?: string;

  @ApiPropertyOptional({
    description:
      'Filter by user role. Only honored on the generic /users endpoint; ignored on /users/patients and /users/doctors which fix the role server-side.',
    enum: Role,
    enumName: 'Role',
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    description: 'Filter by createdAt >= createdFromDate (ISO 8601).',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  createdFromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by createdAt <= createdToDate (ISO 8601).',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  createdToDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by UI theme preference.',
    enum: ThemePreference,
    enumName: 'ThemePreference',
  })
  @IsOptional()
  @IsEnum(ThemePreference)
  themePreference?: ThemePreference;

  @ApiPropertyOptional({
    description: 'Field to sort by (whitelist).',
    enum: UserSortBy,
    enumName: 'UserSortBy',
    default: UserSortBy.CreatedAt,
  })
  @IsOptional()
  @IsEnum(UserSortBy)
  sortBy?: UserSortBy = UserSortBy.CreatedAt;
}
