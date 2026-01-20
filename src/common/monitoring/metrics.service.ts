import { Injectable, Logger } from '@nestjs/common';

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  requestsPerMinute: number;
}

export interface AdapterMetrics {
  [websiteKey: string]: {
    totalScrapes: number;
    successfulScrapes: number;
    failedScrapes: number;
    averageScrapingTime: number;
    lastScrapeTime?: number;
    errorRate: number;
  };
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private metrics: PerformanceMetric[] = [];
  private requestMetrics: RequestMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    requestsPerMinute: 0,
  };
  private adapterMetrics: AdapterMetrics = {};
  private readonly maxMetrics = 1000;
  private readonly startTime = Date.now();

  /**
   * Record a performance metric
   */
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      tags,
    };

    this.metrics.push(metric);

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    this.logger.debug(`Metric recorded: ${name} = ${value}`, tags);
  }

  /**
   * Record request metrics
   */
  recordRequest(responseTime: number, success: boolean): void {
    this.requestMetrics.totalRequests++;
    
    if (success) {
      this.requestMetrics.successfulRequests++;
    } else {
      this.requestMetrics.failedRequests++;
    }

    // Update average response time (exponential moving average)
    const alpha = 0.1; // Smoothing factor
    if (this.requestMetrics.averageResponseTime === 0) {
      this.requestMetrics.averageResponseTime = responseTime;
    } else {
      this.requestMetrics.averageResponseTime = 
        alpha * responseTime + (1 - alpha) * this.requestMetrics.averageResponseTime;
    }

    // Calculate requests per minute
    const uptimeMinutes = (Date.now() - this.startTime) / (1000 * 60);
    this.requestMetrics.requestsPerMinute = this.requestMetrics.totalRequests / Math.max(uptimeMinutes, 1);

    this.recordMetric('http_request_duration', responseTime, { success: success.toString() });
  }

  /**
   * Record adapter scraping metrics
   */
  recordScrape(websiteKey: string, scrapingTime: number, success: boolean, itemsScraped?: number): void {
    if (!this.adapterMetrics[websiteKey]) {
      this.adapterMetrics[websiteKey] = {
        totalScrapes: 0,
        successfulScrapes: 0,
        failedScrapes: 0,
        averageScrapingTime: 0,
        errorRate: 0,
      };
    }

    const metrics = this.adapterMetrics[websiteKey];
    metrics.totalScrapes++;
    metrics.lastScrapeTime = Date.now();

    if (success) {
      metrics.successfulScrapes++;
    } else {
      metrics.failedScrapes++;
    }

    // Update average scraping time
    const alpha = 0.1;
    if (metrics.averageScrapingTime === 0) {
      metrics.averageScrapingTime = scrapingTime;
    } else {
      metrics.averageScrapingTime = 
        alpha * scrapingTime + (1 - alpha) * metrics.averageScrapingTime;
    }

    // Calculate error rate
    metrics.errorRate = (metrics.failedScrapes / metrics.totalScrapes) * 100;

    this.recordMetric('scraping_duration', scrapingTime, { 
      website: websiteKey, 
      success: success.toString(),
      items: itemsScraped?.toString() || '0' 
    });
  }

  /**
   * Get metrics by name
   */
  getMetrics(name?: string, limit?: number): PerformanceMetric[] {
    let filtered = name ? this.metrics.filter(m => m.name === name) : this.metrics;
    
    if (limit) {
      filtered = filtered.slice(-limit);
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get request metrics summary
   */
  getRequestMetrics(): RequestMetrics & { successRate: number } {
    const successRate = this.requestMetrics.totalRequests > 0 
      ? (this.requestMetrics.successfulRequests / this.requestMetrics.totalRequests) * 100 
      : 0;

    return {
      ...this.requestMetrics,
      successRate,
    };
  }

  /**
   * Get adapter metrics
   */
  getAdapterMetrics(): AdapterMetrics {
    return { ...this.adapterMetrics };
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => m.timestamp > oneHourAgo);

    const metricsByName: Record<string, number[]> = {};
    recentMetrics.forEach(metric => {
      if (!metricsByName[metric.name]) {
        metricsByName[metric.name] = [];
      }
      metricsByName[metric.name].push(metric.value);
    });

    const summary: Record<string, any> = {};
    Object.entries(metricsByName).forEach(([name, values]) => {
      summary[name] = {
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((sum, val) => sum + val, 0) / values.length,
        p95: this.percentile(values, 95),
        p99: this.percentile(values, 99),
      };
    });

    return {
      timeWindow: '1h',
      totalMetrics: recentMetrics.length,
      uniqueMetrics: Object.keys(metricsByName).length,
      metrics: summary,
      requests: this.getRequestMetrics(),
      adapters: this.getAdapterMetrics(),
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    
    if (Math.floor(index) === index) {
      return sorted[index];
    } else {
      const lower = sorted[Math.floor(index)];
      const upper = sorted[Math.ceil(index)];
      return lower + (upper - lower) * (index - Math.floor(index));
    }
  }

  /**
   * Clear old metrics
   */
  cleanup(): void {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const oldLength = this.metrics.length;
    this.metrics = this.metrics.filter(m => m.timestamp > oneHourAgo);
    const removed = oldLength - this.metrics.length;
    
    if (removed > 0) {
      this.logger.debug(`Cleaned up ${removed} old metrics`);
    }
  }

  /**
   * Export metrics in Prometheus format (basic)
   */
  exportPrometheusMetrics(): string {
    const lines: string[] = [];
    
    // Request metrics
    const requestMetrics = this.getRequestMetrics();
    lines.push(`# HELP http_requests_total Total number of HTTP requests`);
    lines.push(`# TYPE http_requests_total counter`);
    lines.push(`http_requests_total{status="success"} ${requestMetrics.successfulRequests}`);
    lines.push(`http_requests_total{status="error"} ${requestMetrics.failedRequests}`);
    
    lines.push(`# HELP http_request_duration_average Average HTTP request duration in milliseconds`);
    lines.push(`# TYPE http_request_duration_average gauge`);
    lines.push(`http_request_duration_average ${requestMetrics.averageResponseTime}`);

    // Adapter metrics
    Object.entries(this.adapterMetrics).forEach(([website, metrics]) => {
      lines.push(`# HELP scraping_total Total number of scraping operations`);
      lines.push(`# TYPE scraping_total counter`);
      lines.push(`scraping_total{website="${website}",status="success"} ${metrics.successfulScrapes}`);
      lines.push(`scraping_total{website="${website}",status="error"} ${metrics.failedScrapes}`);
      
      lines.push(`# HELP scraping_duration_average Average scraping duration in milliseconds`);
      lines.push(`# TYPE scraping_duration_average gauge`);
      lines.push(`scraping_duration_average{website="${website}"} ${metrics.averageScrapingTime}`);
      
      lines.push(`# HELP scraping_error_rate Error rate percentage for scraping operations`);
      lines.push(`# TYPE scraping_error_rate gauge`);
      lines.push(`scraping_error_rate{website="${website}"} ${metrics.errorRate}`);
    });

    return lines.join('\n') + '\n';
  }
}