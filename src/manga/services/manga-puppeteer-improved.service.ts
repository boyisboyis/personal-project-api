import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { Browser, Page } from 'puppeteer';
import { MangaItemDto } from '@/manga/dto/last-updated.dto';

export interface MangaScrapingConfig {
  headless?: boolean;
  timeout?: number;
  waitForSelector?: string;
  userAgent?: string;
  viewport?: { width: number; height: number };
  delay?: number | { min: number; max: number };
}

export interface MangaScrapingResult {
  manga: MangaItemDto[];
  totalFound: number;
  scrapingTime: number;
  errors: string[];
}

@Injectable()
export class MangaPuppeteerService implements OnModuleDestroy {
  private readonly logger = new Logger(MangaPuppeteerService.name);
  private browserPool: Browser[] = [];
  private readonly maxPoolSize = 3;
  private browserInUse = new Set<Browser>();
  private isShuttingDown = false;

  /**
   * OnModuleDestroy lifecycle hook for cleanup
   */
  async onModuleDestroy() {
    this.isShuttingDown = true;
    await this.closeAllBrowsers();
  }

  /**
   * Get a browser from pool or create new one
   */
  private async getBrowser(config: MangaScrapingConfig = {}): Promise<Browser> {
    if (this.isShuttingDown) {
      throw new Error('Service is shutting down');
    }

    // Try to get available browser from pool
    const availableBrowser = this.browserPool.find(browser => !this.browserInUse.has(browser));
    if (availableBrowser) {
      try {
        // Test if browser is still connected
        await availableBrowser.version();
        this.browserInUse.add(availableBrowser);
        this.logger.debug(`Reused browser from pool. Pool size: ${this.browserPool.length}`);
        return availableBrowser;
      } catch (error) {
        // Browser is disconnected, remove from pool
        this.browserPool = this.browserPool.filter(b => b !== availableBrowser);
        this.logger.debug('Removed disconnected browser from pool');
      }
    }

    // Create new browser if pool is not full
    if (this.browserPool.length < this.maxPoolSize) {
      const browser = await this.launchBrowser(config);
      this.browserPool.push(browser);
      this.browserInUse.add(browser);
      this.logger.debug(`Created new browser. Pool size: ${this.browserPool.length}`);
      return browser;
    }

    // Wait for available browser if pool is full
    return this.waitForAvailableBrowser(config);
  }

  /**
   * Release browser back to pool
   */
  private releaseBrowser(browser: Browser): void {
    this.browserInUse.delete(browser);
    this.logger.debug(`Released browser back to pool. In use: ${this.browserInUse.size}`);
  }

  /**
   * Wait for available browser when pool is full
   */
  private async waitForAvailableBrowser(config: MangaScrapingConfig, timeout = 30000): Promise<Browser> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const availableBrowser = this.browserPool.find(browser => !this.browserInUse.has(browser));
      if (availableBrowser) {
        try {
          await availableBrowser.version();
          this.browserInUse.add(availableBrowser);
          return availableBrowser;
        } catch (error) {
          this.browserPool = this.browserPool.filter(b => b !== availableBrowser);
        }
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error('Timeout waiting for available browser');
  }

  /**
   * Launch new browser instance
   */
  private async launchBrowser(config: MangaScrapingConfig = {}): Promise<Browser> {
    try {
      const browser = await puppeteer.launch({
        headless: config.headless ?? true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--memory-pressure-off',
        ],
      });

      this.logger.debug(`Browser launched successfully: ${await browser.version()}`);
      return browser;
    } catch (error) {
      this.logger.error('Failed to launch browser:', error);
      throw new Error(`Failed to launch browser: ${error.message}`);
    }
  }

  /**
   * Close all browsers in pool
   */
  private async closeAllBrowsers(): Promise<void> {
    this.logger.log('Closing all browsers in pool...');

    const closePromises = this.browserPool.map(async browser => {
      try {
        await browser.close();
        this.logger.debug('Browser closed successfully');
      } catch (error) {
        this.logger.warn('Error closing browser:', error.message);
      }
    });

    await Promise.allSettled(closePromises);
    this.browserPool = [];
    this.browserInUse.clear();
    this.logger.log('All browsers closed');
  }

  /**
   * Configure page with common settings
   */
  private async configurePage(page: Page, config: MangaScrapingConfig): Promise<void> {
    // Set viewport
    if (config.viewport) {
      await page.setViewport(config.viewport);
    } else {
      await page.setViewport({ width: 1920, height: 1080 });
    }

    // Set user agent
    const userAgent = config.userAgent || 'Mozilla/5.0 (compatible; MangaBot/1.0)';
    await page.setUserAgent(userAgent);

    // Block unnecessary resources for faster loading
    await page.setRequestInterception(true);
    page.on('request', req => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
  }

  /**
   * Scrape manga list from a webpage
   */
  async scrapeMangaList(url: string, websiteKey: string, config: MangaScrapingConfig = {}): Promise<MangaScrapingResult> {
    const startTime = Date.now();
    let browser: Browser | null = null;
    let page: Page | null = null;
    const errors: string[] = [];

    try {
      this.logger.log(`[${websiteKey}] Starting manga scraping from ${url}`);

      browser = await this.getBrowser(config);
      page = await browser.newPage();

      // Configure page
      await this.configurePage(page, config);

      // Navigate to URL
      this.logger.debug(`[${websiteKey}] Navigating to: ${url}`);
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: config.timeout || 30000,
      });

      // Wait for content if selector specified
      if (config.waitForSelector) {
        await page.waitForSelector(config.waitForSelector, {
          timeout: 10000,
        });
      }

      // Add delay
      if (config.delay) {
        const delay = typeof config.delay === 'number' ? config.delay : Math.floor(Math.random() * (config.delay.max - config.delay.min + 1)) + config.delay.min;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      console.log('Page loaded, starting data extraction.', await page.title());
      // Extract manga data
      const manga = await this.extractMangaData(page, url, websiteKey);
      const scrapingTime = Date.now() - startTime;

      this.logger.log(`[${websiteKey}] Successfully scraped ${manga.length} manga items in ${scrapingTime}ms`);

      return {
        manga,
        totalFound: manga.length,
        scrapingTime,
        errors,
      };
    } catch (error) {
      console.error(`[${websiteKey}] Error during scraping:`, error);
      const scrapingTime = Date.now() - startTime;
      errors.push(error.message);
      this.logger.error(`[${websiteKey}] Error scraping manga list from ${url}:`, error.message);

      return {
        manga: [],
        totalFound: 0,
        scrapingTime,
        errors,
      };
    } finally {
      // Clean up
      if (page) {
        try {
          await page.close();
        } catch (error) {
          this.logger.warn('Error closing page:', error.message);
        }
      }

      if (browser) {
        this.releaseBrowser(browser);
      }
    }
  }

  /**
   * Extract manga data from page
   */
  private async extractMangaData(page: Page, baseUrl: string, websiteKey: string, limit: number = 10): Promise<MangaItemDto[]> {
    console.log('Extracting manga data for website key:', websiteKey);
    page.on('console', async msg => {
      const msgArgs = msg.args();
      for (let i = 0; i < msgArgs.length; ++i) {
        console.log(await msgArgs[i].jsonValue());
      }
    });

    return await page.evaluate(
      (siteKey, limit) => {
        const results: MangaItemDto[] = [];

        // Generic selectors for different websites
        const selectors = {
          niceoppai: {
            container: '#text-4 div.nde',
            title: 'a.ttl',
            link: 'a.ttl',
            chapter: 'div.det > ul > li:nth-child(1) > a',
            image: 'div.cvr > a > img',
            author: 'a.ttl',
          },
          dokimori: {
            container: '#loop-content > div:nth-child(1) > div > div',
            title: 'div.item-summary.item-display > div > h4 > a',
            link: 'div.item-summary.item-display > div > h4 > a',
            chapter: 'div.chapter-item > span.chapter.font-meta > a',
            image: 'div.item-summary.item-display > div > h4 > a',
            author: 'div.item-summary.item-display > div > h4 > a',
          },
          godmanga: {
            container: 'div.flexbox4-item',
            title: 'div.flexbox4-side div.title > a',
            link: 'div.flexbox4-content > a',
            chapter: 'div.flexbox4-side ul.chapter > li:first-child a',
            image: 'div.flexbox4-thumb img',
            author: 'div.flexbox4-side div.title > a',
            lastUpdated: 'div.flexbox4-side ul.chapter > li:first-child span.date',
          },
          default: {
            container: '.manga, .series, .item, [class*="manga"], [class*="series"]',
            title: 'h1, h2, h3, .title, [class*="title"]',
            link: 'a',
            chapter: '.chapter, .ch, .episode',
            image: 'img',
            author: '.author, .creator, .writer',
          },
        };
        const config = (selectors as any)[siteKey] || selectors.default;
        const containers = document.querySelectorAll(config.container);
        console.log(`Found ${containers.length} manga containers on the page. ${limit}`);
        containers.forEach((container, index) => {
          try {
            const titleEl = container.querySelector(config.title);
            const linkEl = container.querySelector(config.link);
            let chapterEl = container.querySelector(config.chapter);
            const imageEl = container.querySelector(config.image);
            const authorEl = container.querySelector(config.author);
            const lastUpdatedEl = config.lastUpdated ? container.querySelector(config.lastUpdated) : undefined;

            const title = titleEl?.textContent?.trim();
            const url = linkEl?.getAttribute('href');
            if (siteKey === 'niceoppai' && chapterEl) {
              chapterEl.querySelector('span').remove();
            }
            if (title && results.length < limit) {
              results.push({
                id: `${siteKey}-${index + 1}`,
                title,
                author: authorEl?.textContent?.trim(),
                coverImage: imageEl?.getAttribute('src'),
                latestChapter: chapterEl ? parseInt(chapterEl.textContent?.replace(/\D/g, '') || '0') || undefined : undefined,
                lastUpdated: lastUpdatedEl?.textContent?.trim() || undefined,
                url: url ? (url.startsWith('http') ? url : `${window.location.origin}${url}`) : undefined,
              });
            }
          } catch (error) {
            console.warn('Error extracting manga item:', error);
          }
        });

        return results;
      },
      websiteKey,
      limit
    );
  }
}
