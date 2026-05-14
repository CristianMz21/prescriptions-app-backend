/* Copyright (c) 2026. All rights reserved. */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { parseDurationToSeconds } from '../common/utils/duration.utils';

const getConfigString = (configService: ConfigService, key: string): string => {
  const value: unknown = configService.getOrThrow(key);
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid config value for ${key}`);
  }
  return value;
};

@Module({
  imports: [
    PassportModule,
    UsersModule,
    // Dynamically configure JWT using validated environment variables
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: getConfigString(configService, 'JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: parseDurationToSeconds(
            getConfigString(configService, 'JWT_ACCESS_TTL'),
          ),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
