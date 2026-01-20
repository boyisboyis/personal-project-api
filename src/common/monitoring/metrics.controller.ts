import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MetricsService } from '@/common/monitoring/metrics.service';

@ApiTags('Monitoring')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @ApiOperation({ summary: 'Get application metrics' })
  @ApiResponse({
    status: 200,
    description: 'Application performance metrics',
  })
  async getMetrics() {
    return this.metricsService.getMetricsSummary();
  }

  @Get('requests')
  @ApiOperation({ summary: 'Get request metrics' })
  async getRequestMetrics() {
    return this.metricsService.getRequestMetrics();
  }

  @Get('adapters')
  @ApiOperation({ summary: 'Get adapter metrics' })
  async getAdapterMetrics() {
    return this.metricsService.getAdapterMetrics();
  }

  @Get('prometheus')
  @ApiOperation({ summary: 'Get metrics in Prometheus format' })
  @ApiResponse({
    status: 200,
    description: 'Metrics in Prometheus exposition format',
    headers: {
      'Content-Type': {
        description: 'text/plain',
      },
    },
  })
  async getPrometheusMetrics() {
    return this.metricsService.exportPrometheusMetrics();
  }
}