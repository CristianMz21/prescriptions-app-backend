/* Copyright (c) 2026. All rights reserved. */
import { PartialType, PickType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

/**
 * Subset of user fields the authenticated user is allowed to edit on
 * themselves via PATCH /users/me. Email/role/password changes are NOT
 * exposed here — those flow through admin endpoints or a dedicated
 * password-change route.
 *
 * Derived from CreateUserDto via PickType+PartialType so:
 *   - validators (@IsString, @MaxLength, etc.) carry over without duplication
 *   - all picked fields become optional (PATCH semantics)
 *   - Sonar's duplicate-block detector doesn't flag near-identical decorator stacks
 */
export class UpdateUserDto extends PartialType(
  PickType(CreateUserDto, ['name', 'phone'] as const),
) {}
