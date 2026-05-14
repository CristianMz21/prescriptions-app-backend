/* Copyright (c) 2026. All rights reserved. */
import { ClassSerializerInterceptor, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
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
  providers: [
    AppService,
    // Global response serializer: applies @Exclude/@Expose from class-transformer
    // to every controller response that returns a class instance. Critical for
    // stripping sensitive fields like UserEntity.passwordHash.
    {
      provide: APP_INTERCEPTOR,
      useClass: ClassSerializerInterceptor,
    },
  ],
})
export class AppModule {}
