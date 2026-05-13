import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorator to enforce Role-Based Access Control (RBAC) on route handlers.
 * @param roles Array of required Role enums to access the endpoint.
 * 
 * Usage example:
 * @Roles(Role.ADMIN)
 * @Get('admin/metrics')
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
