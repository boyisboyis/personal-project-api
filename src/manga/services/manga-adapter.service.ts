import { Injectable, Logger } from '@nestjs/common';
import { AdapterRegistry } from '@/manga/adapters/adapter-registry';
import { WebsiteLastUpdatedDto } from '@/manga/dto/last-updated.dto';
import { SupportedWebsiteDto } from '@/manga/dto/supported-website.dto';
import { MetricsService } from '@/common/monitoring/metrics.service';

@Injectable()
export class MangaAdapterService {
  private readonly logger = new Logger(MangaAdapterService.name);

  constructor(
    private readonly adapterRegistry: AdapterRegistry,
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
  async getLastUpdatedByWebsite(websiteKey: string, limit: number = 5, page: number = 1): Promise<WebsiteLastUpdatedDto> {
    this.logger.log(`Fetching last updated manga from ${websiteKey} (page: ${page}) with limit ${limit})`);

    const adapter = this.adapterRegistry.getAdapter(websiteKey);
    if (!adapter) {
      throw new Error(`Adapter not found for website: ${websiteKey}`);
    }

    const fetchedAt = new Date();
    const overallStartTime = Date.now();

    try {
      const startTime = Date.now();
      const mangas = await adapter.getLatestUpdated(page, limit);
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

      this.logger.log(`Successfully fetched ${mangas.length} manga from ${adapter.websiteName} in ${overallDuration}ms`);

      return response;
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

  /**
   * Get latest updated manga from all websites
   */
  async getAllLastUpdated(limit: number = 5): Promise<WebsiteLastUpdatedDto[]> {
    this.logger.log(`Fetching last updated manga from all websites (limit: ${limit})`);

    const adapters = this.adapterRegistry.getAllAdapters();
    const results: WebsiteLastUpdatedDto[] = [];
    const overallStartTime = Date.now();

    // Fetch from all adapters in parallel
    const promises = adapters.map(async adapter => {
      try {
        const startTime = Date.now();
        const mangas = await adapter.getLatestUpdated(1, limit);
        const duration = Date.now() - startTime;

        this.metricsService.recordScrape(adapter.websiteKey, duration, true, mangas.length);

        return {
          websiteKey: adapter.websiteKey,
          websiteName: adapter.websiteName,
          mangas,
          fetchedAt: new Date(),
        };
      } catch (error) {
        this.metricsService.recordScrape(adapter.websiteKey, Date.now() - overallStartTime, false);
        this.logger.error(`Failed to fetch from ${adapter.websiteName}:`, error.message);
        
        // Return empty result for failed adapters
        return {
          websiteKey: adapter.websiteKey,
          websiteName: adapter.websiteName,
          mangas: [],
          fetchedAt: new Date(),
        };
      }
    });

    const websiteResults = await Promise.all(promises);
    results.push(...websiteResults);

    const overallDuration = Date.now() - overallStartTime;
    const totalManga = results.reduce((sum, site) => sum + site.mangas.length, 0);

    this.logger.log(`Successfully fetched ${totalManga} manga from ${results.length} websites in ${overallDuration}ms`);
    return results;
  }

  /**
   * Get manga details from specific website using manga key
   */
  async getMangaDetails(websiteKey: string, mangaKey: string) {
    this.logger.log(`Fetching manga details for ${mangaKey} from ${websiteKey}`);

    const adapter = this.adapterRegistry.getAdapter(websiteKey);
    if (!adapter) {
      throw new Error(`Adapter not found for website: ${websiteKey}`);
    }

    const startTime = Date.now();
    
    try {
      const mangaDetails = await adapter.getMangaDetails(mangaKey);
      const duration = Date.now() - startTime;

      // Record metrics
      this.metricsService.recordScrape(adapter.websiteKey, duration, true, mangaDetails ? 1 : 0);
      this.metricsService.recordMetric('manga_details_operation', duration, {
        website: websiteKey,
        found: mangaDetails ? 'true' : 'false',
      });

      if (!mangaDetails) {
        this.logger.warn(`Manga details not found for ${mangaKey} from ${adapter.websiteName}`);
        return null;
      }

      this.logger.log(`Successfully fetched manga details for ${mangaKey} from ${adapter.websiteName} in ${duration}ms`);
      return mangaDetails;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metricsService.recordScrape(adapter.websiteKey, duration, false);
      this.logger.error(`Failed to fetch manga details for ${mangaKey} from ${adapter.websiteName}:`, error.message);
      throw error;
    }
  }
}
