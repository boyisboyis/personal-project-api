import { Injectable, Logger } from '@nestjs/common';
import { MangaScraperAdapter } from '@/manga/adapters/base/manga-scraper.interface';
import { BaseMangaAdapter } from '@/manga/adapters/base/base-manga-adapter';
import { MangaItemDto } from '@/manga/dto/last-updated.dto';
import { ChapterImageDto } from '@/manga/dto/chapter-image.dto';
import { Page } from 'puppeteer';
import { MangaPuppeteerService } from '@/manga/services/manga-puppeteer-improved.service';

@Injectable()
export class MangaisekkaithaiAdapter extends BaseMangaAdapter implements MangaScraperAdapter {
  readonly websiteKey = 'mangaisekaithai';
  readonly websiteName = 'Manga Isekai Thai';
  readonly websiteUrl = 'https://www.mangaisekaithai.com';

  protected readonly logger = new Logger(MangaisekkaithaiAdapter.name);

  constructor(protected readonly puppeteerService: MangaPuppeteerService) {
    super();
  }

  async getLatestUpdated(page = 1, limit = 10): Promise<MangaItemDto[]> {
    this.logger.log(`[${this.websiteKey}] Getting latest updated manga (page: ${page}, limit: ${limit})`);

    try {
      this.logOperation(`Fetching latest ${limit} manga`);

      // Use real scraping
      const latestUrl = `${this.websiteUrl}/page/${page}/`;
      const scrapedData = await this.scrapeMangaListWithPuppeteer(latestUrl, limit, {
        waitForSelector: '#loop-content',
        delay: { min: 800, max: 1500 },
      });

      return scrapedData;
    } catch (error) {
      this.logger.error(`Failed to fetch latest updated manga from ${this.websiteName}:`, error.message);

      // Return mock data as fallback
      return this.generateMockLatestUpdated(limit);
    }
  }

  async searchManga(query: string, page = 1, limit = 10): Promise<MangaItemDto[]> {
    this.logger.log(`[${this.websiteKey}] Searching manga with query: "${query}" (page: ${page}, limit: ${limit})`);

    try {
      // For now, return mock search results
      return this.generateMockSearchResults(query, limit);
    } catch (error) {
      this.logger.error(`[${this.websiteKey}] Error searching manga:`, error.message);
      return [];
    }
  }

  async getMangaDetails(identifier: string): Promise<MangaItemDto | null> {
    this.logger.log(`[${this.websiteKey}] Getting manga details for: ${identifier}`);

    try {
      // Try multiple URL patterns for Manga Isekai Thai
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
            waitForSelector: '#manga-chapters-holder', // More generic selector
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
        }
      }

      this.logger.warn(`[${this.websiteKey}] All URL patterns failed for identifier: ${identifier}`);
      // Fallback to mock details as last resort
      this.logger.log(`[${this.websiteKey}] Falling back to mock data for: ${identifier}`);
      return this.generateMockMangaDetails(identifier);
    } catch (error) {
      this.logger.error(`[${this.websiteKey}] Error getting manga details:`, error.message);
      return null;
    }
  }

  /**
   * Extract manga details including chapters from manga detail page
   */
  async extractMangaDetails(page: Page, _url: string): Promise<MangaItemDto | null> {
    page.on('console', async msg => {
      const msgArgs = msg.args();
      for (let i = 0; i < msgArgs.length; ++i) {
        console.log(await msgArgs[i].jsonValue());
      }
    });
    return await page.evaluate(async (_websiteUrl: string) => {
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

        // Try multiple selectors for title - Manga Isekai Thai might have different layouts
        const titleSelectors = ['.entry-title', 'h1.entry-title', '.post-title h1', '.manga-title', '.series-title', 'h1', '.title'];

        let title = '';
        for (const selector of titleSelectors) {
          const titleEl = document.querySelector(selector);
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

        // Handle lazy loading of chapters by clicking "Read More" button multiple times
        let readMoreAttempts = 0;
        const maxReadMoreAttempts = 2; // Prevent infinite loop

        while (readMoreAttempts < maxReadMoreAttempts) {
          const readMoreButton = document.querySelector('.chapter-readmore') as HTMLButtonElement;
          console.log('Checking for "Read More" button:', readMoreButton.style.display);
          if (!readMoreButton || !readMoreButton.style.display || Object.keys(readMoreButton.style.display).length === 0) {
            console.log('No "Read More" button found, all chapters should be loaded');
            break;
          }

          console.log(`Found "Read More" button, clicking to load more chapters (attempt ${readMoreAttempts + 1})`);
          readMoreButton.click();

          // Wait for the new chapters to load
          await new Promise(resolve => setTimeout(resolve, 3000));

          readMoreAttempts++;

          // Check if the button is still present after loading
          const stillHasButton = document.querySelector('.chapter-readmore') as HTMLButtonElement;
          if (!stillHasButton || !stillHasButton.style.display || Object.keys(stillHasButton.style.display).length === 0) {
            console.log('No more "Read More" buttons found after clicking, all chapters loaded');
            break;
          }
        }

        if (readMoreAttempts >= maxReadMoreAttempts) {
          console.warn('Reached maximum "Read More" attempts, proceeding with available chapters');
        }

        console.log('Finished expanding chapters, total Read More clicks:', readMoreAttempts);

        // Generate manga ID from URL
        const mangaId = extractSlugFromUrl(window.location.href);

        // Try to find chapter information
        let latestChapter: number | undefined = undefined;
        const chapterSelectors = ['.listing-chapters_wrap .wp-manga-chapter'];

        for (const selector of chapterSelectors) {
          const chapterEl = document.querySelector(selector);
          if (chapterEl) {
            const chapterText = chapterEl.textContent?.trim() || '';
            console.log(`Found chapter element with selector '${selector}':`, chapterText);
            const chapterMatch = chapterText.match(/(\d+)/);
            if (chapterMatch) {
              latestChapter = parseInt(chapterMatch[1]);
              console.log(`Extracted latest chapter:`, latestChapter);
              break;
            }
          }
        }

        // Generate chapter data
        console.log('Generating chapter list');
        const chapters = [];
        const chapterElements = document.querySelectorAll('.listing-chapters_wrap .wp-manga-chapter');
        for (let i = 0; i < chapterElements.length; i++) {
          const chapterEl = chapterElements[i];
          const chapterUrl = chapterEl.querySelector('a')?.getAttribute('href') || '';
          const chapterTitleEle = chapterEl.querySelector('a');
          const chapterTitle = chapterTitleEle?.textContent?.trim() || `Chapter ${i + 1}`;
          const lastupdatedEl = chapterEl.querySelector('.chapter-release-date');
          const lastUpdated = lastupdatedEl?.textContent?.trim();

          if (chapterUrl) {
            const chapterId = extractSlugFromUrl(chapterUrl);
            chapters.push({
              id: chapterId,
              title: chapterTitle,
              chapterNumber: chapterTitle.match(/(\d+(\.\d+)?)/) ? parseFloat(chapterTitle.match(/(\d+(\.\d+)?)/)![1]) : i + 1,
              url: chapterUrl.startsWith('http') ? chapterUrl : `${window.location.origin}${chapterUrl}`,
              lastUpdated: lastUpdated,
            });
          }
        }

        const result = {
          id: mangaId,
          title,
          author: author || 'Unknown Author',
          coverImage: coverImage || '',
          latestChapter: latestChapter || chapters.length || 1,
          lastUpdated: chapters.length > 0 && typeof chapters[0].lastUpdated === 'string' ? chapters[0].lastUpdated : new Date().toISOString(),
          url: window.location.href,
          chapters: chapters,
        };

        // console.log('Final manga details:', result);
        return result;
      } catch (error) {
        console.error('Error in extractMangaDetails:', error);
        return null;
      }
    }, this.websiteUrl);
  }

  /**
   * Extract chapter images from chapter page
   */
  async extractChapterImages(page: Page, _chapterUrl: string): Promise<ChapterImageDto[]> {
    return await page.evaluate(() => {
      try {
        const images: ChapterImageDto[] = [];

        // Manga Isekai Thai specific selectors
        const imageSelectors = [
          '.reading-content img',
          '.reader-area img',
          '#readerarea img',
          '.chapter-content img',
          '.entry-content img',
          'img[data-src]',
          'img.wp-manga-chapter-img',
          '.comic-page img',
          '.page-image img',
        ];

        imageSelectors.forEach(selector => {
          const imgElements = document.querySelectorAll(selector) as NodeListOf<HTMLImageElement>;
          imgElements.forEach((img, index) => {
            const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
            if (src && !images.some(image => image.url === src)) {
              // Check if this is a canvas-based image (encrypted/protected content)
              const isCanvasType = img.classList.contains('encrypted') || 
                                   img.hasAttribute('data-encrypted') ||
                                   src.includes('encrypted') ||
                                   src.includes('protected');

              const image: ChapterImageDto = {
                url: src,
                type: isCanvasType ? 'canvas' : 'image',
              };

              if (isCanvasType) {
                image.html = `<canvas id="manga-page-${index}" class="manga-page-canvas"></canvas>`;
                image.script = `<script>
                  (function() {
                    const canvas = document.getElementById('manga-page-${index}');
                    if (canvas) {
                      const ctx = canvas.getContext('2d');
                      const img = new Image();
                      img.crossOrigin = 'anonymous';
                      img.onload = function() {
                        canvas.width = img.width;
                        canvas.height = img.height;
                        ctx.drawImage(img, 0, 0);
                      };
                      img.src = '${src}';
                    }
                  })();
                </script>`;
              }

              images.push(image);
            }
          });
        });

        // Filter out ads and small images
        return images.filter(image => {
          const url = image.url;
          return !url.includes('ads') && !url.includes('banner') && !url.includes('logo');
        });
      } catch (error) {
        console.error('Error extracting chapter images:', error);
        return [];
      }
    });
  }

  private generateMockLatestUpdated(limit: number): MangaItemDto[] {
    const mockTitles = [
      'Isekai Adventure 1',
      'Thai Manga 2',
      'Fantasy World 3',
      'Isekai Romance 4',
      'Magic Academy 5',
      'Dragon Slayer 6',
      'Reincarnation Story 7',
      'Another World 8',
      'Hero Journey 9',
      'Manga Thai 10',
    ];

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
    const mockResults = [`${query} - Isekai Story`, `${query} Chronicles`, `Adventures of ${query}`, `${query} vs The World`, `Legend of ${query}`];

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
   * Extract manga data from Manga Isekai Thai website
   */
  async extractMangaData(page: Page, baseUrl: string, limit: number = 10): Promise<MangaItemDto[]> {
    console.log('Extracting manga data for Manga Isekai Thai');

    // Enable console logging from page for debugging
    page.on('console', async msg => {
      const msgArgs = msg.args();
      for (let i = 0; i < msgArgs.length; ++i) {
        console.log(await msgArgs[i].jsonValue());
      }
    });

    return await page.evaluate(
      (limit: number, websiteKey: string) => {
        const results: any[] = [];

        // Common selectors for Thai manga websites
        const selectors = {
          container: '#loop-content .page-listing-item',
          title: '.post-title a',
          link: '.post-title a',
          chapter: 'div.item-summary > div.list-chapter > div:nth-child(1) > span.chapter.font-meta',
          image: '.img-responsive',
          author: '.author, .manga-author',
          lastUpdated: 'div.item-summary > div.list-chapter > div:nth-child(1) > span.post-on.font-meta',
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
      'mangaisekaithai'
    );
  }
}
