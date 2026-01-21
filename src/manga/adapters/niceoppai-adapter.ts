import { Injectable } from '@nestjs/common';
import { BaseMangaAdapter } from '@/manga/adapters/base/base-manga-adapter';
import { MangaItemDto } from '@/manga/dto/last-updated.dto';
import { MangaPuppeteerService } from '@/manga/services/manga-puppeteer-improved.service';
import { Page } from 'puppeteer';

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
      const latestUrl = `${this.websiteUrl}/manga_list/all/any/last-updated/1/`;
      const scrapedData = await this.scrapeMangaListWithPuppeteer(latestUrl, limit, {
        waitForSelector: '#sct_content',
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

  /**
   * Extract manga data from Niceoppai website
   */
  async extractMangaData(page: Page, baseUrl: string, limit: number = 10): Promise<MangaItemDto[]> {
    console.log('Extracting manga data for Niceoppai');
    
    // Enable console logging from page for debugging
    page.on('console', async msg => {
      const msgArgs = msg.args();
      for (let i = 0; i < msgArgs.length; ++i) {
        console.log(await msgArgs[i].jsonValue());
      }
    });

    return await page.evaluate(
      (limit) => {
        const results: any[] = [];
        const selectors = {
          container: '#sct_content div.nde',
          title: 'a.ttl',
          link: 'a.ttl',
          chapter: 'div.det > ul > li:nth-child(1) > a',
          image: 'div.cvr > a > img',
          author: 'a.ttl',
        };

        const containers = document.querySelectorAll(selectors.container);
        console.log(`Found ${containers.length} manga containers on the page. Limit: ${limit}`);

        containers.forEach((container, index) => {
          if (results.length >= limit) return;

          try {
            const titleEl = container.querySelector(selectors.title);
            const linkEl = container.querySelector(selectors.link);
            let chapterEl = container.querySelector(selectors.chapter);
            const imageEl = container.querySelector(selectors.image);
            const authorEl = container.querySelector(selectors.author);

            const title = titleEl?.textContent?.trim();
            const url = linkEl?.getAttribute('href');

            // Special handling for Niceoppai chapter format
            if (chapterEl) {
              const spanEl = chapterEl.querySelector('span');
              if (spanEl) {
                spanEl.remove();
              }
            }

            if (title) {
              results.push({
                id: `niceoppai-${index + 1}`,
                title,
                author: authorEl?.textContent?.trim(),
                coverImage: imageEl?.getAttribute('src'),
                latestChapter: chapterEl ? parseInt(chapterEl.textContent?.replace(/\D/g, '') || '0') || undefined : undefined,
                lastUpdated: undefined, // Niceoppai doesn't provide lastUpdated in this format
                url: url ? (url.startsWith('http') ? url : `${window.location.origin}${url}`) : undefined,
              });
            }
          } catch (error) {
            console.warn(`Error extracting manga item at index ${index}:`, error);
          }
        });

        console.log(`Successfully extracted ${results.length} manga items`);
        return results;
      },
      limit
    );
  }
}
