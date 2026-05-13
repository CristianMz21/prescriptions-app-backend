import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

// Define the payload structure expected in the JWT
export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // Security: Extract JWT exclusively from the HTTP-Only cookie.
      // This protects against XSS vulnerabilities compared to using localStorage + Authorization header.
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          let token = null;
          if (request && request.cookies) {
            token = request.cookies['accessToken'];
          }
          return token;
        },
      ]),
      ignoreExpiration: false,
      // In production, this must be an environment variable injected securely
      secretOrKey: process.env.JWT_SECRET || 'super-secret-fallback-key-do-not-use-in-prod',
    });
  }

  /**
   * Validates the payload extracted from the verified JWT.
   * The return value is automatically attached to the Express Request object as `req.user`.
   */
  async validate(payload: JwtPayload) {
    if (!payload.sub || !payload.email || !payload.role) {
      throw new UnauthorizedException('Invalid JWT payload structure');
    }
    
    // Map 'sub' back to 'id' for easier consumption in controllers
    return { 
      id: payload.sub, 
      email: payload.email, 
      role: payload.role 
    };
  }
}
