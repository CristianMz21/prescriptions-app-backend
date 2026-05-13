/* Copyright (c) 2026. All rights reserved. */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

interface RequestUser {
  id: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Strictly validates user credentials.
   */
  async validateUser(email: string, pass: string): Promise<Omit<RequestUser, 'passwordHash'> | null> {
    const user = await this.usersService.findByEmail(email);

    if (user && (await bcrypt.compare(pass, user.passwordHash))) {
      const { passwordHash, ...result } = user;
      return result;
    }
    
    return null;
  }

  async login(user: Omit<RequestUser, 'passwordHash'>): Promise<{ accessToken: string; refreshToken: string; user: Omit<RequestUser, 'passwordHash'> }> {
    const payload = { sub: user.id, email: user.email, role: user.role };

    // Dynamically retrieve secrets and TTLs from the validated ConfigService
    const accessTokenSecret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    const refreshTokenSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const accessTtl = this.configService.getOrThrow<string>('JWT_ACCESS_TTL');
    const refreshTtl = this.configService.getOrThrow<string>('JWT_REFRESH_TTL');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessTokenSecret,
        expiresIn: accessTtl as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshTokenSecret,
        expiresIn: refreshTtl as any,
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

  async refresh(token: string): Promise<{ accessToken: string }> {
    try {
      const refreshTokenSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
      const payload = await this.jwtService.verifyAsync(token, {
        secret: refreshTokenSecret,
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException();
      }

      const accessTokenSecret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
      const accessTtl = this.configService.getOrThrow<string>('JWT_ACCESS_TTL');

      const newAccessToken = await this.jwtService.signAsync(
        { sub: user.id, email: user.email, role: user.role },
        {
          secret: accessTokenSecret,
          expiresIn: accessTtl as any,
        },
      );

      return { accessToken: newAccessToken };
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
