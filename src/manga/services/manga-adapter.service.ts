import { Injectable, Logger } from '@nestjs/common';
import { AdapterRegistry } from '@/manga/adapters/adapter-registry';
import { WebsiteLastUpdatedDto } from '@/manga/dto/last-updated.dto';
import { SupportedWebsiteDto } from '@/manga/dto/supported-website.dto';
import { CacheService } from '@/common/cache/cache.service';
import { MetricsService } from '@/common/monitoring/metrics.service';

@Injectable()
export class MangaAdapterService {
  private readonly logger = new Logger(MangaAdapterService.name);

  constructor(
    private readonly adapterRegistry: AdapterRegistry,
    private readonly cacheService: CacheService,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Get supported websites information
   */
  async getSupportedWebsites(): Promise<SupportedWebsiteDto[]> {
    const adaptersInfo = this.adapterRegistry.getAdaptersInfo();

    return adaptersInfo.map(info => ({
      key: info.key,
      name: info.name,
      url: info.url,
    }));
  }

  /**
   * Get latest updated manga from specific website
   */
  async getLastUpdatedByWebsite(websiteKey: string, limit: number = 5): Promise<WebsiteLastUpdatedDto> {
    const cacheKey = CacheService.createMangaKey(websiteKey, 'last-updated', limit.toString());
    
    // Try cache first
    const cached = this.cacheService.get<WebsiteLastUpdatedDto>(cacheKey);
    if (cached) {
      this.logger.log(`Returning cached last updated manga for ${websiteKey}`);
      return cached;
    }

    this.logger.log(`Fetching last updated manga from ${websiteKey} (limit: ${limit})`);

    const adapter = this.adapterRegistry.getAdapter(websiteKey);
    if (!adapter) {
      throw new Error(`Adapter not found for website: ${websiteKey}`);
    }

    const fetchedAt = new Date();
    const overallStartTime = Date.now();

    try {
      const startTime = Date.now();
      const mangas = await adapter.getLatestUpdated(limit);
      const duration = Date.now() - startTime;

      // Record metrics
      this.metricsService.recordScrape(adapter.websiteKey, duration, true, mangas.length);
      this.metricsService.recordMetric('last_updated_single_operation', duration, {
        website: websiteKey,
        items: mangas.length.toString(),
      });

      const website: WebsiteLastUpdatedDto = {
        websiteKey: adapter.websiteKey,
        websiteName: adapter.websiteName,
        mangas,
        fetchedAt,
      };

      const overallDuration = Date.now() - overallStartTime;
      // Return single website object instead of array
      const response = website;

      // Cache the result (5 minutes TTL)
      this.cacheService.set(cacheKey, response, 5 * 60 * 1000);

      this.logger.log(`Successfully fetched ${mangas.length} manga from ${adapter.websiteName} in ${overallDuration}ms`);
      return response;

    } catch (error) {
      this.metricsService.recordScrape(adapter.websiteKey, Date.now() - overallStartTime, false);
      this.logger.error(`Failed to fetch from ${adapter.websiteName}:`, error.message);
      
      // Return empty result instead of throwing error
      return {
        websiteKey: adapter.websiteKey,
        websiteName: adapter.websiteName,
        mangas: [],
        fetchedAt,
      };
    }
  }
}
