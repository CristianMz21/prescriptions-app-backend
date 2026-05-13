/* Copyright (c) 2026. All rights reserved. */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

/**
 * Estructura del payload dentro del JWT.
 * Se usa tanto para firmar (en AuthService.login) como para validar (aquí).
 */
export interface JwtPayload {
  sub: string;  // ID del usuario (CUID de Prisma)
  email: string;
  role: string; // Role enum como string: 'admin' | 'doctor' | 'patient'
}

/**
 * Estrategia Passport para validación de JWTs extrídos de cookies HTTP-only.
 *
 * @security
 * - El JWT se extrae exclusivamente del cookie 'accessToken'
 * - NO se acepta del header Authorization: Bearer
 * - Esto mitiga ataques XSS que podrían robar tokens de localStorage
 * - El cookie httpOnly es inaccesible via JavaScript del navegador
 *
 * @note El secretOrKey debe provenir de variable de entorno en producción.
 *       El fallback hardcodeado es SOLO para desarrollo local.
 */
export const cookieExtractor = (request: Request) => {
  let token = null;
  if (request && request.cookies) {
    token = request.cookies['accessToken'];
  }
  return token;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // Extraer JWT solo del cookie, no de headers
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super-secret-fallback-key-do-not-use-in-prod',
    });
  }

  /**
   * Valida el payload del JWT verificado.
   *
   * @param payload - Contenido decodificado del JWT (sub, email, role)
   * @returns Objeto { id, email, role } que se adjunta a req.user
   *
   * @throws UnauthorizedException si el payload no tiene los campos requeridos
   *
   * @note Este método es llamado automáticamente por Passport después de
   *       verificar la firma del JWT. Si la firma es inválida, este método
   *       nunca se ejecuta (Passport rechaza antes).
   */
  async validate(payload: JwtPayload) {
    if (!payload.sub || !payload.email || !payload.role) {
      throw new UnauthorizedException('Invalid JWT payload structure');
    }

    // Mapear 'sub' (estándar JWT) a 'id' (nombre usado en el resto de la app)
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role
    };
  }
}