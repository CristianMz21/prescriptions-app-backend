/* Copyright (c) 2026. All rights reserved. */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Logger, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, NextFunction } from 'express';

const DEFAULT_PORT = 3000;
const bootstrapLogger = new Logger('Bootstrap');

const securityHeadersMiddleware = (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
};

void (async () => {
  try {
    const app = await NestFactory.create(AppModule);

    const configService = app.get(ConfigService);
    const appOrigin = configService.get<string>('APP_ORIGIN');
    const frontendUrl = configService.get<string>('FRONTEND_URL');
    const corsOrigin = appOrigin ?? frontendUrl;

    if (!corsOrigin) {
      throw new Error(
        'Environment validation failed: At least one of APP_ORIGIN or FRONTEND_URL must be provided',
      );
    }

    app.use(
      helmet({
        frameguard: false,
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: false,
        crossOriginResourcePolicy: false,
        dnsPrefetchControl: false,
        hidePoweredBy: false,
        hsts: false,
        ieNoOpen: false,
        noSniff: false,
        originAgentCluster: false,
        permittedCrossDomainPolicies: false,
        referrerPolicy: false,
        xssFilter: false,
      }),
    );

    app.use(securityHeadersMiddleware);
    app.use(cookieParser());

    app.enableCors({
      origin: corsOrigin,
      credentials: true,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      allowedHeaders: 'Content-Type, Accept, Authorization',
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    app.useGlobalFilters(new HttpExceptionFilter());

    const port = configService.get<number>('PORT') ?? DEFAULT_PORT;
    const config = new DocumentBuilder()
      .setTitle('Prescription Management API')
      .setDescription(
        'API documentation for the MVP Prescription Management System.',
      )
      .setVersion('1.0')
      .addServer(`http://localhost:${port}`, 'Local development server')
      .addCookieAuth('accessToken', {
        type: 'apiKey',
        in: 'cookie',
        name: 'accessToken',
      })
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        withCredentials: true,
      },
    });

    await app.listen(port);
    bootstrapLogger.log(`Application is running on: ${await app.getUrl()}`);
  } catch (err: unknown) {
    bootstrapLogger.error('Bootstrap failed', err);
    process.exit(1);
  }
})();
