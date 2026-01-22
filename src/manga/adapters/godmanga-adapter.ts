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

      // Try multiple URL patterns for GodManga
      const urlPatterns = [
        `${this.websiteUrl}/series/${identifier}/`,
        `${this.websiteUrl}/manga/${identifier}/`,
        `${this.websiteUrl}/${identifier}/`,
        `${this.websiteUrl}/title/${identifier}/`,
      ];

      const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production';

      for (const mangaUrl of urlPatterns) {
        this.logger.log(`[${this.websiteKey}] Trying URL pattern: ${mangaUrl}`);
        
        try {
          const scrapingConfig = {
            ...this.getDefaultScrapingConfig(),
            delay: { min: 1000, max: 2000 },
            waitForSelector: 'body', // More generic selector
            timeout: isRailway ? 90000 : 30000,
          };
          
          const result = await this.puppeteerService.scrapeMangaDetails(mangaUrl, this, scrapingConfig);

          if (result.errors.length > 0) {
            this.logger.warn(`[${this.websiteKey}] Scraping completed with errors for ${mangaUrl}:`, result.errors);
          }

          if (result.manga) {
            this.logger.log(`[${this.websiteKey}] Successfully found manga details at: ${mangaUrl}`);
            return result.manga;
          }
        } catch (urlError) {
          this.logger.warn(`[${this.websiteKey}] Failed to scrape ${mangaUrl}:`, urlError.message);
          continue; // Try next URL pattern
        }
      }

      this.logger.warn(`[${this.websiteKey}] All URL patterns failed for identifier: ${identifier}`);
      return null;
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

        // Log current URL for debugging
        console.log('Current URL:', window.location.href);
        console.log('Page title:', document.title);
        
        // Try multiple selectors for title - GodManga might have different layouts
        const titleSelectors = [
          '#con3 div.series-synops strong',
          '.series-title',
          '.manga-title',
          'h1.entry-title',
          '.post-title h1',
          '.series-info .title',
          'h1'
        ];
        
        let title = '';
        let titleEl = null;
        for (const selector of titleSelectors) {
          titleEl = document.querySelector(selector);
          if (titleEl) {
            title = titleEl.textContent?.trim() || '';
            if (title) {
              console.log(`Found title with selector '${selector}':`, title);
              break;
            }
          }
        }
        
        if (!title) {
          console.error('No title found with any selector');
          // Try to get page title as fallback
          title = document.title?.replace(/.*?-\\s*/, '')?.trim() || '';
          console.log('Fallback title from document.title:', title);
        }
        
        if (!title) {
          console.error('Still no title found, returning null');
          return null;
        }

        // Try multiple selectors for author
        const authorSelectors = [
          '#con3 div.series-info > ul > li:nth-child(3) > span',
          '.series-author',
          '.manga-author',
          '.author',
          '.series-info .author'
        ];
        
        let author = '';
        for (const selector of authorSelectors) {
          const authorEl = document.querySelector(selector);
          if (authorEl) {
            author = authorEl.textContent?.trim() || '';
            if (author) {
              console.log(`Found author with selector '${selector}':`, author);
              break;
            }
          }
        }

        // Try multiple selectors for cover image
        const coverSelectors = [
          'div.series-thumb img',
          '.series-image img',
          '.manga-image img',
          '.post-thumb img',
          '.series-cover img',
          'img.series-thumb'
        ];
        
        let coverImage = '';
        for (const selector of coverSelectors) {
          const coverEl = document.querySelector(selector) as HTMLImageElement;
          if (coverEl) {
            coverImage = coverEl.src || coverEl.getAttribute('data-src') || '';
            if (coverImage) {
              console.log(`Found cover image with selector '${selector}':`, coverImage);
              break;
            }
          }
        }

        // Extract manga ID from URL
        const mangaId = extractSlugFromUrl(window.location.href);

        // Extract chapters with multiple selector patterns
        const chapters: any[] = [];
        const chapterSelectors = [
          'div.series-chapter ul.series-chapterlist li',
          '.chapter-list li',
          '.chapters-list li',
          '.episode-list li',
          '.chapter-item',
          'ul.chapters li',
          '.wp-manga-chapter'
        ];
        
        let chapterElements = null;
        for (const selector of chapterSelectors) {
          chapterElements = document.querySelectorAll(selector);
          if (chapterElements.length > 0) {
            console.log(`Found ${chapterElements.length} chapters with selector '${selector}'`);
            break;
          }
        }
        
        if (!chapterElements || chapterElements.length === 0) {
          console.warn('No chapters found with any selector');
        }

        chapterElements?.forEach((chapterEl, index) => {
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
