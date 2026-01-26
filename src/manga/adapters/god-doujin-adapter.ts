import { Injectable, Logger } from '@nestjs/common';
import { MangaScraperAdapter } from '@/manga/adapters/base/manga-scraper.interface';
import { BaseMangaAdapter } from '@/manga/adapters/base/base-manga-adapter';
import { MangaItemDto } from '@/manga/dto/last-updated.dto';
import { ChapterImageDto } from '@/manga/dto/chapter-image.dto';
import { Page } from 'puppeteer';
import { MangaPuppeteerService } from '@/manga/services/manga-puppeteer-improved.service';

@Injectable()
export class GodDoujinAdapter extends BaseMangaAdapter implements MangaScraperAdapter {
  readonly websiteKey = 'god-doujin';
  readonly websiteName = 'God Doujin';
  readonly websiteUrl = 'https://god-doujin.com';

  protected readonly logger = new Logger(GodDoujinAdapter.name);

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
        waitForSelector: '#con3 > div:nth-child(2) > div.listupd',
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
        waitForSelector: '#con3 > div:nth-child(2) > div.listupd',
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
      const mangaUrl = identifier.startsWith('http') ? identifier : `${this.websiteUrl}/manga/${identifier}`;

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

          // God-doujin.com specific selectors
          const mangaSelectors = ['#con3 > div:nth-child(2) > div.listupd > div.bs'];

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
              const titleSelectors = ['div.bigor > div.tt'];
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
                  title = linkElement.textContent?.trim() || linkElement.getAttribute('title')?.trim() || `Unknown Doujin ${index + 1}`;
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
                if (potentialId && potentialId !== 'manga' && potentialId !== 'doujin') {
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
              const authorSelectors = ['.tt'];
              let author = '';
              for (const selector of authorSelectors) {
                const authorElement = element.querySelector(selector);
                if (authorElement) {
                  author = authorElement.textContent?.trim() || '';
                  break;
                }
              }

              // Extract latest chapter info
              const chapterSelectors = ['div.bigor > div.adds > div'];
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
              const lastUpdated = document.querySelector('div.bigor > div.epxdate')?.textContent?.trim();
              if (title && mangaId) {
                mangas.push({
                  id: mangaId,
                  title: title,
                  author: author || undefined,
                  coverImage: coverImage || undefined,
                  latestChapter: latestChapter,
                  lastUpdated: lastUpdated || undefined,
                  url: mangaUrl,
                });
              }
            } catch (error) {
              console.error('Error extracting manga data:', error);
            }
          });

          console.log(`Extracted ${mangas.length} doujin items from ${url}`);
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
        const authorSelectors = ['div.tsinfo.bixbox > div:nth-child(3) > span > i'];
        let author = '';
        for (const selector of authorSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            author = element.textContent?.trim().replace(/^(Author|Artist|Created by|By):?\s*/i, '') || '';
            if (author) break;
          }
        }

        // Extract cover image
        const imageSelectors = ['div.thumb > img'];
        let coverImage = '';
        for (const selector of imageSelectors) {
          const element = document.querySelector(selector) as HTMLImageElement;
          if (element) {
            coverImage = element.src || element.getAttribute('data-src') || element.getAttribute('data-lazy-src') || '';
            if (coverImage && !coverImage.includes('placeholder') && !coverImage.includes('avatar')) break;
          }
        }

        // Extract chapters/pages
        const chapters: any[] = [];
        const chapterSelectors = ['#chapterlist ul > li'];

        for (const selector of chapterSelectors) {
          const chapterElements = document.querySelectorAll(selector);
          if (chapterElements.length > 0) {
            chapterElements.forEach((element, index) => {
              const linkElement = element.querySelector('a') as HTMLAnchorElement;
              if (linkElement) {
                const chapterTitleEl = element.querySelector('.chapternum');
                const chapterTitle = chapterTitleEl?.textContent?.trim() || `Chapter ${index + 1}`;
                const chapterUrl = linkElement.href || '';

                // Extract chapter number
                const chapterMatch = chapterTitle.match(/(?:Chapter|Ch\.?|Page|#)\s*(\d+(?:\.\d+)?)/i);
                const chapterNumber = element.getAttribute('data-num')
                  ? parseFloat(element.getAttribute('data-num') || '')
                  : chapterMatch
                    ? parseFloat(chapterMatch[1])
                    : chapters.length + 1;

                // Extract chapter ID from URL or generate one
                let chapterId = `ch-${chapterNumber}`;
                if (chapterUrl) {
                  const urlParts = chapterUrl.split('/');
                  const potentialId = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
                  if (potentialId && potentialId !== 'chapter' && potentialId !== 'page') {
                    chapterId = potentialId;
                  }
                }

                // Extract date if available
                let lastUpdated = element.querySelector('.chapterdate')?.textContent.trim();

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
          title = 'Unknown Doujin';
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
          latestChapter: chapters.length > 0 ? Math.max(...chapters.map(c => c.chapterNumber || 0)) : undefined,
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
    page.on('console', async msg => {
      const msgArgs = msg.args();
      for (let i = 0; i < msgArgs.length; ++i) {
        console.log(await msgArgs[i].jsonValue());
      }
    });
    console.log('Starting extraction of chapter images for URL:', chapterUrl);
    return await page.evaluate(async url => {
      try {
        const sources = Array.from(document.querySelectorAll('script')).filter(t => t.textContent && t.textContent.includes('noimagehtml'));
        console.log('Extracted sources from scripts: ' + sources.length + ' scripts found.');
        if (sources.length > 0) {
          const content = (sources[0].textContent || '').replace(/\/\*<!\[CDATA\[\*\/ts_reader.run\(/g, '').replace(/\);\/\*\]\]>\*\/$/, '');
          const parse = JSON.parse(content);
          if (Array.isArray(parse.sources) && parse.sources.length > 0) {
            console.log('Found image source with ' + (parse.sources[0].images?.length || 0) + ' images.');
            return parse.sources[0].images || [];
          }
        }
        /*
        // await page.waitForSelector('#readerarea > p > img:nth-child(1)', { timeout: 5000 });
        const sources = Array.from(document.querySelectorAll('script')).filter(t => t.textContent && t.textContent.includes('noimagehtml'));
        console.log('Extracted sources from scripts: ' + sources.length + ' scripts found.');
        const images: ChapterImageDto[] = [];
        // God-doujin.com specific selectors for chapter images
        const imageSelectors = ['#readerarea > p > img'];
        console.log('Starting image extraction for chapter:' + url + ' with selectors count: ' + imageSelectors.length);
        imageSelectors.forEach(selector => {
          console.log('Using image selector:', selector);
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
                const canvasId = `god-doujin-page-${index}-${Date.now()}`;
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
                      
                      // Add god-doujin specific decryption/descrambling logic here
                      console.log('Loaded protected image for god-doujin:', '${src}');
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
        });*/
        return Promise.resolve([]);
      } catch (error) {
        console.error('Error extracting chapter images:', error);
        return [];
      }
    }, chapterUrl);
  }

  private generateMockLatestUpdated(limit: number): MangaItemDto[] {
    return Array.from({ length: limit }, (_, i) => ({
      id: `god-doujin-${i + 1}`,
      title: `God Doujin Title ${i + 1}`,
      author: 'God Doujin Artist',
      coverImage: `https://via.placeholder.com/200x300?text=GodDoujin+${i + 1}`,
      latestChapter: i + 20,
      lastUpdated: new Date().toISOString(),
      url: `${this.websiteUrl}/manga/god-doujin-${i + 1}`,
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
      title: 'God Doujin Demo Title',
      author: 'God Doujin Demo Artist',
      coverImage: 'https://via.placeholder.com/200x300?text=GodDoujin+Demo',
      latestChapter: 25,
      lastUpdated: new Date().toISOString(),
      url: `${this.websiteUrl}/manga/${mangaKey}`,
      chapters: Array.from({ length: 25 }, (_, i) => ({
        id: `ch-${i + 1}`,
        title: `Chapter ${i + 1}`,
        url: `${this.websiteUrl}/manga/${mangaKey}/chapter-${i + 1}`,
        chapterNumber: i + 1,
        publishedAt: new Date(Date.now() - (25 - i) * 86400000),
      })),
    };
  }
}
