import { Injectable } from '@nestjs/common';
import { BaseMangaAdapter } from '@/manga/adapters/base/base-manga-adapter';
import { MangaItemDto } from '@/manga/dto/last-updated.dto';
import { MangaPuppeteerService } from '@/manga/services/manga-puppeteer-improved.service';

@Injectable()
export class NiceoppaiAdapter extends BaseMangaAdapter {
  readonly websiteKey = 'niceoppai';
  readonly websiteName = 'Niceoppai';
  readonly websiteUrl = 'https://www.niceoppai.net';

  constructor(private readonly mangaPuppeteerService: MangaPuppeteerService) {
    super();
    this.setPuppeteerService(mangaPuppeteerService);
  }

  async getLatestUpdated(limit: number = 5): Promise<MangaItemDto[]> {
    try {
      this.logOperation(`Fetching latest ${limit} manga`);

      // Option 1: Use real scraping (uncomment to enable)
      const latestUrl = `${this.websiteUrl}`;
      const scrapedData = await this.scrapeMangaListWithPuppeteer(latestUrl, limit, {
        waitForSelector: '#text-4',
        delay: { min: 800, max: 1500 },
      });
      // if (scrapedData.length > 0) {
      // this.logOperation(`Successfully scraped ${scrapedData.length} manga from real website`);
      // }
      return scrapedData;

      // Option 2: Fallback to mock data (current implementation)
      // await this.simulateNetworkDelay();

      // Sort by lastUpdated descending and take the limit
      // const result = this.mockMangaData.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime()).slice(0, limit);

      // this.logOperation(`Successfully fetched ${result.length} manga (using mock data)`);
      // return result;
    } catch (error) {
      console.error('Error in getLatestUpdated:', error);
      this.handleError('getLatestUpdated', error);
    }
  }

  async searchManga(query: string, limit: number = 10): Promise<MangaItemDto[]> {
    try {
      this.logOperation(`Searching manga with query: "${query}"`);

      // Option 1: Use real scraping (uncomment to enable)
      const searchUrl = `${this.websiteUrl}/search?q=${encodeURIComponent(query)}`;
      const scrapedData = await this.scrapeMangaListWithPuppeteer(searchUrl, limit, {
        waitForSelector: '.search-results, .manga-grid',
        delay: { min: 1000, max: 2000 },
      });
      // if (scrapedData.length > 0) {
      this.logOperation(`Found ${scrapedData.length} manga for query: "${query}" (scraped)`);
      return scrapedData;
      // }

      // Option 2: Fallback to mock data search
      // await this.simulateNetworkDelay();

      // const searchTerm = query.toLowerCase();
      // const result = this.mockMangaData
      //   .filter(manga => manga.title.toLowerCase().includes(searchTerm) || (manga.author && manga.author.toLowerCase().includes(searchTerm)))
      //   .slice(0, limit);

      // this.logOperation(`Found ${result.length} manga for query: "${query}" (using mock data)`);
      // return result;
    } catch (error) {
      this.handleError('searchManga', error);
    }
  }

  async getMangaDetails(identifier: string): Promise<MangaItemDto | null> {
    try {
      this.logOperation(`Fetching manga details for: ${identifier}`);
      this.logOperation(`Manga details not implemented - returning null`);
      return null;
    } catch (error) {
      this.handleError('getMangaDetails', error);
    }
    return null;
  }

  async isAvailable(): Promise<boolean> {
    try {
      this.logOperation('Checking availability');
      await this.simulateNetworkDelay(100, 300);

      // Simulate occasional unavailability (5% chance)
      const isAvailable = Math.random() > 0.05;

      this.logOperation(`Availability check: ${isAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}`);
      return isAvailable;
    } catch (error) {
      this.logger.warn(`[${this.websiteKey}] Availability check failed:`, error.message);
      return false;
    }
  }
}
