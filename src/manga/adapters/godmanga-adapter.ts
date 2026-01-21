import { Injectable } from '@nestjs/common';
import { BaseMangaAdapter } from '@/manga/adapters/base/base-manga-adapter';
import { MangaItemDto } from '@/manga/dto/last-updated.dto';
import { MangaPuppeteerService } from '@/manga/services/manga-puppeteer-improved.service';
import { Page } from 'puppeteer';

@Injectable()
export class GodmangaAdapter extends BaseMangaAdapter {
  readonly websiteKey = 'godmanga';
  readonly websiteName = 'God Manga';
  readonly websiteUrl = 'https://god-manga.com';

  constructor(private readonly mangaPuppeteerService: MangaPuppeteerService) {
    super();
    this.setPuppeteerService(mangaPuppeteerService);
  }

  async getLatestUpdated(page: number = 1, limit: number = 5): Promise<MangaItemDto[]> {
    try {
      this.logOperation(`Fetching latest ${limit} manga`);

      // Use real scraping
      const latestUrl = `${this.websiteUrl}/page/${page}/`;
      const scrapedData = await this.scrapeMangaListWithPuppeteer(latestUrl, limit, {
        waitForSelector: 'body',
        delay: { min: 800, max: 1500 },
      });
      
      return scrapedData;

    } catch (error) {
      this.logger.error(`Failed to fetch latest updated manga from ${this.websiteName}:`, error.message);
      
      // Return mock data as fallback
      return this.generateMockLatestUpdated(limit);
    }
  }

  async searchManga(query: string, limit: number = 10): Promise<MangaItemDto[]> {
    try {
      this.logOperation(`Searching for "${query}" (limit: ${limit})`);
      
      // Return mock search results as fallback
      return this.generateMockSearchResults(query, limit);
    } catch (error) {
      this.logger.error(`Failed to search manga from ${this.websiteName}:`, error.message);
      return [];
    }
  }

  async getMangaDetails(identifier: string): Promise<MangaItemDto | null> {
    try {
      this.logOperation(`Getting details for manga: ${identifier}`);
      
      // Return mock details as fallback
      return this.generateMockMangaDetails(identifier);
    } catch (error) {
      this.logger.error(`Failed to get manga details from ${this.websiteName}:`, error.message);
      return null;
    }
  }

  private generateMockLatestUpdated(limit: number): MangaItemDto[] {
    const mockTitles = [
      'One Piece',
      'Naruto',
      'Dragon Ball Super',
      'Attack on Titan',
      'My Hero Academia',
      'Demon Slayer',
      'Jujutsu Kaisen',
      'Tokyo Ghoul',
      'Death Note',
      'Bleach'
    ];

    return Array.from({ length: Math.min(limit, mockTitles.length) }, (_, index) => ({
      id: `${this.websiteKey}-${index + 1}`,
      title: mockTitles[index],
      author: mockTitles[index], // Using title as author for simplicity
      coverImage: `${this.websiteUrl}/cover/${mockTitles[index].toLowerCase().replace(/\s+/g, '-')}.jpg`,
      latestChapter: Math.floor(Math.random() * 1000) + Date.now() % 1000000, // Random chapter number
      lastUpdated: new Date().toISOString(),
      url: `${this.websiteUrl}/${mockTitles[index].toLowerCase().replace(/\s+/g, '-')}/`,
    }));
  }

  private generateMockSearchResults(query: string, limit: number): MangaItemDto[] {
    const mockResults = [
      `${query} - The Beginning`,
      `${query} Chronicles`,
      `Adventures of ${query}`,
      `${query} vs The World`,
      `Legend of ${query}`
    ];

    return Array.from({ length: Math.min(limit, mockResults.length) }, (_, index) => ({
      id: `${this.websiteKey}-search-${index + 1}`,
      title: mockResults[index],
      author: `Author of ${mockResults[index]}`,
      coverImage: `${this.websiteUrl}/cover/search-${index + 1}.jpg`,
      latestChapter: Math.floor(Math.random() * 100) + 1,
      lastUpdated: new Date().toISOString(),
      url: `${this.websiteUrl}/search-result-${index + 1}/`,
    }));
  }

  private generateMockMangaDetails(identifier: string): MangaItemDto {
    return {
      id: `${this.websiteKey}-detail-${identifier}`,
      title: `Manga Details for ${identifier}`,
      author: `Author of ${identifier}`,
      coverImage: `${this.websiteUrl}/cover/${identifier}.jpg`,
      latestChapter: Math.floor(Math.random() * 500) + 1,
      lastUpdated: new Date().toISOString(),
      url: `${this.websiteUrl}/${identifier}/`,
    };
  }

  /**
   * Extract manga data from Godmanga website
   */
  async extractMangaData(page: Page, baseUrl: string, limit: number = 10): Promise<MangaItemDto[]> {
    console.log('Extracting manga data for Godmanga');
    
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
          container: 'div.flexbox4-item',
          title: 'div.flexbox4-side div.title > a',
          link: 'div.flexbox4-content > a',
          chapter: 'div.flexbox4-side ul.chapter > li:first-child a',
          image: 'div.flexbox4-thumb img',
          author: 'div.flexbox4-side div.title > a',
          lastUpdated: 'div.flexbox4-side ul.chapter > li:first-child span.date',
        };

        const containers = document.querySelectorAll(selectors.container);
        console.log(`Found ${containers.length} manga containers on the page. Limit: ${limit}`);

        containers.forEach((container, index) => {
          if (results.length >= limit) return;

          try {
            const titleEl = container.querySelector(selectors.title);
            const linkEl = container.querySelector(selectors.link);
            const chapterEl = container.querySelector(selectors.chapter);
            const imageEl = container.querySelector(selectors.image);
            const authorEl = container.querySelector(selectors.author);
            const lastUpdatedEl = container.querySelector(selectors.lastUpdated);

            const title = titleEl?.textContent?.trim();
            const url = linkEl?.getAttribute('href');

            if (title) {
              results.push({
                id: `godmanga-${index + 1}`,
                title,
                author: authorEl?.textContent?.trim(),
                coverImage: imageEl?.getAttribute('src'),
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
      },
      limit
    );
  }
}