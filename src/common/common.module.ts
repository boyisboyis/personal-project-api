import { Module, Global } from '@nestjs/common';
import { CacheService } from './cache/cache.service';
import { MetricsService } from './monitoring/metrics.service';
import { MetricsController } from './monitoring/metrics.controller';
import { MetricsInterceptor } from './interceptors/metrics.interceptor';

@Global()
@Module({
  providers: [CacheService, MetricsService, MetricsInterceptor],
  controllers: [MetricsController],
  exports: [CacheService, MetricsService, MetricsInterceptor],
})
export class CommonModule {}