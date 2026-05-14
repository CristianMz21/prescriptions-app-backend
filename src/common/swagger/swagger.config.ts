/* Copyright (c) 2026. All rights reserved. */
import { DocumentBuilder, SwaggerDocumentOptions } from '@nestjs/swagger';
import { readFileSync } from 'fs';
import { join } from 'path';

interface PackageJson {
  version: string;
}

const pkg = JSON.parse(
  readFileSync(join(process.cwd(), 'package.json'), 'utf-8'),
) as PackageJson;

export const buildSwaggerConfig = (port: number | string) =>
  new DocumentBuilder()
    .setTitle('Prescription Management API')
    .setDescription(
      'API documentation for the MVP Prescription Management System.',
    )
    .setVersion(pkg.version)
    .addServer(`http://localhost:${port}`, 'Local development server')
    .addCookieAuth('accessToken', {
      type: 'apiKey',
      in: 'cookie',
      name: 'accessToken',
    })
    .build();

export const swaggerDocumentOptions: SwaggerDocumentOptions = {
  operationIdFactory: (controllerKey, methodKey) =>
    `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
};
