import { Injectable } from '@nestjs/common';
import { BaseMangaAdapter } from '@/manga/adapters/base/base-manga-adapter';
import { MangaItemDto } from '@/manga/dto/last-updated.dto';
import { MangaPuppeteerService } from '@/manga/services/manga-puppeteer-improved.service';
import { Page } from 'puppeteer';

@Injectable()
export class DokimoriAdapter extends BaseMangaAdapter {
  readonly websiteKey = 'dokimori';
  readonly websiteName = 'Dokimori';
  readonly websiteUrl = 'https://dokimori.com';

  constructor(private readonly mangaPuppeteerService: MangaPuppeteerService) {
    super();
    this.setPuppeteerService(mangaPuppeteerService);
  }

  async getLatestUpdated(page: number = 1, limit: number = 5): Promise<MangaItemDto[]> {
    try {
      this.logOperation(`Fetching latest ${limit} manga`);

      // Option 1: Use real scraping (uncomment to enable)
      const latestUrl = `${this.websiteUrl}/page/${page}/`;
      const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production';
      const scrapedData = await this.scrapeMangaListWithPuppeteer(latestUrl, limit, {
        waitForSelector: '#loop-content',
        delay: { min: 600, max: 1200 },
        timeout: isRailway ? 90000 : 30000, // Extended timeout for Railway
      });
      // if (scrapedData.length > 0) {
      this.logOperation(`Successfully scraped ${scrapedData.length} manga from real website`);
      return scrapedData;
      // }

      // Option 2: Fallback to mock data (current implementation)
      // await this.simulateNetworkDelay(400, 1200);

      // Sort by lastUpdated descending and take the limit
      // const result = this.mockMangaData.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime()).slice(0, limit);

      // this.logOperation(`Successfully fetched ${result.length} manga (using mock data)`);
      // return result;
    } catch (error) {
      this.handleError('getLatestUpdated', error);
    }
  }

  async searchManga(query: string, limit: number = 10): Promise<MangaItemDto[]> {
    try {
      this.logOperation(`Searching manga with query: "${query}"`);

      // Option 1: Use real scraping (uncomment to enable)
      const searchUrl = `${this.websiteUrl}/search?keyword=${encodeURIComponent(query)}`;
      const scrapedData = await this.scrapeMangaListWithPuppeteer(searchUrl, limit, {
        waitForSelector: '#loop-content',
        delay: { min: 800, max: 1500 },
      });
      // if (scrapedData.length > 0) {
      this.logOperation(`Found ${scrapedData.length} manga for query: "${query}" (scraped)`);
      return scrapedData;
      // }

      // Option 2: Fallback to mock data search
      // await this.simulateNetworkDelay(500, 1000);

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
    this.logger.log(`[${this.websiteKey}] Fetching manga details for: ${identifier}`);

    try {
      if (!this.puppeteerService) {
        throw new Error('Puppeteer service not initialized');
      }

      const mangaUrl = `${this.websiteUrl}/manga/${identifier}/`;
      console.log(`[${this.websiteKey}] Constructed manga URL: ${mangaUrl}`);
      this.logger.log(`[${this.websiteKey}] Attempting to fetch from: ${mangaUrl}`);

      // Use Puppeteer to scrape manga details page with Dokimori specific configuration
      const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production';
      const scrapingConfig = {
        ...this.getDefaultScrapingConfig(),
        delay: { min: 600, max: 1200 },
        waitForSelector: '#loop-content',
        timeout: isRailway ? 90000 : 30000, // Extended timeout for Railway
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
    page.on('console', async msg => {
      const msgArgs = msg.args();
      for (let i = 0; i < msgArgs.length; ++i) {
        console.log(await msgArgs[i].jsonValue());
      }
    });
    return await page.evaluate((websiteUrl: string) => {
      try {
        // Function to extract slug from URL
        function extractSlugFromUrl(url: string): string {
          const urlPatterns = [/\/([^\/]+)\/?$/, /\/manga\/([^\/]+)/, /\/title\/([^\/]+)/, /\/series\/([^\/]+)/, /\/doujin\/([^\/]+)/];

          for (const pattern of urlPatterns) {
            const match = url.match(pattern);
            if (match && match[1] && match[1] !== 'manga' && match[1] !== 'title') {
              return match[1];
            }
          }

          const segments = url.split('/').filter(segment => segment.length > 0);
          return segments[segments.length - 1] || 'unknown';
        }

        // Extract basic manga information from Dokimori structure
        const titleEl = document.querySelector('div.site-content > div > div.profile-manga > div > div > div > div.post-title-custom > h1');
        const title = titleEl?.textContent?.trim();

        if (!title) {
          return null;
        }

        const authorEl = document.querySelector('div.summary-content > div.author-content');
        const author = authorEl?.textContent?.trim();

        const coverEl = document.querySelector('.summary_image img') as HTMLImageElement;
        const coverImage = coverEl?.src;

        // Extract manga ID from URL
        const mangaId = extractSlugFromUrl(window.location.href);

        // Extract chapters/pages - Dokimori specific selectors
        const chapters: any[] = [];
        const pageElements = document.querySelectorAll('.wp-manga-chapter');

        pageElements.forEach((pageEl, index) => {
          try {
            const chapterTitleEl = pageEl.querySelector('a');
            const chapterTitle = chapterTitleEl?.textContent?.trim();
            const chapterUrl = chapterTitleEl?.getAttribute('href');
            const chapterNumber = chapterTitle ? parseFloat(chapterTitle.replace(/[^0-9.]/g, '')) : index + 1;
            const lastUpdatedEl = pageEl.querySelector('.chapter-release-date');
            const lastUpdatedText = lastUpdatedEl?.textContent?.trim();
            if (chapterTitle && chapterUrl) {
              // Extract chapter ID from chapter URL
              const chapterId = extractSlugFromUrl(chapterUrl);

              chapters.push({
                id: `${mangaId}/${chapterId}`,
                title: chapterTitle,
                url: chapterUrl,
                chapterNumber: chapterNumber,
                lastUpdated: lastUpdatedText, // Dokimori does not provide last updated per chapter in this format
              });
            }
          } catch (error) {
            console.warn(`Error extracting page at index ${index}:`, error);
          }
        });

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

  /**
   * Extract chapter images from chapter page (doujin pages)
   */
  async extractChapterImages(page: Page, chapterUrl: string): Promise<string[]> {
    return await page.evaluate(() => {
      try {
        const images: string[] = [];
        
        // Dokimori specific selectors for doujin pages
        const imageSelectors = [
          '.reading-content img',
          '.page-break img',
          '.entry-content img',
          'img.wp-manga-chapter-img',
          '.single-page img',
          'img[data-src]',
          '.doujin-page img'
        ];

        imageSelectors.forEach(selector => {
          const imgElements = document.querySelectorAll(selector) as NodeListOf<HTMLImageElement>;
          imgElements.forEach(img => {
            const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
            if (src && !images.includes(src)) {
              images.push(src);
            }
          });
        });

        // Filter out ads and small images
        return images.filter(src => {
          return !src.includes('ads') && !src.includes('banner') && !src.includes('logo');
        });
      } catch (error) {
        console.error('Error extracting chapter images:', error);
        return [];
      }
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      this.logOperation('Checking availability');
      await this.simulateNetworkDelay(150, 400);

      // Simulate occasional unavailability (8% chance - slightly higher than niceoppai)
      const isAvailable = Math.random() > 0.08;

      this.logOperation(`Availability check: ${isAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}`);
      return isAvailable;
    } catch (error) {
      this.logger.warn(`[${this.websiteKey}] Availability check failed:`, error.message);
      return false;
    }
  }

  /**
   * Extract manga data from Dokimori website
   */
  async extractMangaData(page: Page, baseUrl: string, limit: number = 10): Promise<MangaItemDto[]> {
    console.log('Extracting manga data for Dokimori');

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
        const selectors = {
          container: '.page-item-detail',
          title: 'div.item-summary.item-display > div > h4 > a',
          link: 'div.item-summary.item-display > div > h4 > a',
          chapter: 'div.chapter-item > span.chapter.font-meta > a',
          image: 'div.image-display a > img',
          author: 'div.item-summary.item-display > div > h4 > a',
        };

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

            const title = titleEl?.textContent?.trim();
            const url = linkEl?.getAttribute('href');

            if (title) {
              const fullUrl = url ? (url.startsWith('http') ? url : `${window.location.origin}${url}`) : undefined;
              const mangaId = fullUrl ? extractSlugFromUrl(fullUrl) : `${websiteKey}-${index + 1}`;

              results.push({
                id: mangaId,
                title,
                author: authorEl?.textContent?.trim(),
                coverImage: imageEl?.getAttribute('src'),
                latestChapter: chapterEl ? parseInt(chapterEl.textContent?.replace(/\D/g, '') || '0') || undefined : undefined,
                lastUpdated: undefined, // Dokimori doesn't provide lastUpdated in this format
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
      'dokimori'
    );
  }
}
