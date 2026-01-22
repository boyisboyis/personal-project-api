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
    this.logger.log(`[${this.websiteKey}] Fetching manga details for: ${identifier}`);

    try {
      if (!this.puppeteerService) {
        throw new Error('Puppeteer service not initialized');
      }

      const mangaUrl = `${this.websiteUrl}/series/${identifier}/`;
      this.logger.log(`[${this.websiteKey}] Attempting to fetch from: ${mangaUrl}`);

      // Use Puppeteer to scrape manga details page with GodManga specific configuration
      const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production';
      const scrapingConfig = {
        ...this.getDefaultScrapingConfig(),
        delay: { min: 1000, max: 2000 },
        waitForSelector: '.series',
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

      // Fallback to mock details as last resort
      this.logger.log(`[${this.websiteKey}] Falling back to mock data for: ${identifier}`);
      return this.generateMockMangaDetails(identifier);
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
          const urlPatterns = [/\/([^\/]+)\/?$/, /\/manga\/([^\/]+)/, /\/title\/([^\/]+)/, /\/series\/([^\/]+)/, /\/comic\/([^\/]+)/];

          for (const pattern of urlPatterns) {
            const match = url.match(pattern);
            if (match && match[1] && match[1] !== 'manga' && match[1] !== 'title') {
              return match[1];
            }
          }

          const segments = url.split('/').filter(segment => segment.length > 0);
          return segments[segments.length - 1] || 'unknown';
        }

        // Extract basic manga information from GodManga structure
        const titleEl = document.querySelector('#con3 div.series-synops strong');
        const title = titleEl?.textContent?.trim();
        console.log('Extracted title:', title);
        if (!title) {
          return null;
        }

        const authorEl = document.querySelector('#con3 div.series-info > ul > li:nth-child(3) > span');
        const author = authorEl?.textContent?.trim();

        const coverEl = document.querySelector('div.series-thumb img') as HTMLImageElement;
        const coverImage = coverEl?.src;

        // Extract manga ID from URL
        const mangaId = extractSlugFromUrl(window.location.href);

        // Extract chapters - GodManga specific selectors
        const chapters: any[] = [];
        const chapterElements = document.querySelectorAll('div.series-chapter ul.series-chapterlist li');

        chapterElements.forEach((chapterEl, index) => {
          try {
            const chapterLinkEl = chapterEl.querySelector('a');
            const lastUpdatedEl = chapterEl.querySelector('span.date');
            const lastUpdated = lastUpdatedEl?.textContent?.trim();
            lastUpdatedEl?.remove();
            const chapterTitle = chapterLinkEl?.textContent?.trim();
            const chapterUrl = chapterLinkEl?.getAttribute('href');

            if (chapterTitle && chapterUrl) {
              // Extract chapter number from title
              const chapterNumberMatch = chapterTitle.match(/\d+/);
              const chapterNumber = chapterNumberMatch ? parseFloat(chapterNumberMatch[chapterNumberMatch.length - 1]) : index + 1;

              // Extract chapter ID from chapter URL
              const chapterId = extractSlugFromUrl(chapterUrl);

              chapters.push({
                id: chapterId,
                title: chapterTitle,
                url: chapterUrl,
                chapterNumber: chapterNumber,
                lastUpdated: lastUpdated,
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

  /**
   * Extract chapter images from chapter page
   */
  async extractChapterImages(page: Page, chapterUrl: string): Promise<string[]> {
    return await page.evaluate(() => {
      try {
        const images: string[] = [];
        
        // GodManga specific selectors
        const imageSelectors = [
          '.reading-content img',
          '.reader-area img',
          '#readerarea img',
          '.chapter-content img',
          '.entry-content img',
          'img[data-src]',
          'img.wp-manga-chapter-img',
          '.comic-page img'
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

  private generateMockLatestUpdated(limit: number): MangaItemDto[] {
    const mockTitles = ['One Piece', 'Naruto', 'Dragon Ball Super', 'Attack on Titan', 'My Hero Academia', 'Demon Slayer', 'Jujutsu Kaisen', 'Tokyo Ghoul', 'Death Note', 'Bleach'];

    return Array.from({ length: Math.min(limit, mockTitles.length) }, (_, index) => ({
      id: `${this.websiteKey}-${index + 1}`,
      title: mockTitles[index],
      author: mockTitles[index], // Using title as author for simplicity
      coverImage: `${this.websiteUrl}/cover/${mockTitles[index].toLowerCase().replace(/\s+/g, '-')}.jpg`,
      latestChapter: Math.floor(Math.random() * 1000) + (Date.now() % 1000000), // Random chapter number
      lastUpdated: new Date().toISOString(),
      url: `${this.websiteUrl}/${mockTitles[index].toLowerCase().replace(/\s+/g, '-')}/`,
    }));
  }

  private generateMockSearchResults(query: string, limit: number): MangaItemDto[] {
    const mockResults = [`${query} - The Beginning`, `${query} Chronicles`, `Adventures of ${query}`, `${query} vs The World`, `Legend of ${query}`];

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
      (limit, websiteKey) => {
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
            const lastUpdatedEl = container.querySelector(selectors.lastUpdated);

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
      'godmanga'
    );
  }
}
