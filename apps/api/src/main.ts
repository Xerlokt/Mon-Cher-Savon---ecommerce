import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { resolve } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { loadConfig } from './config.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  if (config.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.useStaticAssets(resolve(config.UPLOAD_DIR), {
    prefix: '/uploads',
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  });
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: process.env['WEB_ORIGIN'] ?? 'http://localhost:3000',
    credentials: true,
  });
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Mon Cher Savon API').setVersion('1').build(),
  );
  SwaggerModule.setup('api/docs', app, doc);
  await app.listen(Number(process.env['API_PORT'] ?? 3001));
}

void bootstrap();
