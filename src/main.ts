import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Safely extract validated configuration variables
  const configService = app.get(ConfigService);
  const frontendUrl = configService.get<string>('FRONTEND_URL');

  // Security: Apply Helmet to set various HTTP headers for app security
  app.use(helmet());

  // Security: Use cookie-parser to handle HttpOnly cookies
  app.use(cookieParser());

  // Security: Configure CORS using the validated environment variable
  app.enableCors({
    origin: frontendUrl,
    credentials: true, // Essential for receiving HttpOnly cookies from the frontend
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  // Validation: Global validation pipe for strict DTO checking
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Exception Handling: Global exception filter for consistent JSON error response formats
  app.useGlobalFilters(new HttpExceptionFilter());

  // OpenAPI / Swagger Setup
  const config = new DocumentBuilder()
    .setTitle('Prescription Management API')
    .setDescription(
      'API documentation for the MVP Prescription Management System.',
    )
    .setVersion('1.0')
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

  // Use the validated port variable or fallback securely
  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
void bootstrap();
