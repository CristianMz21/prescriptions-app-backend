/* Copyright (c) 2026. All rights reserved. */
import { Role } from '@prisma/client';

/**
 * Enterprise-Grade PBAC (Permission-Based Access Control)
 *
 * 1. Define explicit, granular permissions for every discrete action in the system.
 * String enums provide strict type safety and auto-completion across the app.
 */
export enum Permission {
  // Prescriptions Module
  CREATE_PRESCRIPTION = 'create:prescription',
  READ_OWN_PRESCRIPTION = 'read:own_prescription',
  CONSUME_PRESCRIPTION = 'consume:prescription',
  READ_ANY_PRESCRIPTION = 'read:any_prescription',

  // Users Directory Module
  READ_PATIENTS_DIRECTORY = 'read:patients_directory',
  READ_DOCTORS_DIRECTORY = 'read:doctors_directory',
  READ_USER_DETAIL = 'read:user_detail',

  // Admin Module
  READ_GLOBAL_METRICS = 'read:global_metrics',
}

/**
 * 2. Static PBAC Mapping Dictionary
 *
 * Maps existing Roles to an array of specific Permissions.
 * By keeping this static in code (instead of the database), we ensure:
 * - High performance (No DB lookup required on every request to resolve permissions).
 * - Version control over security boundaries.
 * - Strict TypeScript typings preventing invalid role-to-permission mappings.
 */
export const RolePermissionsMap: Record<Role, Permission[]> = {
  [Role.ADMIN]: [
    Permission.READ_ANY_PRESCRIPTION,
    Permission.READ_PATIENTS_DIRECTORY,
    Permission.READ_DOCTORS_DIRECTORY,
    Permission.READ_USER_DETAIL,
    Permission.READ_GLOBAL_METRICS,
  ],
  [Role.DOCTOR]: [
    Permission.CREATE_PRESCRIPTION,
    Permission.READ_OWN_PRESCRIPTION,
    Permission.READ_PATIENTS_DIRECTORY,
    Permission.READ_USER_DETAIL,
  ],
  [Role.PATIENT]: [
    Permission.READ_OWN_PRESCRIPTION,
    Permission.CONSUME_PRESCRIPTION,
  ],
};
