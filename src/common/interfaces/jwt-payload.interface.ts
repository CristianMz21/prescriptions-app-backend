import { Role } from '@prisma/client';

/**
 * Strict typing for the extracted JSON Web Token payload.
 * Guarantees that any controller using @CurrentUser() will have strong
 * type awareness of the authenticated identity and their boundaries.
 */
export interface JwtPayload {
  /**
   * Subject of the JWT (The unique User ID / CUID / UUID)
   */
  id: string;

  /**
   * The authenticated user's email address
   */
  email: string;

  /**
   * The user's role (ADMIN, DOCTOR, PATIENT) used for RBAC/PBAC.
   */
  role: Role;
}
