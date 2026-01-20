import { Injectable, Logger } from '@nestjs/common';
import { AdapterRegistry } from '@/manga/adapters/adapter-registry';
import { MangaItemDto, WebsiteLastUpdatedDto, LastUpdatedResponseDto } from '@/manga/dto/last-updated.dto';
import { SupportedWebsiteDto } from '@/manga/dto/supported-website.dto';

@Injectable()
export class MangaAdapterService {
  private readonly logger = new Logger(MangaAdapterService.name);

  constructor(private readonly adapterRegistry: AdapterRegistry) {}

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
    this.logger.log(`Fetching last updated manga from all supported websites (limit: ${limit})`);

    const allAdapters = this.adapterRegistry.getAllAdapters();
    const websites: WebsiteLastUpdatedDto[] = [];
    const fetchedAt = new Date();

    // Process all adapters concurrently
    const adapterPromises = allAdapters.map(async adapter => {
      try {
        const startTime = Date.now();
        const mangas = await adapter.getLatestUpdated(limit);
        const duration = Date.now() - startTime;

        this.logger.log(`Successfully fetched ${mangas.length} manga from ${adapter.websiteName} in ${duration}ms`);

        return {
          websiteKey: adapter.websiteKey,
          websiteName: adapter.websiteName,
          mangas,
          fetchedAt,
        };
      } catch (error) {
        this.logger.error(`Failed to fetch data from ${adapter.websiteName}:`, error.message);

        // Return empty result for failed adapter
        return {
          websiteKey: adapter.websiteKey,
          websiteName: adapter.websiteName,
          mangas: [],
          fetchedAt,
        };
      }
    });

    const results = await Promise.all(adapterPromises);
    websites.push(...results);

    const totalManga = websites.reduce((sum, site) => sum + site.mangas.length, 0);
    this.logger.log(`Completed fetching from ${websites.length} websites, total ${totalManga} manga items`);

    return {
      websites,
      timestamp: fetchedAt,
    };
  }

  /**
   * Search manga across specific website
   */
  async searchMangaByWebsite(websiteKey: string, query: string, limit: number = 10): Promise<MangaItemDto[]> {
    const adapter = this.adapterRegistry.getAdapter(websiteKey);

    if (!adapter) {
      throw new Error(`Adapter not found for website: ${websiteKey}`);
    }

    this.logger.log(`Searching manga on ${adapter.websiteName} with query: "${query}"`);

    try {
      const results = await adapter.searchManga(query, limit);
      this.logger.log(`Found ${results.length} manga on ${adapter.websiteName} for query: "${query}"`);
      return results;
    } catch (error) {
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
