import { Injectable, Logger } from '@nestjs/common';
import { AdapterRegistry } from '@/manga/adapters/adapter-registry';
import { CacheService } from '@/common/cache/cache.service';

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  message?: string;
  lastChecked: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();

  constructor(
    private readonly adapterRegistry: AdapterRegistry,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get overall health status
   */
  async getHealthStatus() {
    const services = await this.getServicesStatus();
    const system = this.getSystemInfo();
    
    // Determine overall status
    const serviceStatuses = Object.values(services).map(s => s.status);
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (serviceStatuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (serviceStatuses.includes('degraded')) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services,
      system,
    };
  }

  /**
   * Check if service is ready to handle requests
   */
  async checkReadiness(): Promise<boolean> {
    try {
      const services = await this.getServicesStatus();
      return !Object.values(services).some(s => s.status === 'unhealthy');
    } catch (error) {
      this.logger.error('Readiness check failed:', error);
      return false;
    }
  }

  /**
   * Get status of all services
   */
  async getServicesStatus(): Promise<{ [key: string]: ServiceHealth }> {
    const services: { [key: string]: ServiceHealth } = {};

    // Check manga adapters
    await this.checkAdapters(services);
    
    // Check cache service
    this.checkCache(services);

    // Check system resources
    this.checkSystem(services);

    return services;
  }

  /**
   * Check manga adapters availability
   */
  private async checkAdapters(services: { [key: string]: ServiceHealth }): Promise<void> {
    try {
      const adapters = this.adapterRegistry.getAllAdapters();
      
      for (const adapter of adapters) {
        const startTime = Date.now();
        try {
          const isAvailable = await Promise.race([
            adapter.isAvailable(),
            new Promise<boolean>((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 5000)
            ),
          ]);
          
          const responseTime = Date.now() - startTime;
          
          services[`adapter_${adapter.websiteKey}`] = {
            status: isAvailable ? 'healthy' : 'degraded',
            responseTime,
            message: isAvailable ? 'Available' : 'Unavailable',
            lastChecked: new Date().toISOString(),
          };
        } catch (error) {
          services[`adapter_${adapter.websiteKey}`] = {
            status: 'unhealthy',
            responseTime: Date.now() - startTime,
            message: error.message,
            lastChecked: new Date().toISOString(),
          };
        }
      }
    } catch (error) {
      services.adapters = {
        status: 'unhealthy',
        message: `Failed to check adapters: ${error.message}`,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Check cache service
   */
  private checkCache(services: { [key: string]: ServiceHealth }): void {
    try {
      const stats = this.cacheService.getStats();
      const size = this.cacheService.getSize();
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = `${stats.entries} entries, ${(size.approximateBytes / 1024).toFixed(2)}KB`;
      
      if (size.approximateBytes > 50 * 1024 * 1024) { // 50MB
        status = 'degraded';
        message += ' (high memory usage)';
      }
      
      if (stats.entries > 900) { // Near max capacity
        status = 'degraded';
        message += ' (near capacity)';
      }

      services.cache = {
        status,
        message,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      services.cache = {
        status: 'unhealthy',
        message: `Cache check failed: ${error.message}`,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Check system resources
   */
  private checkSystem(services: { [key: string]: ServiceHealth }): void {
    try {
      const memory = process.memoryUsage();
      const memoryUsageMB = memory.heapUsed / 1024 / 1024;
      const memoryTotalMB = memory.heapTotal / 1024 / 1024;
      const memoryPercentage = (memoryUsageMB / memoryTotalMB) * 100;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = `Memory: ${memoryUsageMB.toFixed(2)}MB/${memoryTotalMB.toFixed(2)}MB (${memoryPercentage.toFixed(1)}%)`;

      if (memoryPercentage > 85) {
        status = 'unhealthy';
        message += ' - Critical memory usage';
      } else if (memoryPercentage > 70) {
        status = 'degraded';
        message += ' - High memory usage';
      }

      services.system = {
        status,
        message,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      services.system = {
        status: 'unhealthy',
        message: `System check failed: ${error.message}`,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Get system information
   */
  private getSystemInfo() {
    const memory = process.memoryUsage();
    const memoryUsedMB = memory.heapUsed / 1024 / 1024;
    const memoryTotalMB = memory.heapTotal / 1024 / 1024;

    return {
      memory: {
        used: Math.round(memoryUsedMB),
        total: Math.round(memoryTotalMB),
        percentage: Math.round((memoryUsedMB / memoryTotalMB) * 100),
      },
      cpu: {
        usage: Math.round(process.cpuUsage().user / 1000), // Convert to ms
      },
    };
  }

  /**
   * Get performance metrics
   */
  async getMetrics() {
    const memory = process.memoryUsage();
    const cacheStats = this.cacheService.getStats();
    const cacheSize = this.cacheService.getSize();
    const uptime = Date.now() - this.startTime;

    return {
      uptime,
      memory: {
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        external: memory.external,
        rss: memory.rss,
      },
      cache: {
        ...cacheStats,
        size: cacheSize,
      },
      process: {
        pid: process.pid,
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      adapters: {
        total: this.adapterRegistry.getAllAdapters().length,
        available: await this.countAvailableAdapters(),
      },
    };
  }

  /**
   * Count available adapters
   */
  private async countAvailableAdapters(): Promise<number> {
    try {
      const adapters = this.adapterRegistry.getAllAdapters();
      const availabilityChecks = await Promise.allSettled(
        adapters.map(adapter => adapter.isAvailable())
      );
      
      return availabilityChecks.filter(
        result => result.status === 'fulfilled' && result.value
      ).length;
    } catch (error) {
      this.logger.error('Error counting available adapters:', error);
      return 0;
    }
  }
}