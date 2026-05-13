import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
// We assume UsersService exposes business logic for finding users by email.
import { UsersService } from '../../users/users.service'; 

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Validates a user's credentials securely.
   */
  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    
    if (user && (await bcrypt.compare(pass, user.passwordHash))) {
      // Security: Explicitly exclude passwordHash from the returned object before token generation
      const { passwordHash, ...result } = user;
      return result;
    }
    return null; // Return null if validation fails
  }

  /**
   * Generates a pair of JWTs (Access & Refresh) for a validated user.
   */
  async login(user: any) {
    // Standardize the JWT payload
    const payload = { sub: user.id, email: user.email, role: user.role };
    
    // Security: Production secrets should be managed via @nestjs/config (ConfigService)
    const accessTokenSecret = process.env.JWT_SECRET || 'super-secret-fallback-key-do-not-use-in-prod';
    const refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-key-do-not-use';

    // Generate tokens concurrently
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessTokenSecret,
        expiresIn: '15m', // Short-lived access token
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshTokenSecret,
        expiresIn: '7d', // Long-lived refresh token
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    };
  }
}
