import { Exclude } from 'class-transformer';
import { Role } from '@prisma/client';

/**
 * Data Serialization Boundary for the User model.
 * Mirrors the Prisma User schema but applies transformation rules
 * to prevent sensitive data leakage in HTTP responses.
 */
export class UserEntity {
  id: string;
  email: string;

  /**
   * CRITICAL SECURITY REQUIREMENT:
   * The @Exclude() decorator guarantees that class-transformer will completely
   * strip this field from the JSON output when returning this entity from a controller.
   * This prevents accidental exposure of the password hash.
   */
  @Exclude()
  passwordHash: string;

  role: Role;
  createdAt: Date;
  updatedAt: Date;

  /**
   * Constructor required to instantiate the object from raw Prisma data
   * so that class-transformer decorators are recognized.
   */
  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}
