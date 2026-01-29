import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'Cache-Control', 
      'Pragma',
      'Accept',
      'Accept-Language',
      'Accept-Encoding',
      'User-Agent',
      'X-Requested-With',
    ],
    credentials: true,
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

  const port = process.env.PORT || 3210;
  const server = await app.listen(port);
  
  // Set request timeout (30 seconds)
  server.setTimeout(30000);
  
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger documentation: http://localhost:${port}/api/docs`);
}

bootstrap();
