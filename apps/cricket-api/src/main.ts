import 'reflect-metadata';
import { config } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
config({ path: join(root, '.env') });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors();

  const swagger = new DocumentBuilder()
    .setTitle('Cricket Insight API')
    .setDescription('Cricket data business services for CricInsights')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  const port = Number(process.env.CRICKET_API_PORT ?? process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`Cricket API listening on http://localhost:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/docs`);
}

bootstrap();
