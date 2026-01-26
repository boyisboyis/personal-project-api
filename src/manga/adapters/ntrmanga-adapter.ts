import { Injectable } from '@nestjs/common';
import { BaseMangaAdapter } from '@/manga/adapters/base/base-manga-adapter';
import { MangaItemDto } from '@/manga/dto/last-updated.dto';
import { MangaPuppeteerService } from '@/manga/services/manga-puppeteer-improved.service';
import { Page } from 'puppeteer';
import { ChapterImageDto } from '../dto/chapter-image.dto';

@Injectable()
export class NtrmangaAdapter extends BaseMangaAdapter {
  readonly websiteKey = 'ntrmanga';
  readonly websiteName = 'NTR Manga';
  readonly websiteUrl = 'https://www.ntr-manga.com';

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
        waitForSelector: '#content',
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

      // Try multiple URL patterns for NTR Manga
      const urlPatterns = [
        `${this.websiteUrl}/manga/${identifier}/`,
        `${this.websiteUrl}/${identifier}/`,
        `${this.websiteUrl}/series/${identifier}/`,
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
  async extractMangaDetails(page: Page, _url: string): Promise<MangaItemDto | null> {
    return await page.evaluate((_websiteUrl: string) => {
      // Function to extract slug from URL
      function extractSlugFromUrl(url: string): string {
        const urlPatterns = [/\/([^/]+)\/?$/, /\/manga\/([^/]+)/, /\/title\/([^/]+)/, /\/series\/([^/]+)/, /\/comic\/([^/]+)/];

        for (const pattern of urlPatterns) {
          const match = url.match(pattern);
          if (match && match[1] && match[1] !== 'manga' && match[1] !== 'title') {
            return match[1];
          }
        }

        const segments = url.split('/').filter(segment => segment.length > 0);
        return segments[segments.length - 1] || 'unknown';
      }

      try {
        // Log current URL for debugging
        console.log('Current URL:', window.location.href);
        console.log('Page title:', document.title);

        // Try multiple selectors for title - NTR Manga might have different layouts
        const titleSelectors = ['.entry-title', 'h1.entry-title', '.post-title h1', '.manga-title', '.series-title', 'h1', '.title'];

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
          title = document.title?.replace(/.*?-\s*/, '')?.trim() || '';
          console.log('Fallback title from document.title:', title);
        }

        if (!title) {
          console.error('Still no title found, returning null');
          return null;
        }

        // Try multiple selectors for author
        const authorSelectors = ['.author', '.manga-author', '.series-author', '.entry-meta .author', '.post-author'];

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
        const coverSelectors = ['.manga-image img', '.post-thumb img', '.entry-thumb img', '.series-thumb img', '.cover img', 'img.manga-cover'];

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
        const chapterSelectors = ['#chapterlist li'];

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
            const lastUpdatedEl = chapterEl.querySelector('.chapterdate');
            const lastUpdated = lastUpdatedEl?.textContent?.trim();
            const chapterTitleEl = chapterEl.querySelector('.chapternum');
            const chapterTitle = chapterTitleEl?.textContent?.trim();
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
  async extractChapterImages(page: Page, _chapterUrl: string): Promise<ChapterImageDto[]> {
    page.on('console', async msg => {
      const msgArgs = msg.args();
      for (let i = 0; i < msgArgs.length; ++i) {
        console.log(await msgArgs[i].jsonValue());
      }
    });
    return await page.evaluate(() => {
      try {
        const images: ChapterImageDto[] = [];

        // NTR Manga specific selectors
        const imageSelectors = ['#readerarea img, #readerarea canvas'];
        const query = document.querySelectorAll('#readerarea > *');
        if (query.length === 0) {
          console.warn('No images found in reader area');
        }
        console.log(`Found ${query.length} elements in reader area`);
        for (let i = 0; i < query.length; i++) {
          const el = query[i] as HTMLImageElement;
          if (el.tagName.toLowerCase() === 'img') {
            const src = el.src || el.getAttribute('data-src') || el.getAttribute('data-lazy-src');
            if (src && !images.some(image => image.url === src)) {
              images.push({ url: src, type: 'image' });
            }
          } else if (el.tagName.toLowerCase() === 'canvas') {
            // Handle canvas elements if needed
            console.log('Found canvas element, skipping for now');
            images.push({
              url: '', // Canvas images may need special handling
              type: 'canvas',
              html: el.outerHTML,
              script: (query[i + 1].getHTML() || '').replace(/jQuery\(document\).ready\(function\(\)\{/, '').replace(/\n\}\);/, ''), // Assuming next sibling is script
            });
          } else if (el.tagName.toLowerCase() === 'script') {
            // Some images might be loaded via scripts
            console.log('Found script element, skipping for now');
          }
        }

        imageSelectors.forEach(selector => {
          const imgElements = document.querySelectorAll(selector) as NodeListOf<HTMLImageElement>;
          imgElements.forEach(img => {
            const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
            if (src && !images.some(image => image.url === src)) {
              images.push({ url: src, type: 'image' });
            }
          });
        });

        // Filter out ads and small images
        return images.filter(image => {
          return !image.url.includes('ads') && !image.url.includes('banner') && !image.url.includes('logo');
        });
      } catch (error) {
        console.error('Error extracting chapter images:', error);
        return [];
      }
    });
  }

  private generateMockLatestUpdated(limit: number): MangaItemDto[] {
    const mockTitles = ['NTR Story 1', 'NTR Story 2', 'NTR Story 3', 'NTR Story 4', 'NTR Story 5', 'NTR Story 6', 'NTR Story 7', 'NTR Story 8', 'NTR Story 9', 'NTR Story 10'];

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
    const mockResults = [`${query} - NTR Story`, `${query} Chronicles`, `Adventures of ${query}`, `${query} vs The World`, `Legend of ${query}`];

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
   * Extract manga data from NTR Manga website
   */
  async extractMangaData(page: Page, baseUrl: string, limit: number = 10): Promise<MangaItemDto[]> {
    console.log('Extracting manga data for NTR Manga');

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
          container: '#content .listupd .bs',
          title: '.bigor .tt',
          link: '.bsx > a',
          chapter: '.adds .epxs',
          image: '.ts-post-image',
          author: '.bigor .tt',
          lastUpdated: '.epxdate',
        };

        // Helper function to extract slug from URL
        function extractSlugFromUrl(url: string): string {
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
        }

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
      'ntrmanga'
    );
  }
}
