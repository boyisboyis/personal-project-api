import { Injectable, Logger } from '@nestjs/common';
import puppeteer, { Browser, Page } from 'puppeteer';
import { MangaItemDto } from '@/manga/dto/last-updated.dto';

export interface MangaScrapingConfig {
  headless?: boolean;
  timeout?: number;
  waitForSelector?: string;
  userAgent?: string;
  viewport?: { width: number; height: number };
  delay?: { min: number; max: number };
}

export interface MangaScrapingResult {
  manga: MangaItemDto[];
  totalFound: number;
  scrapingTime: number;
  errors: string[];
}

@Injectable()
export class MangaPuppeteerService {
  private readonly logger = new Logger(MangaPuppeteerService.name);

  /**
   * Scrape manga list from a website
   */
  async scrapeMangaList(url: string, websiteKey: string, config: MangaScrapingConfig = {}): Promise<MangaScrapingResult> {
    const startTime = Date.now();
    this.logger.log(`[${websiteKey}] Starting manga scraping from ${url}`);

    const browser = await this.launchBrowser(config);
    try {
      const page = await this.setupPage(browser, config);
      
      // Navigate to the page
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: config.timeout || 30000,
      });

      // Wait for content to load
      if (config.waitForSelector) {
        await page.waitForSelector(config.waitForSelector, { timeout: 10000 });
      }

      // Apply random delay to mimic human behavior
      if (config.delay) {
        const delay = Math.random() * (config.delay.max - config.delay.min) + config.delay.min;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Extract manga data based on website
      const manga = await this.extractMangaData(page, websiteKey);
      
      const scrapingTime = Date.now() - startTime;
      this.logger.log(`[${websiteKey}] Successfully scraped ${manga.length} manga in ${scrapingTime}ms`);

      return {
        manga,
        totalFound: manga.length,
        scrapingTime,
        errors: [],
      };
    } catch (error) {
      const scrapingTime = Date.now() - startTime;
      this.logger.error(`[${websiteKey}] Scraping failed after ${scrapingTime}ms:`, error.message);
      
      return {
        manga: [],
        totalFound: 0,
        scrapingTime,
        errors: [error.message],
      };
    } finally {
      await browser.close();
    }
  }

  /**
   * Scrape single manga details
   */
  async scrapeMangaDetails(url: string, websiteKey: string, config: MangaScrapingConfig = {}): Promise<MangaItemDto | null> {
    this.logger.log(`[${websiteKey}] Scraping manga details from ${url}`);

    const browser = await this.launchBrowser(config);
    try {
      const page = await this.setupPage(browser, config);
      
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: config.timeout || 30000,
      });

      if (config.waitForSelector) {
        await page.waitForSelector(config.waitForSelector, { timeout: 10000 });
      }

      const mangaDetails = await this.extractSingleMangaData(page, websiteKey, url);
      
      this.logger.log(`[${websiteKey}] Successfully scraped manga details: ${mangaDetails?.title || 'Unknown'}`);
      return mangaDetails;
    } catch (error) {
      this.logger.error(`[${websiteKey}] Failed to scrape manga details:`, error.message);
      return null;
    } finally {
      await browser.close();
    }
  }

  private async launchBrowser(config: MangaScrapingConfig): Promise<Browser> {
    return puppeteer.launch({
      headless: config.headless !== false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
      ],
    });
  }

  private async setupPage(browser: Browser, config: MangaScrapingConfig): Promise<Page> {
    const page = await browser.newPage();
    
    // Set viewport
    const viewport = config.viewport || { width: 1366, height: 768 };
    await page.setViewport(viewport);

    // Set user agent
    const userAgent = config.userAgent || 
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    await page.setUserAgent(userAgent);

    // Block unnecessary resources for faster loading
    await page.setRequestInterception(true);
    page.on('request', request => {
      const resourceType = request.resourceType();
      if (['image', 'font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    return page;
  }

  private async extractMangaData(page: Page, websiteKey: string): Promise<MangaItemDto[]> {
    try {
      // Generic extraction logic - can be customized per website
      const mangaData = await page.evaluate((siteKey: string) => {
        const manga: any[] = [];
        
        // Common selectors that might work across manga sites
        const selectors = {
          niceoppai: {
            container: '.manga-item, .post-item, .entry-item',
            title: '.title, .entry-title, h2, h3',
            link: 'a[href*="manga"], a[href*="series"]',
            chapter: '.chapter, .latest-chapter, .chapter-num',
            image: 'img',
            author: '.author, .manga-author',
          },
          dokimori: {
            container: '.manga-card, .series-item, .post',
            title: '.manga-title, .series-title, h2, h3',
            link: 'a[href*="manga"], a[href*="series"]',
            chapter: '.chapter-info, .latest-chap',
            image: 'img',
            author: '.author-name, .creator',
          },
          default: {
            container: '.manga, .series, .post, .item, article',
            title: 'h1, h2, h3, .title',
            link: 'a',
            chapter: '.chapter, .ch, .episode',
            image: 'img',
            author: '.author, .creator, .writer',
          }
        };

        const config = (selectors as any)[siteKey] || selectors.default;
        const containers = document.querySelectorAll(config.container);

        containers.forEach((container, index) => {
          try {
            const titleEl = container.querySelector(config.title);
            const linkEl = container.querySelector(config.link);
            const chapterEl = container.querySelector(config.chapter);
            const imageEl = container.querySelector(config.image);
            const authorEl = container.querySelector(config.author);

            const title = titleEl?.textContent?.trim();
            const url = linkEl?.getAttribute('href');
            
            if (title && url) {
              // Extract chapter number from text
              const chapterText = chapterEl?.textContent?.trim() || '';
              const chapterMatch = chapterText.match(/(\d+(?:\.\d+)?)/);
              
              manga.push({
                id: `${siteKey}-${index + 1}`,
                title,
                url: url.startsWith('http') ? url : `${window.location.origin}${url}`,
                author: authorEl?.textContent?.trim() || undefined,
                coverImage: imageEl?.getAttribute('src') || imageEl?.getAttribute('data-src') || undefined,
                latestChapter: chapterMatch ? parseInt(chapterMatch[1]) : undefined,
                lastUpdated: new Date().toISOString(),
              });
            }
          } catch (err) {
            console.warn('Error extracting manga item:', err);
          }
        });

        return manga;
      }, websiteKey);

      return mangaData.map(item => ({
        ...item,
        lastUpdated: new Date(item.lastUpdated),
      }));
    } catch (error) {
      this.logger.error(`Failed to extract manga data for ${websiteKey}:`, error.message);
      return [];
    }
  }

  private async extractSingleMangaData(page: Page, websiteKey: string, url: string): Promise<MangaItemDto | null> {
    try {
      const mangaData = await page.evaluate((siteKey: string, pageUrl: string) => {
        // Extract detailed manga information from individual manga page
        const title = document.querySelector('h1, .manga-title, .series-title')?.textContent?.trim();
        const author = document.querySelector('.author, .manga-author, .creator')?.textContent?.trim();
        const description = document.querySelector('.description, .summary, .synopsis')?.textContent?.trim();
        const coverImage = document.querySelector('.manga-cover img, .cover img, .poster img')?.getAttribute('src');
        
        // Extract latest chapter
        const chapterElements = document.querySelectorAll('.chapter, .chapter-list li, .episode');
        let latestChapter = 0;
        
        chapterElements.forEach(el => {
          const chapterText = el.textContent || '';
          const chapterMatch = chapterText.match(/(\d+(?:\.\d+)?)/);
          if (chapterMatch) {
            const chapterNum = parseFloat(chapterMatch[1]);
            if (chapterNum > latestChapter) {
              latestChapter = chapterNum;
            }
          }
        });

        if (!title) return null;

        return {
          id: `${siteKey}-${Date.now()}`,
          title,
          author,
          description,
          coverImage: coverImage?.startsWith('http') ? coverImage : (coverImage ? `${window.location.origin}${coverImage}` : undefined),
          latestChapter: latestChapter > 0 ? latestChapter : undefined,
          url: pageUrl,
          lastUpdated: new Date().toISOString(),
        };
      }, websiteKey, url);

      if (!mangaData) return null;

      return {
        ...mangaData,
        lastUpdated: new Date(mangaData.lastUpdated),
      };
    } catch (error) {
      this.logger.error(`Failed to extract single manga data:`, error.message);
      return null;
    }
  }
}