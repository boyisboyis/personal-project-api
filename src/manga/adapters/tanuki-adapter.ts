import { Injectable } from '@nestjs/common';
import { BaseMangaAdapter } from '@/manga/adapters/base/base-manga-adapter';
import { MangaItemDto } from '@/manga/dto/last-updated.dto';
import { MangaPuppeteerService } from '@/manga/services/manga-puppeteer-improved.service';
import { Page } from 'puppeteer';

@Injectable()
export class TanukiAdapter extends BaseMangaAdapter {
  readonly websiteKey = 'tanuki';
  readonly websiteName = 'Tanuki Manga';
  readonly websiteUrl = 'https://www.tanuki-manga.com';

  constructor(private readonly mangaPuppeteerService: MangaPuppeteerService) {
    super();
    this.setPuppeteerService(mangaPuppeteerService);
  }

  async getLatestUpdated(page: number = 1, limit: number = 5): Promise<MangaItemDto[]> {
    try {
      this.logOperation(`Fetching latest ${limit} manga`);

      // Use real scraping with more specific configuration for Tanuki Manga
      const latestUrl = `${this.websiteUrl}/page/${page}`;
      const scrapedData = await this.scrapeMangaListWithPuppeteer(latestUrl, limit, {
        waitForSelector: '#content',
        delay: { min: 2000, max: 3000 }, // Longer delay for Tanuki Manga
        timeout: 45000, // Longer timeout
      });

      this.logOperation(`Successfully scraped ${scrapedData.length} manga from real website`);
      return scrapedData;
    } catch (error) {
      this.logger.warn(`Failed to scrape from ${this.websiteName}, returning mock data:`, error.message);
      // Return fallback mock data
      return [];
    }
  }

  async searchManga(query: string, limit: number = 10): Promise<MangaItemDto[]> {
    try {
      this.logOperation(`Searching manga with query: "${query}"`);

      // Use search URL if available
      const searchUrl = `${this.websiteUrl}/search?q=${encodeURIComponent(query)}`;
      const scrapedData = await this.scrapeMangaListWithPuppeteer(searchUrl, limit, {
        waitForSelector: '.search-results, .manga-grid, .manga-list',
        delay: { min: 1000, max: 2000 },
      });

      this.logOperation(`Found ${scrapedData.length} manga for query: "${query}" (scraped)`);
      return scrapedData;
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
   * Extract manga data from Tanuki Manga website
   */
  async extractMangaData(page: Page, baseUrl: string, limit: number = 10): Promise<MangaItemDto[]> {
    console.log('Extracting manga data for Tanuki Manga');

    // Enable console logging from page for debugging
    page.on('console', async msg => {
      const msgArgs = msg.args();
      for (let i = 0; i < msgArgs.length; ++i) {
        console.log(await msgArgs[i].jsonValue());
      }
    });

    return await page.evaluate(limit => {
      const results: any[] = [];

      // Try multiple possible selectors for Tanuki Manga
      const possibleSelectors = [
        {
          container: '#content div.bs',
          title: 'div.tt',
          link: 'div.bsx > a',
          chapter: 'div.adds > div.epxs',
          image: 'img.ts-post-image',
          author: 'div.tt',
          lastUpdated: 'div.epxdate',
        },
      ];

      let containers: NodeListOf<Element> | null = null;
      let usedSelectors: any = null;

      // Try each selector set until we find content
      for (const selectors of possibleSelectors) {
        containers = document.querySelectorAll(selectors.container);
        if (containers.length > 0) {
          usedSelectors = selectors;
          console.log(`Found ${containers.length} containers using selector: ${selectors.container}`);
          break;
        }
      }

      if (!containers || containers.length === 0 || !usedSelectors) {
        console.log('No manga containers found, trying generic approach');
        // Fallback to very generic selectors
        containers = document.querySelectorAll('article, .post, div[class*="item"], div[class*="card"]');
        usedSelectors = {
          container: 'article, .post, div[class*="item"], div[class*="card"]',
          title: 'h1, h2, h3, h4, .title, [class*="title"]',
          link: 'a',
          chapter: '.chapter, .ch, .episode, [class*="chapter"], [class*="episode"]',
          image: 'img',
          author: '.author, .creator, [class*="author"], [class*="creator"]',
          lastUpdated: '.date, .time, [class*="date"], [class*="time"], [class*="updated"]',
        };
      }

      console.log(`Processing ${containers.length} containers with limit: ${limit}`);

      containers.forEach((container, index) => {
        if (results.length >= limit) return;

        try {
          const titleEl = container.querySelector(usedSelectors.title);
          const linkEl = container.querySelector(usedSelectors.link);
          const chapterEl = container.querySelector(usedSelectors.chapter);
          const imageEl = container.querySelector(usedSelectors.image);
          const authorEl = container.querySelector(usedSelectors.author);
          const lastUpdatedEl = container.querySelector(usedSelectors.lastUpdated);

          const title = titleEl?.textContent?.trim();
          const url = linkEl?.getAttribute('href');

          if (title && title.length > 0) {
            results.push({
              id: `tanuki-${index + 1}`,
              title,
              author: authorEl?.textContent?.trim(),
              coverImage: imageEl?.getAttribute('src') || imageEl?.getAttribute('data-src'),
              latestChapter: chapterEl ? parseInt(chapterEl.textContent?.replace(/\D/g, '') || '0') || undefined : undefined,
              lastUpdated: lastUpdatedEl?.textContent?.trim() || undefined,
              url: url ? (url.startsWith('http') ? url : `${window.location.origin}${url}`) : undefined,
            });
          }
        } catch (error) {
          console.warn(`Error extracting manga item at index ${index}:`, error);
        }
      });

      console.log(`Successfully extracted ${results.length} manga items`);
      return results;
    }, limit);
  }
}
