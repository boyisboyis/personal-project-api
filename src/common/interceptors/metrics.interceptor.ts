import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from '@/common/monitoring/metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MetricsInterceptor.name);

  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.metricsService.recordRequest(duration, true);
          this.metricsService.recordMetric('http_request_success', duration, {
            method,
            endpoint: this.sanitizeUrl(url),
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.metricsService.recordRequest(duration, false);
          this.metricsService.recordMetric('http_request_error', duration, {
            method,
            endpoint: this.sanitizeUrl(url),
            error: error.name,
          });
        },
      }),
    );
  }

  private sanitizeUrl(url: string): string {
    // Remove query parameters and replace dynamic segments
    return url
      .split('?')[0]
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid');
  }
}