import './config/load-env-bootstrap';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';

import { ensureDatabaseDirectory } from './config/database.config';
import { AppModule } from './app.module';

async function bootstrap() {
  ensureDatabaseDirectory();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  // Headers de segurança
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:8080',
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
