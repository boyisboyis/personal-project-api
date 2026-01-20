import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    [key: string]: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      responseTime?: number;
      message?: string;
      lastChecked: string;
    };
  };
  system: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
  };
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Overall health check' })
  @ApiResponse({
    status: 200,
    description: 'System health information',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
        timestamp: { type: 'string' },
        uptime: { type: 'number' },
        version: { type: 'string' },
        environment: { type: 'string' },
        services: { type: 'object' },
        system: { type: 'object' },
      },
    },
  })
  async healthCheck(): Promise<HealthCheckResult> {
    return this.healthService.getHealthStatus();
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({
    status: 200,
    description: 'Service is alive',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'alive' },
        timestamp: { type: 'string' },
      },
    },
  })
  async liveness() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiResponse({
    status: 200,
    description: 'Service is ready to handle requests',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ready' },
        timestamp: { type: 'string' },
        services: { type: 'object' },
      },
    },
  })
  async readiness() {
    const ready = await this.healthService.checkReadiness();
    return {
      status: ready ? 'ready' : 'not-ready',
      timestamp: new Date().toISOString(),
      services: await this.healthService.getServicesStatus(),
    };
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Basic metrics' })
  @ApiResponse({
    status: 200,
    description: 'System metrics',
  })
  async metrics() {
    return this.healthService.getMetrics();
  }
}