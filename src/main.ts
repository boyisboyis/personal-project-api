import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

// For Vercel serverless
let app: any;

async function bootstrap() {
  if (app) {
    return app.getHttpAdapter().getInstance();
  }

  const server = express();
  app = await NestFactory.create(AppModule, new ExpressAdapter(server));

  // Use Winston logger
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global metrics interceptor
  app.useGlobalInterceptors(app.get(MetricsInterceptor));

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  );

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Swagger documentation
  const config = new DocumentBuilder().setTitle('Web Scraping API').setDescription('API for web scraping operations').setVersion('1.0').addBearerAuth().build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.init();

  // For local development
  if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    const port = process.env.PORT || 3000;
    await app.listen(port);
    console.log(`Application is running on: http://localhost:${port}`);
    console.log(`Swagger documentation: http://localhost:${port}/api/docs`);
  }

  return server;
}

// Export for Vercel
export default async (req: any, res: any) => {
  const server = await bootstrap();
  return server(req, res);
};

// For local development
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  bootstrap();
}
