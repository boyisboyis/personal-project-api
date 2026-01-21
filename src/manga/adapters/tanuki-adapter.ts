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
    this.logger.log(`[${this.websiteKey}] Fetching manga details for: ${identifier}`);

    try {
      if (!this.puppeteerService) {
        throw new Error('Puppeteer service not initialized');
      }

      const mangaUrl = `${this.websiteUrl}/manga/${identifier}`;
      this.logger.log(`[${this.websiteKey}] Attempting to fetch from: ${mangaUrl}`);

      // Use Puppeteer to scrape manga details page with Tanuki specific configuration
      const scrapingConfig = {
        ...this.getDefaultScrapingConfig(),
        delay: { min: 2000, max: 3000 }, // Longer delay for Tanuki Manga
        timeout: 45000, // Longer timeout
        waitForSelector: '#content',
      };
      const result = await this.puppeteerService.scrapeMangaDetails(mangaUrl, this, scrapingConfig);

      if (result.errors.length > 0) {
        this.logger.warn(`[${this.websiteKey}] Scraping completed with errors:`, result.errors);
      }

      this.logger.log(`[${this.websiteKey}] Manga details scraping result:`, !!result.manga);
      return result.manga;
    } catch (error) {
      this.logger.error(`[${this.websiteKey}] Error fetching manga details:`, error.message);
      return null;
    }
  }

  /**
   * Extract manga details including chapters from manga detail page
   */
  async extractMangaDetails(page: Page, url: string): Promise<MangaItemDto | null> {
    return await page.evaluate((websiteUrl: string) => {
      try {
        // Function to extract slug from URL
        function extractSlugFromUrl(url: string): string {
          const urlPatterns = [/\/([^\/]+)\/?$/, /\/manga\/([^\/]+)/, /\/title\/([^\/]+)/, /\/series\/([^\/]+)/, /\/read\/([^\/]+)/];

          for (const pattern of urlPatterns) {
            const match = url.match(pattern);
            if (match && match[1] && match[1] !== 'manga' && match[1] !== 'title') {
              return match[1];
            }
          }

          const segments = url.split('/').filter(segment => segment.length > 0);
          return segments[segments.length - 1] || 'unknown';
        }

        // Extract basic manga information from Tanuki Manga structure
        const titleEl = document.querySelector('#titlemove > h1.entry-title');
        const title = titleEl?.textContent?.trim();

        if (!title) {
          return null;
        }

        const authorEl = document.querySelector('.author, .manga-author, [data-author]');
        const author = authorEl?.textContent?.trim();

        const coverEl = document.querySelector('.wp-post-image, .manga-cover img, .entry-thumb img') as HTMLImageElement;
        const coverImage = coverEl?.src;

        // Extract manga ID from URL
        const mangaId = extractSlugFromUrl(window.location.href);

        // Extract chapters - Tanuki Manga specific selectors
        const chapters: any[] = [];
        const chapterElements = document.querySelectorAll('#chapterlist li');

        chapterElements.forEach((chapterEl, index) => {
          try {
            const chapterLinkEl = chapterEl.querySelector('a');
            const chapterTitle = chapterLinkEl?.querySelector('.chapternum')?.textContent?.trim();
            const lastUpdate = chapterLinkEl?.querySelector('.chapterdate')?.textContent?.trim();
            const chapterUrl = chapterLinkEl?.getAttribute('href');

            if (chapterTitle && chapterUrl) {
              // Extract chapter number from title
              const chapterNumberMatch = chapterTitle.match(/\d+/i);
              const chapterNumber = chapterNumberMatch ? parseFloat(chapterNumberMatch[chapterNumberMatch.length - 1]) : index + 1;

              // Extract chapter ID from chapter URL
              const chapterId = extractSlugFromUrl(chapterUrl);

              chapters.push({
                id: chapterId,
                title: chapterTitle,
                url: chapterUrl,
                chapterNumber: chapterNumber,
                lastUpdated: lastUpdate,
              });
            }
          } catch (error) {
            console.warn(`Error extracting chapter at index ${index}:`, error);
          }
        });

        // Sort chapters by chapter number (descending for latest first)
        // chapters.sort((a, b) => (b.chapterNumber || 0) - (a.chapterNumber || 0));

        return {
          id: mangaId,
          title: title,
          author: author,
          coverImage: coverImage,
          latestChapter: chapters.length > 0 ? chapters[0].chapterNumber : undefined,
          lastUpdated: chapters.length > 0 ? chapters[0].lastUpdated : undefined,
          url: window.location.href,
          chapters: chapters,
        };
      } catch (error) {
        console.error('Error extracting manga details:', error);
        return null;
      }
    }, this.websiteUrl);
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

    return await page.evaluate(
      (limit, websiteKey) => {
        const results: any[] = [];

        // Helper function to extract slug from URL
        const extractSlugFromUrl = (url: string) => {
          try {
            if (!url) return '';

            let cleanUrl = url.trim();
            const urlParts = cleanUrl.split('/').filter(part => part && part !== 'http:' && part !== 'https:');

            let slug = '';
            const domainIndex = urlParts.findIndex(
              part => part.includes('.com') || part.includes('.net') || part.includes('.org') || part.includes('.co') || part.includes('www.')
            );

            if (domainIndex >= 0 && domainIndex < urlParts.length - 1) {
              const pathParts = urlParts.slice(domainIndex + 1).filter(part => part);

              // For URLs like /manga/title/, get the part after 'manga'
              if (pathParts.includes('manga') || pathParts.includes('series')) {
                const mangaIndex = Math.max(pathParts.indexOf('manga'), pathParts.indexOf('series'));
                if (mangaIndex >= 0 && mangaIndex < pathParts.length - 1) {
                  slug = pathParts[mangaIndex + 1];
                }
              }

              // If still no slug, get the most meaningful part
              if (!slug) {
                slug =
                  pathParts.find(part => part.length > 3 && !part.includes('.') && part !== 'manga' && part !== 'series' && part !== 'chapter' && part !== 'read') ||
                  pathParts[pathParts.length - 1] ||
                  '';
              }
            } else {
              slug =
                urlParts.find(part => part.length > 3 && !part.includes('.') && part !== 'manga' && part !== 'series' && part !== 'chapter') || urlParts[urlParts.length - 1] || '';
            }

            slug = slug.replace(/\/$/, '');
            return slug || `${websiteKey}-unknown-${Date.now()}`;
          } catch (error) {
            return `${websiteKey}-error-${Date.now()}`;
          }
        };

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
              const fullUrl = url ? (url.startsWith('http') ? url : `${window.location.origin}${url}`) : undefined;
              const mangaId = fullUrl ? extractSlugFromUrl(fullUrl) : `${websiteKey}-${index + 1}`;

              results.push({
                id: mangaId,
                title,
                author: authorEl?.textContent?.trim(),
                coverImage: imageEl?.getAttribute('src') || imageEl?.getAttribute('data-src'),
                latestChapter: chapterEl ? parseInt(chapterEl.textContent?.replace(/\D/g, '') || '0') || undefined : undefined,
                lastUpdated: lastUpdatedEl?.textContent?.trim() || undefined,
                url: fullUrl,
              });
            }
          } catch (error) {
            console.warn(`Error extracting manga item at index ${index}:`, error);
          }
        });

        console.log(`Successfully extracted ${results.length} manga items`);
        return results;
      },
      limit,
      'tanuki'
    );
  }
}
