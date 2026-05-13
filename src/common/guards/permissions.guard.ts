import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission, RolePermissionsMap } from '../auth/permissions';
import { Role } from '@prisma/client';

/**
 * Hybrid RBAC -> PBAC Security Guard
 * 
 * This Guard bridges the gap between the JWT Payload (which contains the user's Role)
 * and the Controller Endpoints (which define required Permissions).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Read the required permissions for this specific endpoint
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no specific permissions are required, allow passage (handled by JwtAuthGuard instead)
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; 
    }

    // 2. Extract the authenticated user's role from the Request 
    // (Injected securely by the prior JwtAuthGuard)
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user || !user.role) {
      throw new ForbiddenException('Authentication invalid or missing role data.');
    }

    // 3. Resolve user's actual permissions from the static dictionary
    const userRole: Role = user.role;
    const userPermissions: Permission[] = RolePermissionsMap[userRole] || [];

    // 4. Evaluate: Does the user have ALL the permissions required by the endpoint?
    const hasAllRequiredPermissions = requiredPermissions.every((permission) =>
      userPermissions.includes(permission)
    );

    if (!hasAllRequiredPermissions) {
      // 5. Fail safely and transparently without exposing exact missing permissions
      throw new ForbiddenException('Insufficient permissions to access this resource');
    }

    return true;
  }
}
