/* Copyright (c) 2026. All rights reserved. */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { AdminModule } from './admin/admin.module';
import { UsersModule } from './users/users.module';
import { EmailModule } from './email/email.module';
import { validate } from './config/env.validation';

@Module({
  imports: [
    // Global ConfigModule registration with strict environment validation
    ConfigModule.forRoot({
      validate,
      isGlobal: true, // Makes ConfigService available globally without re-importing
    }),
    AuthModule,
    PrescriptionsModule,
    AdminModule,
    UsersModule,
    EmailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
