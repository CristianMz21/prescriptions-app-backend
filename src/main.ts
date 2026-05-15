/* Copyright (c) 2026. All rights reserved. */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Logger, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { SwaggerModule } from '@nestjs/swagger';
import {
  buildSwaggerConfig,
  swaggerDocumentOptions,
} from './common/swagger/swagger.config';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, NextFunction } from 'express';
import { buildCorsOptions } from './config/cors.config';
import { getCorsRuntimeConfig } from './config/cors-runtime.config';

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
    const corsRuntimeConfig = getCorsRuntimeConfig(configService);

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

    app.enableCors(buildCorsOptions(corsRuntimeConfig));

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    app.useGlobalFilters(new HttpExceptionFilter());

    const port = configService.get<number>('PORT') ?? DEFAULT_PORT;
    const config = buildSwaggerConfig(port);

    const document = SwaggerModule.createDocument(
      app,
      config,
      swaggerDocumentOptions,
    );
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        withCredentials: true,
      },
    });

    // Bind to 0.0.0.0 so Render's load balancer can reach the container;
    // Node's default (::) does not work on every host network mode.
    await app.listen(port, '0.0.0.0');
    bootstrapLogger.log(`Application is running on: ${await app.getUrl()}`);
  } catch (err: unknown) {
    bootstrapLogger.error('Bootstrap failed', err);
    process.exit(1);
  }
})();
