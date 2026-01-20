import { Injectable, Logger } from '@nestjs/common';
import { AdapterRegistry } from '@/manga/adapters/adapter-registry';
import { MangaItemDto, WebsiteLastUpdatedDto, LastUpdatedResponseDto } from '@/manga/dto/last-updated.dto';
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
   * Get latest updated manga from all supported websites
   */
  async getLastUpdated(limit: number = 5): Promise<LastUpdatedResponseDto> {
    const cacheKey = CacheService.createMangaKey('all', 'last-updated', limit.toString());
    
    // Try cache first
    const cached = this.cacheService.get<LastUpdatedResponseDto>(cacheKey);
    if (cached) {
      this.logger.log('Returning cached last updated manga');
      return cached;
    }

    this.logger.log(`Fetching last updated manga from all supported websites (limit: ${limit})`);

    const allAdapters = this.adapterRegistry.getAllAdapters();
    const websites: WebsiteLastUpdatedDto[] = [];
    const fetchedAt = new Date();
    const overallStartTime = Date.now();

    // Process all adapters concurrently
    const adapterPromises = allAdapters.map(async adapter => {
      try {
        const startTime = Date.now();
        const mangas = await adapter.getLatestUpdated(limit);
        const duration = Date.now() - startTime;

        // Record metrics
        this.metricsService.recordScrape(adapter.websiteKey, duration, true, mangas.length);

        this.logger.log(`Successfully fetched ${mangas.length} manga from ${adapter.websiteName} in ${duration}ms`);

        return {
          websiteKey: adapter.websiteKey,
          websiteName: adapter.websiteName,
          mangas,
          fetchedAt,
        };
      } catch (error) {
        const duration = Date.now() - overallStartTime;
        
        // Record failure metrics
        this.metricsService.recordScrape(adapter.websiteKey, duration, false);

        this.logger.warn(`Failed to fetch manga from ${adapter.websiteName}:`, error.message);

        return {
          websiteKey: adapter.websiteKey,
          websiteName: adapter.websiteName,
          mangas: [],
          fetchedAt,
        };
      }
    });

    const results = await Promise.allSettled(adapterPromises);
    const overallDuration = Date.now() - overallStartTime;

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        websites.push(result.value);
      }
    });

    const response: LastUpdatedResponseDto = {
      websites,
      timestamp: fetchedAt,
    };

    // Cache the result (5 minutes TTL)
    this.cacheService.set(cacheKey, response, 5 * 60 * 1000);

    // Record overall metrics
    this.metricsService.recordMetric('last_updated_fetch_time', overallDuration, {
      websites: websites.length.toString(),
      successful: websites.filter(w => w.mangas.length > 0).length.toString(),
    });

    const successfulWebsites = websites.filter(w => w.mangas.length > 0).length;
    this.logger.log(`Completed fetching from ${websites.length} websites in ${overallDuration}ms. Success rate: ${((successfulWebsites / allAdapters.length) * 100).toFixed(1)}%`);

    return response;
  }

  /**
   * Search manga across specific website
   */
  async searchMangaByWebsite(websiteKey: string, query: string, limit: number = 10): Promise<MangaItemDto[]> {
    const cacheKey = CacheService.createSearchKey(websiteKey, query, limit);
    
    // Try cache first
    const cached = this.cacheService.get<MangaItemDto[]>(cacheKey);
    if (cached) {
      this.logger.log(`Returning cached search results for "${query}" on ${websiteKey}`);
      return cached;
    }

    const adapter = this.adapterRegistry.getAdapter(websiteKey);

    if (!adapter) {
      throw new Error(`Adapter not found for website: ${websiteKey}`);
    }

    this.logger.log(`Searching manga on ${adapter.websiteName} with query: "${query}"`);

    try {
      const startTime = Date.now();
      const results = await adapter.searchManga(query, limit);
      const duration = Date.now() - startTime;

      // Record metrics
      this.metricsService.recordScrape(websiteKey, duration, true, results.length);
      this.metricsService.recordMetric('search_operation', duration, {
        website: websiteKey,
        query_length: query.length.toString(),
        results: results.length.toString(),
      });

      // Cache results (3 minutes TTL for search)
      this.cacheService.set(cacheKey, results, 3 * 60 * 1000);

      this.logger.log(`Found ${results.length} manga on ${adapter.websiteName} for query: "${query}" in ${duration}ms`);
      return results;
    } catch (error) {
      const duration = Date.now() - Date.now();
      this.metricsService.recordScrape(websiteKey, duration, false);
      
      this.logger.error(`Search failed on ${adapter.websiteName}:`, error.message);
      throw error;
    }
  }

  /**
   * Search manga across all websites
   */
  async searchMangaAllWebsites(query: string, limitPerWebsite: number = 5): Promise<{ [websiteKey: string]: MangaItemDto[] }> {
    this.logger.log(`Searching manga across all websites with query: "${query}"`);

    const availableAdapters = await this.adapterRegistry.getAvailableAdapters();
    const results: { [websiteKey: string]: MangaItemDto[] } = {};

    const searchPromises = availableAdapters.map(async adapter => {
      try {
        const manga = await adapter.searchManga(query, limitPerWebsite);
        results[adapter.websiteKey] = manga;
        this.logger.debug(`Found ${manga.length} results on ${adapter.websiteName}`);
      } catch (error) {
        this.logger.error(`Search failed on ${adapter.websiteName}:`, error.message);
        results[adapter.websiteKey] = [];
      }
    });

    await Promise.all(searchPromises);

    const totalResults = Object.values(results).reduce((sum, items) => sum + items.length, 0);
    this.logger.log(`Search completed across ${availableAdapters.length} websites, found ${totalResults} total results`);

    return results;
  }

  /**
   * Get manga details from specific website
   */
  async getMangaDetails(websiteKey: string, identifier: string): Promise<MangaItemDto | null> {
    const adapter = this.adapterRegistry.getAdapter(websiteKey);

    if (!adapter) {
      throw new Error(`Adapter not found for website: ${websiteKey}`);
    }

    this.logger.log(`Fetching manga details from ${adapter.websiteName} for: ${identifier}`);

    try {
      const result = await adapter.getMangaDetails(identifier);

      if (result) {
        this.logger.log(`Found manga details: ${result.title} on ${adapter.websiteName}`);
      } else {
        this.logger.log(`Manga not found on ${adapter.websiteName} for: ${identifier}`);
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch manga details from ${adapter.websiteName}:`, error.message);
      throw error;
    }
  }

  /**
   * Check which websites are currently available
   */
  async getWebsiteAvailability(): Promise<{ [websiteKey: string]: boolean }> {
    this.logger.log('Checking availability of all websites');

    const allAdapters = this.adapterRegistry.getAllAdapters();
    const availability: { [websiteKey: string]: boolean } = {};

    const availabilityPromises = allAdapters.map(async adapter => {
      try {
        const isAvailable = await adapter.isAvailable();
        availability[adapter.websiteKey] = isAvailable;
        this.logger.debug(`${adapter.websiteName}: ${isAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}`);
      } catch (error) {
        availability[adapter.websiteKey] = false;
        this.logger.error(`Availability check failed for ${adapter.websiteName}:`, error.message);
      }
    });

    await Promise.all(availabilityPromises);

    const availableCount = Object.values(availability).filter(Boolean).length;
    this.logger.log(`Website availability check completed: ${availableCount}/${allAdapters.length} available`);

    return availability;
  }
}
