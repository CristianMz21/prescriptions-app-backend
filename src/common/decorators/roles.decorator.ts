import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

/**
 * Key de metadata para almacenar roles requeridos.
 * Usado por RolesGuard para leer qué roles puede acceder al endpoint.
 */
export const ROLES_KEY = 'roles';

/**
 * Decorador para especificar roles requeridos en un endpoint.
 *
 * Aplica Control de Acceso Basado en Roles (RBAC):
 * el endpoint solo será accesible por usuarios con AL MENOS UNO de los roles especificados.
 *
 * @example
 * // Solo admins pueden acceder
 * @Roles(Role.ADMIN)
 * @Get('admin/dashboard')
 *
 * @example
 * // Solo doctores pueden crear prescripciones
 * @Roles(Role.DOCTOR)
 * @Post('prescriptions')
 *
 * @example
 * // Múltiples roles permitidos (admin o doctor)
 * @Roles(Role.ADMIN, Role.DOCTOR)
 * @Get('patients')
 *
 * @param roles - Lista de Role enums. El usuario necesita AL MENOS UNO.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
