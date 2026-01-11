/**
 * DevFlow API Entry Point
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from '@/app.module';
import { createLogger, validateConfig } from '@devflow/common';

const logger = createLogger('Bootstrap');

async function bootstrap() {
  // Validate configuration before starting server
  try {
    validateConfig();
  } catch (error) {
    logger.error('Configuration validation failed. Please check your environment variables.', error as Error);
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule, {
    // Disable default body parser so we can configure limits
    bodyParser: false,
    rawBody: true,
  });

  // Configure body parser with increased limits (Linear webhook payloads can be large)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const bodyParser = require('body-parser');
  app.use(bodyParser.json({ limit: '5mb' }));
  app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));

  // Security
  app.use(helmet());

  // Cookie parser (for session cookies)
  app.use(cookieParser());

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix(process.env.API_GLOBAL_PREFIX || 'api/v1');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('DevFlow API')
    .setDescription('Universal DevOps orchestrator API')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || process.env.API_PORT || 3000;
  await app.listen(port);

  logger.info(`🚀 DevFlow API running on http://localhost:${port}`);
  logger.info(`📚 API docs available at http://localhost:${port}/docs`);
}

bootstrap();

