import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security: Apply Helmet to set various HTTP headers for app security
  // It helps protect against well-known web vulnerabilities by setting HTTP headers appropriately.
  app.use(helmet());

  // Security: Configure CORS
  // Allow credentials for HTTP-Only cookies to work across domains (if frontend is separate)
  // Restrict the origins to your frontend application's domain in production.
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000', // Adjust to match production frontend URL
    credentials: true, // Essential for receiving HttpOnly cookies from the frontend
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  // Validation: Global validation pipe for strict DTO checking
  // Using class-validator and class-transformer to automatically validate incoming payloads
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Automatically strip non-whitelisted properties from the payload
      forbidNonWhitelisted: true, // Throw a Bad Request error if non-whitelisted properties are present
      transform: true, // Automatically transform payloads to be objects typed according to their DTO classes
    }),
  );

  // Exception Handling: Global exception filter for consistent JSON error response formats
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
