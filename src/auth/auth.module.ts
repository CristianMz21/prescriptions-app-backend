import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';

const getConfigString = (configService: ConfigService, key: string): string => {
  const value: unknown = configService.getOrThrow(key);
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid config value for ${key}`);
  }
  return value;
};

const parseDurationToSeconds = (value: string): number => {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid JWT duration value: ${value}`);
  }
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === 's') return amount;
  if (unit === 'm') return amount * 60;
  if (unit === 'h') return amount * 60 * 60;
  return amount * 60 * 60 * 24;
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
