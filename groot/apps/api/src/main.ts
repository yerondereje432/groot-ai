/**
 * Groot API — entry point.
 * Per spec §26: REST + JSON, error envelope, /api/v1 prefix.
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.enableCors();

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`GROOT API listening on http://0.0.0.0:${port}/api/v1`, 'Bootstrap');
}

bootstrap().catch(err => {
  console.error('API failed to start', err);
  process.exit(1);
});
