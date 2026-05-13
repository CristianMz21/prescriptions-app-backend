import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function exportOpenApi() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const port = process.env.PORT ?? '3000';
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

  const outputPath = join(process.cwd(), 'openapi.json');
  writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8');

  console.log(`OpenAPI spec written to: ${outputPath}`);
  console.log(`  title: ${document.info.title}`);
  console.log(`  version: ${document.info.version}`);
  console.log(`  paths: ${Object.keys(document.paths).length}`);

  await app.close();
}

exportOpenApi().catch((err) => {
  console.error('Failed to export OpenAPI spec:', err);
  process.exit(1);
});
