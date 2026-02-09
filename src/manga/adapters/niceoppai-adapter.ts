import { Injectable } from '@nestjs/common';
import { BaseMangaAdapter } from '@/manga/adapters/base/base-manga-adapter';
import { MangaItemDto, ChapterDto } from '@/manga/dto/last-updated.dto';
import { MangaPuppeteerService } from '@/manga/services/manga-puppeteer-improved.service';
import { Page } from 'puppeteer';
import { ChapterImageDto } from '../dto/chapter-image.dto';

@Injectable()
export class NiceoppaiAdapter extends BaseMangaAdapter {
  readonly websiteKey = 'niceoppai';
  readonly websiteName = 'Niceoppai';
  readonly websiteUrl = 'https://www.niceoppai.net';

  constructor(private readonly mangaPuppeteerService: MangaPuppeteerService) {
    super();
    this.setPuppeteerService(mangaPuppeteerService);
  }

  async getLatestUpdated(page: number = 1, limit: number = 5): Promise<MangaItemDto[]> {
    try {
      this.logOperation(`Fetching latest ${limit} manga`);

      // Option 1: Use real scraping (uncomment to enable)
      const latestUrl = `${this.websiteUrl}/manga_list/all/any/last-updated/${page}/`;
      const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production';
      const scrapedData = await this.scrapeMangaListWithPuppeteer(latestUrl, limit, {
        waitForSelector: '#sct_content',
        delay: { min: 800, max: 1500 },
        timeout: isRailway ? 90000 : 30000, // Extended timeout for Railway
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
    this.logger.log(`[${this.websiteKey}] Fetching manga details for: ${identifier}`);

    try {
      if (!this.puppeteerService) {
        throw new Error('Puppeteer service not initialized');
      }

      const mangaUrl = `${this.websiteUrl}/${identifier}`;
      this.logger.log(`[${this.websiteKey}] Attempting to fetch from: ${mangaUrl}`);

      // Use Puppeteer to scrape manga details page
      const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production';
      const scrapingConfig = {
        ...this.getDefaultScrapingConfig(),
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
      (limit, websiteKey) => {
        const results: any[] = [];
        const selectors = {
          container: '#sct_content div.nde',
          title: 'a.ttl',
          link: 'a.ttl',
          chapter: 'div.det > ul > li:nth-child(1) > a',
          image: 'div.cvr > a > img',
          author: 'a.ttl',
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
            let chapterEl = container.querySelector(selectors.chapter);
            const imageEl = container.querySelector(selectors.image);
            const authorEl = container.querySelector(selectors.author);

            const title = titleEl?.textContent?.trim();
            const url = linkEl?.getAttribute('href');
            let lastUpdated: string | undefined = undefined;

            // Special handling for Niceoppai chapter format
            if (chapterEl) {
              const spanEl = chapterEl.querySelector('span');
              if (spanEl) {
                lastUpdated = spanEl.textContent?.trim() || undefined;
                spanEl.remove();
              }
            }

            if (title) {
              const fullUrl = url ? (url.startsWith('http') ? url : `${window.location.origin}${url}`) : undefined;
              const mangaId = fullUrl ? extractSlugFromUrl(fullUrl) : `${websiteKey}-${index + 1}`;

              results.push({
                id: mangaId,
                title,
                author: authorEl?.textContent?.trim(),
                coverImage: imageEl?.getAttribute('src'),
                latestChapter: chapterEl ? parseFloat(chapterEl.textContent?.replace(/[^\d.]/g, '') || '0') || undefined : undefined,
                lastUpdated: lastUpdated, // Niceoppai doesn't provide lastUpdated in this format
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
      'niceoppai'
    );
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
        // Function to extract slug from URL (same as in list extraction)
        function extractSlugFromUrl(url: string): string {
          const urlPatterns = [/\/([^\/]+)\/?$/, /\/manga\/([^\/]+)/, /\/title\/([^\/]+)/, /\/series\/([^\/]+)/, /\/read\/([^\/]+)/, /\/chapter\/([^\/]+)/];

          for (const pattern of urlPatterns) {
            const match = url.match(pattern);
            if (match && match[1] && match[1] !== 'manga' && match[1] !== 'title') {
              return match[1];
            }
          }

          const segments = url.split('/').filter(segment => segment.length > 0);
          return segments[segments.length - 1] || 'unknown';
        }

        // Extract basic manga information
        const titleEl = document.querySelector('#sct_content h1.ttl');
        const title = titleEl?.textContent?.trim();

        if (!title) {
          return null;
        }

        const authorEl = document.querySelector('.author, .series-author, [class*="author"]');
        const author = authorEl?.textContent?.trim();
        // #sct_content > div > div.wpm_pag.mng_det > div.mng_ifo > div.cvr_ara > img
        const coverEl = document.querySelector('div.mng_ifo > div.cvr_ara > img') as HTMLImageElement;
        const coverImage = coverEl?.src;

        // Extract manga ID from URL
        const mangaId = extractSlugFromUrl(window.location.href);

        // Extract chapters
        const chapters: ChapterDto[] = [];
        const chapterElements = document.querySelectorAll('ul.lst > li');
        chapterElements.forEach((chapterEl, index) => {
          try {
            const chapterTitleEl = chapterEl.querySelector('.val');
            const chapterTitle = chapterTitleEl?.textContent?.trim();
            const chapterUrlEl = chapterEl.querySelector('a.lst');
            const chapterUrl = chapterUrlEl?.getAttribute('href');

            if (chapterTitle && chapterUrl) {
              // Extract chapter number from title or URL
              const chapterNumberMatch = chapterTitle.match(/\d+/);
              const chapterNumber = chapterNumberMatch ? parseFloat(chapterNumberMatch[0]) : index + 1;

              // Extract chapter ID from chapter URL
              const chapterId = extractSlugFromUrl(chapterUrl);

              chapters.push({
                id: `${mangaId}/${chapterId}`,
                title: chapterTitle,
                url: chapterUrl,
                chapterNumber: chapterNumber,
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
          lastUpdated: new Date().toISOString(), // Use current time as we don't have exact last updated
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
   * Extract chapter images from chapter page
   */
  async extractChapterImages(page: Page, chapterUrl: string): Promise<ChapterImageDto[]> {
    return await page.evaluate(() => {
      try {
        const images: ChapterImageDto[] = [];

        // Common selectors for manga reader pages
        const imageSelectors = ['#image-container center'];

        imageSelectors.forEach(selector => {
          const centerElement = document.querySelectorAll(selector) as NodeListOf<HTMLElement>;
          centerElement.forEach(center => {
            const img = center.querySelector('img') as HTMLImageElement;
            if (img) {
              const url = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
              const scriptElement = center.querySelector('script');
              const div = center.querySelector('& > div');
              if (div) {
                div.innerHTML = ''; // Clear div content to avoid duplication
              }
              const image: ChapterImageDto = {
                url: url || '', // Placeholder URL
                type: scriptElement ? 'image-script' : 'image',
                html: div ? div.outerHTML : undefined,
                // script: (scriptElement.textContent || '').replace(/eval\(/g, '').replace(/\{\}\)\)\\n/g, '{})'),
                script: scriptElement ? scriptElement.textContent || '' : '',
              };
              images.push(image);
            }
          });
        });

        // Filter out small images (likely ads or icons)
        return images.filter(image => {
          // Basic filtering - exclude very small images or common ad patterns
          return !image.url.includes('ads') && !image.url.includes('banner') && !image.url.includes('logo');
        });
      } catch (error) {
        console.error('Error extracting chapter images:', error);
        return [];
      }
    });
  }
}
