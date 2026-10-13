import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
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
