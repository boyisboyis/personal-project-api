import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { Browser, Page } from 'puppeteer';
import { MangaItemDto } from '@/manga/dto/last-updated.dto';
import { MangaScraperAdapter } from '@/manga/adapters/base/manga-scraper.interface';

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

export interface MangaDetailsScrapingResult {
  manga: MangaItemDto | null;
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
  private lastBrowserLaunchError: Date | null = null;
  private consecutiveFailures = 0;
  private readonly maxConsecutiveFailures = 3;
  private readonly failureCooldownMs = 60000; // 1 minute cooldown

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

    // Clean up disconnected browsers first
    await this.cleanupDisconnectedBrowsers();

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
        this.browserInUse.delete(availableBrowser);
        this.logger.debug('Removed disconnected browser from pool');
      }
    }

    // Create new browser if pool is not full or we're on Railway (limit to 1 browser)
    const maxPoolSize = process.env.RAILWAY_ENVIRONMENT === 'production' ? 1 : this.maxPoolSize;
    if (this.browserPool.length < maxPoolSize) {
      try {
        const browser = await this.launchBrowser(config);
        this.browserPool.push(browser);
        this.browserInUse.add(browser);
        this.logger.debug(`Created new browser. Pool size: ${this.browserPool.length}/${maxPoolSize}`);
        return browser;
      } catch (error) {
        this.logger.error('Failed to create new browser, will retry:', error.message);
        // Wait a moment and try once more
        await new Promise(resolve => setTimeout(resolve, 1000));
        const browser = await this.launchBrowser(config);
        this.browserPool.push(browser);
        this.browserInUse.add(browser);
        this.logger.debug(`Created new browser on retry. Pool size: ${this.browserPool.length}/${maxPoolSize}`);
        return browser;
      }
    }

    // Wait for available browser if pool is full
    return this.waitForAvailableBrowser(config);
  }

  /**
   * Clean up disconnected browsers from pool
   */
  private async cleanupDisconnectedBrowsers(): Promise<void> {
    const cleanupPromises = this.browserPool.map(async (browser, index) => {
      try {
        await browser.version();
        return { browser, connected: true };
      } catch (error) {
        return { browser, connected: false };
      }
    });

    const results = await Promise.allSettled(cleanupPromises);
    const disconnectedBrowsers: Browser[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && !result.value.connected) {
        disconnectedBrowsers.push(this.browserPool[index]);
      }
    });

    if (disconnectedBrowsers.length > 0) {
      this.browserPool = this.browserPool.filter(browser => !disconnectedBrowsers.includes(browser));
      disconnectedBrowsers.forEach(browser => this.browserInUse.delete(browser));
      this.logger.debug(`Cleaned up ${disconnectedBrowsers.length} disconnected browsers`);
    }
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
    // Circuit breaker: check if we should avoid launching due to recent failures
    if (this.lastBrowserLaunchError && this.consecutiveFailures >= this.maxConsecutiveFailures) {
      const timeSinceLastError = Date.now() - this.lastBrowserLaunchError.getTime();
      if (timeSinceLastError < this.failureCooldownMs) {
        const remainingCooldown = Math.ceil((this.failureCooldownMs - timeSinceLastError) / 1000);
        throw new Error(`Browser launch circuit breaker active. Try again in ${remainingCooldown} seconds.`);
      } else {
        // Reset circuit breaker after cooldown
        this.consecutiveFailures = 0;
        this.lastBrowserLaunchError = null;
        this.logger.log('Browser launch circuit breaker reset after cooldown');
      }
    }

    try {
      const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production';
      
      const browser = await puppeteer.launch({
        headless: config.headless ?? true,
        timeout: isRailway ? 60000 : 30000, // Longer timeout for Railway
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--disable-gpu',
          '--memory-pressure-off',
          '--disable-extensions',
          '--disable-default-apps',
          '--disable-plugins',
          '--disable-images', // Disable image loading to save memory
          ...(isRailway ? [
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--no-zygote', // Keep this for Railway
            '--max_old_space_size=384', // Reduced memory limit for Railway
            '--disable-dev-tools'
          ] : [
            '--no-zygote'
          ])
        ],
        // Use system Chromium on Railway
        executablePath: isRailway && process.env.PUPPETEER_EXECUTABLE_PATH 
          ? process.env.PUPPETEER_EXECUTABLE_PATH 
          : undefined,
      });

      // Test browser connection
      await browser.version();
      
      // Reset failure count on successful launch
      this.consecutiveFailures = 0;
      this.lastBrowserLaunchError = null;
      
      this.logger.debug(`Browser launched successfully: ${await browser.version()}`);
      return browser;
    } catch (error) {
      // Track consecutive failures
      this.consecutiveFailures++;
      this.lastBrowserLaunchError = new Date();
      
      this.logger.error(`Failed to launch browser (attempt ${this.consecutiveFailures}):`, error);
      
      if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
        this.logger.error('Too many consecutive browser launch failures. Circuit breaker activated.');
      }
      
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
    const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production';
    
    // Set viewport
    if (config.viewport) {
      await page.setViewport(config.viewport);
    } else {
      await page.setViewport({ width: 1920, height: 1080 });
    }

    // Set user agent
    const userAgent = config.userAgent || 'Mozilla/5.0 (compatible; MangaBot/1.0)';
    await page.setUserAgent(userAgent);

    // Set page timeouts for Railway
    if (isRailway) {
      page.setDefaultNavigationTimeout(90000); // 90 seconds for Railway
      page.setDefaultTimeout(60000); // 60 seconds for other operations
    }

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
   * Scrape manga list from a webpage using specific adapter
   */
  async scrapeMangaList(
    url: string, 
    limit: number,
    adapter: MangaScraperAdapter, 
    config: MangaScrapingConfig = {}
  ): Promise<MangaScrapingResult> {
    const startTime = Date.now();
    let browser: Browser | null = null;
    let page: Page | null = null;
    const errors: string[] = [];
    const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production';

    try {
      this.logger.log(`[${adapter.websiteKey}] Starting manga scraping from ${url}${isRailway ? ' (Railway)' : ''}`);

      browser = await this.getBrowser(config);
      page = await browser.newPage();

      // Configure page
      await this.configurePage(page, config);

      // Navigate to URL
      this.logger.debug(`[${adapter.websiteKey}] Navigating to: ${url}`);
      
      await page.goto(url, {
        waitUntil: isRailway ? 'domcontentloaded' : 'networkidle0', // Faster loading on Railway
        timeout: config.timeout || (isRailway ? 90000 : 30000), // Extended timeout for Railway
      });

      // Wait for content if selector specified
      if (config.waitForSelector) {
        await page.waitForSelector(config.waitForSelector, {
          timeout: isRailway ? 30000 : 10000, // Extended selector timeout for Railway
        });
      }

      // Add delay
      if (config.delay) {
        const delay = typeof config.delay === 'number' ? config.delay : Math.floor(Math.random() * (config.delay.max - config.delay.min + 1)) + config.delay.min;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      console.log('Page loaded, starting data extraction.', await page.title());
      
      // Extract manga data using adapter-specific logic
      const manga = await adapter.extractMangaData(page, url, limit);
      const scrapingTime = Date.now() - startTime;

      this.logger.log(`[${adapter.websiteKey}] Successfully scraped ${manga.length} manga items in ${scrapingTime}ms`);

      return {
        manga,
        totalFound: manga.length,
        scrapingTime,
        errors,
      };
    } catch (error) {
      console.error(`[${adapter.websiteKey}] Error during scraping:`, error);
      const scrapingTime = Date.now() - startTime;
      errors.push(error.message);
      this.logger.error(`[${adapter.websiteKey}] Error scraping manga list from ${url}:`, error.message);

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
   * Scrape manga details from a specific manga page
   */
  async scrapeMangaDetails(
    url: string,
    adapter: MangaScraperAdapter,
    config: MangaScrapingConfig = {}
  ): Promise<MangaDetailsScrapingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      this.logger.log(`[${adapter.websiteKey}] Starting manga details scraping from ${url}`);
      
      browser = await this.getBrowser(config);
      page = await browser.newPage();

      // Configure page
      await this.configurePage(page, config);

      // Navigate to the page
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: config.timeout || 30000 
      });

      if (!response || !response.ok()) {
        throw new Error(`Failed to load page: ${response?.status()} ${response?.statusText()}`);
      }

      // Apply delay if configured
      if (config.delay) {
        const delay = typeof config.delay === 'number' 
          ? config.delay 
          : Math.random() * (config.delay.max - config.delay.min) + config.delay.min;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Wait for selector if specified
      if (config.waitForSelector) {
        const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production';
        await page.waitForSelector(config.waitForSelector, { 
          timeout: config.timeout || (isRailway ? 30000 : 10000)
        });
      }

      // Extract manga details using adapter's method
      const mangaDetails = await (adapter as any).extractMangaDetails(page, url);
      const scrapingTime = Date.now() - startTime;

      this.logger.log(`[${adapter.websiteKey}] Manga details scraping completed in ${scrapingTime}ms`);

      return {
        manga: mangaDetails,
        scrapingTime,
        errors,
      };
    } catch (error) {
      console.error(`[${adapter.websiteKey}] Error during manga details scraping:`, error);
      const scrapingTime = Date.now() - startTime;
      errors.push(error.message);
      this.logger.error(`[${adapter.websiteKey}] Error scraping manga details from ${url}:`, error.message);

      return {
        manga: null,
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
   * Scrape chapter images from a specific chapter page
   */
  async scrapeChapterImages(
    url: string,
    adapter: MangaScraperAdapter,
    config: MangaScrapingConfig = {}
  ): Promise<{ images: string[]; scrapingTime: number; errors: string[] }> {
    const startTime = Date.now();
    const errors: string[] = [];
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      this.logger.log(`[${adapter.websiteKey}] Starting chapter images scraping from ${url}`);
      
      browser = await this.getBrowser(config);
      page = await browser.newPage();

      // Configure page
      await this.configurePage(page, config);

      // Navigate to the page
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: config.timeout || 30000 
      });

      if (!response || !response.ok()) {
        throw new Error(`Failed to load page: ${response?.status()} ${response?.statusText()}`);
      }

      // Apply delay if configured
      if (config.delay) {
        const delay = typeof config.delay === 'number' 
          ? config.delay 
          : Math.random() * (config.delay.max - config.delay.min) + config.delay.min;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Wait for selector if specified
      if (config.waitForSelector) {
        await page.waitForSelector(config.waitForSelector, { timeout: config.timeout || 10000 });
      }

      // Extract chapter images using adapter's method
      const images = await (adapter as any).extractChapterImages?.(page, url) || [];
      const scrapingTime = Date.now() - startTime;

      this.logger.log(`[${adapter.websiteKey}] Chapter images scraping completed: ${images.length} images in ${scrapingTime}ms`);

      return {
        images,
        scrapingTime,
        errors,
      };
    } catch (error) {
      console.error(`[${adapter.websiteKey}] Error during chapter images scraping:`, error);
      const scrapingTime = Date.now() - startTime;
      errors.push(error.message);
      this.logger.error(`[${adapter.websiteKey}] Error scraping chapter images from ${url}:`, error.message);

      return {
        images: [],
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
}
