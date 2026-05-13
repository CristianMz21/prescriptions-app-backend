import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard de Control de Acceso Basado en Roles (RBAC).
 *
 * Funcionamiento:
 * 1. Lee los roles requeridos del decorador @Roles() en el handler
 * 2. Extrae el rol del usuario autenticado (req.user.role)
 * 3. Compara y permite o rechaza el acceso
 *
 * @security
 * - Si no hay decorador @Roles() en el endpoint → se permite acceso a cualquier rol autenticado
 * - Si hay decorador → el usuario debe tener uno de los roles especificados
 * - El error 403 indica "tienes sesión pero no permiso" (vs 401 = "sin sesión")
 *
 * @note La reflexión (Reflector) permite acceder a metadatos de decorators
 *       definidos en el handler o en el controller (herencia de roles).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  /**
   * Evalúa si el usuario tiene los roles necesarios para acceder al recurso.
   *
   * @param context - Contexto de ejecución de NestJS (contiene request con user)
   * @returns true si acceso permitido, lanza ForbiddenException si no
   *
   * @logic
   * 1. getAllAndOverride busca el metadata ROLES_KEY en:
   *    - El handler actual (@Get, @Post, etc.)
   *    - El controller que contiene el handler
   *    - El primer valor encontrado reemplaza (override)
   *
   * 2. Si no hay roles requeridos → endpoint público para cualquier autenticado
   *
   * 3. Validación de estructura: user y user.role deben existir
   *    (si no, algo salió mal en JwtAuthGuard)
   *
   * 4. includes() verifica si el rol del usuario está en la lista de roles permitidos
   */
  canActivate(context: ExecutionContext): boolean {
    // Obtener roles requeridos desde el decorador @Roles()
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si no hay roles especificados → cualquier usuario autenticado puede acceder
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.role) {
      throw new ForbiddenException('User role not found in authentication context');
    }

    // Verificar si el rol del usuario está en los roles permitidos
    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions to access this resource');
    }

    return true;
  }
}