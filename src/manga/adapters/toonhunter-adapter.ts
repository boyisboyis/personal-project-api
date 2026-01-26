import { Injectable, Logger } from '@nestjs/common';
import { MangaScraperAdapter } from '@/manga/adapters/base/manga-scraper.interface';
import { BaseMangaAdapter } from '@/manga/adapters/base/base-manga-adapter';
import { MangaItemDto } from '@/manga/dto/last-updated.dto';
import { ChapterImageDto } from '@/manga/dto/chapter-image.dto';
import { Page } from 'puppeteer';
import { MangaPuppeteerService } from '@/manga/services/manga-puppeteer-improved.service';

@Injectable()
export class ToonHunterAdapter extends BaseMangaAdapter implements MangaScraperAdapter {
  readonly websiteKey = 'toonhunter';
  readonly websiteName = 'Toon Hunter';
  readonly websiteUrl = 'https://toonhunter.com';

  protected readonly logger = new Logger(ToonHunterAdapter.name);

  constructor(protected readonly puppeteerService: MangaPuppeteerService) {
    super();
    this.setPuppeteerService(puppeteerService);
  }

  async getLatestUpdated(page = 1, limit = 10): Promise<MangaItemDto[]> {
    this.logger.log(`[${this.websiteKey}] Getting latest updated manga (page: ${page}, limit: ${limit})`);

    try {
      this.logOperation(`Fetching latest ${limit} manga`);

      // Use real scraping
      const latestUrl = `${this.websiteUrl}/page/${page}`;
      const scrapedData = await this.scrapeMangaListWithPuppeteer(latestUrl, limit, {
        waitForSelector: '#content > div.wrapper > div.postbody > div:nth-child(2) > div.listupd',
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
      const searchUrl = `${this.websiteUrl}/search?q=${encodeURIComponent(query)}&page=${page}`;
      const scrapedData = await this.scrapeMangaListWithPuppeteer(searchUrl, limit, {
        waitForSelector: '#content > div.wrapper > div.postbody > div:nth-child(2) > div.listupd',
        delay: { min: 1000, max: 2000 },
      });

      return scrapedData;
    } catch (error) {
      this.logger.error(`[${this.websiteKey}] Error searching manga:`, error.message);
      return this.generateMockSearchResults(query, limit);
    }
  }

  async getMangaDetails(identifier: string): Promise<MangaItemDto | null> {
    this.logger.log(`[${this.websiteKey}] Getting manga details for: ${identifier}`);

    try {
      const mangaUrl = identifier.startsWith('http') ? identifier : `${this.websiteUrl}/webtoon/${identifier}`;

      const scrapingConfig = this.getDefaultScrapingConfig();
      const result = await this.puppeteerService.scrapeMangaDetails(mangaUrl, this, scrapingConfig);

      if (result && result.manga) {
        this.logger.log(`[${this.websiteKey}] Successfully found manga details at: ${mangaUrl}`);
        return result.manga;
      }

      this.logger.warn(`[${this.websiteKey}] No manga found at: ${mangaUrl}`);
      return this.generateMockMangaDetails(identifier);
    } catch (error) {
      this.logger.error(`[${this.websiteKey}] Error getting manga details:`, error.message);
      return this.generateMockMangaDetails(identifier);
    }
  }

  /**
   * Extract manga data from page (implementation for base class)
   */
  async extractMangaData(page: Page, baseUrl: string, limit?: number): Promise<MangaItemDto[]> {
    return await page.evaluate(
      (url, maxLimit) => {
        try {
          const mangas: any[] = [];

          // ToonHunter.com specific selectors
          const mangaSelectors = ['#content > div.wrapper > div.postbody > div:nth-child(2) > div.listupd > div.bs'];

          let mangaElements: NodeListOf<Element> | null = null;

          // Try different selectors to find manga elements
          for (const selector of mangaSelectors) {
            mangaElements = document.querySelectorAll(selector);
            if (mangaElements && mangaElements.length > 0) {
              break;
            }
          }

          if (!mangaElements || mangaElements.length === 0) {
            console.log('No manga elements found, trying generic selectors');
            // Fallback to more generic selectors
            mangaElements = document.querySelectorAll('article, .post, .item, .card');
          }

          mangaElements.forEach((element, index) => {
            if (maxLimit && mangas.length >= maxLimit) return;

            try {
              // Extract title
              const titleSelectors = ['div.tt > a'];
              let title = '';
              let mangaUrl = '';

              for (const selector of titleSelectors) {
                const titleElement = element.querySelector(selector) as HTMLAnchorElement;
                if (titleElement) {
                  title = titleElement.textContent?.trim() || titleElement.getAttribute('title')?.trim() || '';
                  mangaUrl = titleElement.href || '';
                  if (title) break;
                }
              }

              if (!title) {
                const linkElement = element.querySelector('a') as HTMLAnchorElement;
                if (linkElement) {
                  title = linkElement.textContent?.trim() || linkElement.getAttribute('title')?.trim() || `Unknown Webtoon ${index + 1}`;
                  mangaUrl = linkElement.href || '';
                }
              }

              // Extract manga URL/ID
              if (!mangaUrl) {
                const linkElement = element.querySelector('a') as HTMLAnchorElement;
                mangaUrl = linkElement?.href || '';
              }

              // Extract ID from URL
              let mangaId = title
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
              if (mangaUrl) {
                const urlParts = mangaUrl.split('/');
                const potentialId = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
                if (potentialId && potentialId !== 'manga' && potentialId !== 'webtoon') {
                  mangaId = potentialId;
                }
              }

              // Extract cover image
              const imageSelectors = ['.ts-post-image'];
              let coverImage = '';
              for (const selector of imageSelectors) {
                const imgElement = element.querySelector(selector) as HTMLImageElement;
                if (imgElement) {
                  coverImage = imgElement.src || imgElement.getAttribute('data-src') || imgElement.getAttribute('data-lazy-src') || '';
                  if (coverImage && !coverImage.includes('placeholder') && !coverImage.includes('default') && !coverImage.includes('avatar')) {
                    break;
                  }
                }
              }

              // Extract author/artist
              const authorSelectors = ['div.tt > a'];
              let author = '';
              for (const selector of authorSelectors) {
                const authorElement = element.querySelector(selector);
                if (authorElement) {
                  author = authorElement.textContent?.trim() || '';
                  break;
                }
              }

              // Extract latest chapter info
              const chapterSelectors = ['ul.chfiv > li:first-child > a > span.fivchap'];
              let latestChapter: number | undefined;
              for (const selector of chapterSelectors) {
                const chapterElement = element.querySelector(selector);
                if (chapterElement) {
                  const chapterText = chapterElement.textContent || '';
                  const chapterMatch = chapterText.match(/(\d+)/);
                  if (chapterMatch) {
                    latestChapter = parseInt(chapterMatch[1], 10);
                    break;
                  }
                }
              }

              const lastUpdated = element.querySelector('.fivtime')?.textContent?.trim() || '';

              if (title && mangaId) {
                mangas.push({
                  id: mangaId,
                  title: title,
                  author: author || undefined,
                  coverImage: coverImage || undefined,
                  latestChapter: latestChapter,
                  lastUpdated: lastUpdated,
                  url: mangaUrl,
                });
              }
            } catch (error) {
              console.error('Error extracting manga data:', error);
            }
          });

          console.log(`Extracted ${mangas.length} webtoon items from ${url}`);
          return mangas;
        } catch (error) {
          console.error('Error in extractMangaData:', error);
          return [];
        }
      },
      baseUrl,
      limit
    );
  }

  /**
   * Extract manga details from detail page
   */
  async extractMangaDetails(page: Page, url: string): Promise<MangaItemDto | null> {
    return await page.evaluate(mangaUrl => {
      try {
        // Extract basic info
        const titleSelectors = ['#titlemove > h1.entry-title', '.entry-title'];
        let title = '';
        for (const selector of titleSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            title = element.textContent?.trim() || '';
            if (title) break;
          }
        }

        // Extract author/artist
        const authorSelectors = ['div.tsinfo.bixbox > div:nth-child(6) > span > i'];
        let author = '';
        for (const selector of authorSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            author = element.textContent?.trim().replace(/^(Author|Artist|Created by|By):?\s*/i, '') || '';
            if (author) break;
          }
        }

        // Extract cover image
        const imageSelectors = ['div.info-left-margin > div.thumb > img', 'div.thumb > img', '.ts-post-image'];
        let coverImage = '';
        for (const selector of imageSelectors) {
          const element = document.querySelector(selector) as HTMLImageElement;
          if (element) {
            coverImage = element.src || element.getAttribute('data-src') || element.getAttribute('data-lazy-src') || '';
            if (coverImage && !coverImage.includes('placeholder') && !coverImage.includes('avatar')) break;
          }
        }

        // Extract chapters/episodes
        const chapters: any[] = [];
        const chapterSelectors = ['#chapterlist > ul > li'];

        for (const selector of chapterSelectors) {
          const chapterElements = document.querySelectorAll(selector);
          if (chapterElements.length > 0) {
            chapterElements.forEach((element, index) => {
              const linkElement = element.querySelector('a') as HTMLAnchorElement;
              if (linkElement) {
                const chapterTitleEl = element.querySelector('.chapternum');
                const chapterTitle = chapterTitleEl?.textContent?.trim() || linkElement.textContent?.trim() || `Chapter ${index + 1}`;
                const chapterUrl = linkElement.href || '';

                // Extract chapter number
                const chapterNumber = element.getAttribute('data-num')
                  ? parseFloat(element.getAttribute('data-num') || '')
                  : (() => {
                      const match = chapterTitle.match(/(\d+(\.\d+)?)/);
                      return match ? parseFloat(match[1]) : index + 1;
                    })();

                // Extract chapter ID from URL or generate one
                let chapterId = `ep-${chapterNumber}`;
                if (chapterUrl) {
                  const urlParts = chapterUrl.split('/');
                  const potentialId = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
                  if (potentialId && potentialId !== 'chapter' && potentialId !== 'episode') {
                    chapterId = potentialId;
                  }
                }

                // Extract date if available
                const lastUpdated = element.querySelector('.chapterdate')?.textContent?.trim() || '';

                chapters.push({
                  id: chapterId,
                  title: chapterTitle,
                  url: chapterUrl,
                  chapterNumber: chapterNumber,
                  lastUpdated: lastUpdated,
                });
              }
            });
            break;
          }
        }

        if (!title) {
          console.log('Could not find title, using fallback');
          title = 'Unknown Webtoon';
        }

        const mangaId = title
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');

        return {
          id: mangaId,
          title: title,
          author: author || undefined,
          coverImage: coverImage || undefined,
          latestChapter: chapters.length > 0 ? chapters[0].chapterNumber : undefined,
          lastUpdated: chapters.length > 0 ? chapters[0].lastUpdated : undefined,
          url: mangaUrl,
          chapters: chapters, // Most recent first
        };
      } catch (error) {
        console.error('Error extracting manga details:', error);
        return null;
      }
    }, url);
  }

  /**
   * Extract chapter images from chapter page
   */
  async extractChapterImages(page: Page, chapterUrl: string): Promise<ChapterImageDto[]> {
    return await page.evaluate(url => {
      try {
        const sources = Array.from(document.querySelectorAll('script'))
          .filter(t => t.textContent && t.textContent.includes('noimagehtml'))
          .map(script => {
            const content = (script.textContent || '').replace(/ts_reader.run\(/g, '').replace(/\);?$/, '');
            const parse = JSON.parse(content);
            return Array.isArray(parse.sources) && parse.sources.length > 0 ? parse.sources[0] : [];
          });
        if (Array.isArray(sources) && sources.length > 0) {
          return sources[0].images || [];
        }
        const images: ChapterImageDto[] = [];

        // ToonHunter.com specific selectors for chapter images
        const imageSelectors = [
          '.reading-content img',
          '.reader-area img',
          '#reader img',
          '.chapter-content img',
          '.webtoon-content img',
          '.episode-content img',
          '.page-image img',
          '.comic-page img',
          '.manga-page img',
          '.webtoon-page img',
          '.page img',
          '.pages img',
        ];

        imageSelectors.forEach(selector => {
          const imgElements = document.querySelectorAll(selector) as NodeListOf<HTMLImageElement>;
          imgElements.forEach((img, index) => {
            const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original');
            if (src && !images.some(image => image.url === src)) {
              // Check if this might be an encrypted/protected image
              const isEncrypted =
                img.classList.contains('encrypted') ||
                img.classList.contains('protected') ||
                img.hasAttribute('data-encrypted') ||
                src.includes('encrypted') ||
                src.includes('protected') ||
                src.includes('scrambled');

              const image: ChapterImageDto = {
                url: src,
                type: isEncrypted ? 'canvas' : 'image',
              };

              if (isEncrypted) {
                const canvasId = `toonhunter-page-${index}-${Date.now()}`;
                image.html = `<canvas id="${canvasId}" class="manga-page-canvas" style="max-width: 100%; height: auto;"></canvas>`;
                image.script = `<script>
                  (function() {
                    const canvas = document.getElementById('${canvasId}');
                    if (!canvas) return;
                    
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    
                    img.onload = function() {
                      canvas.width = img.width;
                      canvas.height = img.height;
                      ctx.drawImage(img, 0, 0);
                      
                      // Add toonhunter specific decryption/descrambling logic here
                      console.log('Loaded protected image for toonhunter:', '${src}');
                    };
                    
                    img.onerror = function() {
                      console.error('Failed to load image:', '${src}');
                      ctx.fillStyle = '#ff6b6b';
                      ctx.font = '16px Arial';
                      ctx.textAlign = 'center';
                      canvas.width = 400;
                      canvas.height = 200;
                      ctx.fillText('Image failed to load', canvas.width/2, canvas.height/2);
                    };
                    
                    img.src = '${src}';
                  })();
                </script>`;
              }

              images.push(image);
            }
          });
        });

        // Filter out ads and unwanted images
        return images.filter(image => {
          const url = image.url;
          return !url.includes('ads') && !url.includes('banner') && !url.includes('logo') && !url.includes('advertisement') && !url.includes('sponsor') && url.length > 10; // Filter out very short URLs
        });
      } catch (error) {
        console.error('Error extracting chapter images:', error);
        return [];
      }
    }, chapterUrl);
  }

  private generateMockLatestUpdated(limit: number): MangaItemDto[] {
    return Array.from({ length: limit }, (_, i) => ({
      id: `toonhunter-${i + 1}`,
      title: `Toon Hunter Title ${i + 1}`,
      author: 'Toon Hunter Author',
      coverImage: `https://via.placeholder.com/200x300?text=ToonHunter+${i + 1}`,
      latestChapter: i + 25,
      lastUpdated: new Date().toISOString(),
      url: `${this.websiteUrl}/webtoon/toonhunter-${i + 1}`,
      chapters: [],
    }));
  }

  private generateMockSearchResults(query: string, limit: number): MangaItemDto[] {
    return this.generateMockLatestUpdated(limit).map(manga => ({
      ...manga,
      title: `${query} - ${manga.title}`,
    }));
  }

  private generateMockMangaDetails(mangaKey: string): MangaItemDto {
    return {
      id: mangaKey,
      title: 'Toon Hunter Demo Title',
      author: 'Toon Hunter Demo Author',
      coverImage: 'https://via.placeholder.com/200x300?text=ToonHunter+Demo',
      latestChapter: 35,
      lastUpdated: new Date().toISOString(),
      url: `${this.websiteUrl}/webtoon/${mangaKey}`,
      chapters: Array.from({ length: 35 }, (_, i) => ({
        id: `ep-${i + 1}`,
        title: `Episode ${i + 1}`,
        url: `${this.websiteUrl}/webtoon/${mangaKey}/episode-${i + 1}`,
        chapterNumber: i + 1,
        publishedAt: new Date(Date.now() - (35 - i) * 86400000),
      })),
    };
  }
}
