/* Copyright (c) 2026. All rights reserved. */
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private getConfigString(key: string): string {
    const value: unknown = this.configService.getOrThrow(key);
    if (typeof value !== 'string' || value.length === 0) {
      throw new UnauthorizedException(`Invalid config value for ${key}`);
    }
    return value;
  }

  private parseDurationToSeconds(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value.trim());
    if (!match) {
      throw new UnauthorizedException(`Invalid duration format: ${value}`);
    }
    const amount = Number(match[1]);
    const unit = match[2];
    if (unit === 's') return amount;
    if (unit === 'm') return amount * 60;
    if (unit === 'h') return amount * 60 * 60;
    return amount * 60 * 60 * 24;
  }

  /**
   * Strictly validates user credentials.
   */
  async validateUser(
    email: string,
    pass: string,
  ): Promise<Omit<JwtPayload, 'passwordHash'> | null> {
    const user = await this.usersService.findByEmail(email);

    if (user && (await bcrypt.compare(pass, user.passwordHash))) {
      return { id: user.id, email: user.email, role: user.role };
    }

    return null;
  }

  async login(user: Omit<JwtPayload, 'passwordHash'>): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Omit<JwtPayload, 'passwordHash'>;
  }> {
    const payload = { sub: user.id, email: user.email, role: user.role };

    // Dynamically retrieve secrets and TTLs from the validated ConfigService
    const accessTokenSecret = this.getConfigString('JWT_ACCESS_SECRET');
    const refreshTokenSecret = this.getConfigString('JWT_REFRESH_SECRET');
    const accessTtl = this.parseDurationToSeconds(
      this.getConfigString('JWT_ACCESS_TTL'),
    );
    const refreshTtl = this.parseDurationToSeconds(
      this.getConfigString('JWT_REFRESH_TTL'),
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessTokenSecret,
        expiresIn: accessTtl,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshTokenSecret,
        expiresIn: refreshTtl,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async refresh(token: string): Promise<{ accessToken: string }> {
    try {
      const refreshTokenSecret = this.getConfigString('JWT_REFRESH_SECRET');
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(
        token,
        {
          secret: refreshTokenSecret,
        },
      );

      const user = await this.usersService.findById(payload.sub);

      const accessTokenSecret = this.getConfigString('JWT_ACCESS_SECRET');
      const accessTtl = this.parseDurationToSeconds(
        this.getConfigString('JWT_ACCESS_TTL'),
      );

      const newAccessToken = await this.jwtService.signAsync(
        { sub: user.id, email: user.email, role: user.role },
        {
          secret: accessTokenSecret,
          expiresIn: accessTtl,
        },
      );

      return { accessToken: newAccessToken };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Invalid refresh token provided: ${error.message}`);
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
