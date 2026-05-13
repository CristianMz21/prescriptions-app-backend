import { SetMetadata } from '@nestjs/common';
import { Permission } from '../auth/permissions';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Custom decorator to attach required Permissions to Controller Endpoints.
 * 
 * Replaces the legacy @Roles() decorator.
 * By typing `...permissions` as an array of the `Permission` enum, 
 * we guarantee strict autocomplete and prevent typos at compile-time.
 * 
 * @example
 * @RequirePermissions(Permission.CREATE_PRESCRIPTION)
 * @Post()
 * create(...) {}
 */
export const RequirePermissions = (...permissions: Permission[]) => 
  SetMetadata(PERMISSIONS_KEY, permissions);
