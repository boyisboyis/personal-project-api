import { Injectable, Logger } from '@nestjs/common';
import { MangaScraperAdapter } from '@/manga/adapters/base/manga-scraper.interface';
import { MangaItemDto } from '@/manga/dto/last-updated.dto';
import { MangaPuppeteerService, MangaScrapingConfig } from '@/manga/services/manga-puppeteer-improved.service';
import { Page } from 'puppeteer';

@Injectable()
export abstract class BaseMangaAdapter implements MangaScraperAdapter {
  protected readonly logger = new Logger(this.constructor.name);
  protected puppeteerService: MangaPuppeteerService;

  abstract readonly websiteKey: string;
  abstract readonly websiteName: string;
  abstract readonly websiteUrl: string;

  /**
   * Set puppeteer service - will be injected by concrete adapters
   */
  protected setPuppeteerService(puppeteerService: MangaPuppeteerService): void {
    this.puppeteerService = puppeteerService;
  }

  /**
   * Default implementation with simulation delay
   */
  protected async simulateNetworkDelay(min: number = 300, max: number = 1000): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Create a manga item with default values
   */
  protected createMangaItem(
    data: Partial<MangaItemDto> & {
      id: string;
      title: string;
      lastUpdated: Date;
    }
  ): MangaItemDto {
    return {
      id: data.id,
      title: data.title,
      author: data.author,
      coverImage: data.coverImage,
      latestChapter: data.latestChapter,
      lastUpdated: data.lastUpdated,
      url: data.url || `${this.websiteUrl}/manga/${data.id}`,
    };
  }

  /**
   * Extract manga slug/ID from URL
   * Examples:
   * - https://www.niceoppai.net/Glory-Hole/ → Glory-Hole
   * - https://www.niceoppai.net/Long-Title-Name/ → Long-Title-Name
   * - https://www.dokimori.com/manga/some-title/ → some-title
   */
  protected extractSlugFromUrl(url: string, websiteKey: string): string {
    try {
      if (!url) {
        return '';
      }

      // Handle different URL formats
      let cleanUrl = url.trim();
      
      // Remove protocol and domain if present
      const urlParts = cleanUrl.split('/').filter(part => part && part !== 'http:' && part !== 'https:');
      
      // Find the relevant part (usually after domain)
      let slug = '';
      const domainIndex = urlParts.findIndex(part => 
        part.includes('.com') || 
        part.includes('.net') || 
        part.includes('.org') ||
        part.includes('.co') ||
        part.includes('www.')
      );

      if (domainIndex >= 0 && domainIndex < urlParts.length - 1) {
        // Get all parts after domain
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
          slug = pathParts.find(part => 
            part.length > 3 && 
            !part.includes('.') && 
            part !== 'manga' && 
            part !== 'series' &&
            part !== 'chapter' &&
            part !== 'read'
          ) || pathParts[pathParts.length - 1] || '';
        }
      } else {
        // Fallback: get the longest meaningful part
        slug = urlParts.find(part => 
          part.length > 3 && 
          !part.includes('.') && 
          part !== 'manga' && 
          part !== 'series' &&
          part !== 'chapter'
        ) || urlParts[urlParts.length - 1] || '';
      }

      // Clean up the slug
      slug = slug.replace(/\/$/, ''); // Remove trailing slash
      
      return slug || `${websiteKey}-unknown`;
    } catch (error) {
      return `${websiteKey}-error`;
    }
  }

  /**
   * Log adapter operation
   */
  protected logOperation(operation: string, details?: any): void {
    this.logger.log(`[${this.websiteKey}] ${operation}`, details);
  }

  /**
   * Handle errors gracefully
   */
  protected handleError(operation: string, error: any): never {
    this.logger.error(`[${this.websiteKey}] ${operation} failed:`, error.message);
    throw new Error(`${this.websiteName} adapter error: ${error.message}`);
  }

  /**
   * Get default scraping configuration for this website
   */
  protected getDefaultScrapingConfig(): MangaScrapingConfig {
    return {
      headless: true,
      timeout: 30000,
      viewport: { width: 1366, height: 768 },
      delay: { min: 1000, max: 3000 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };
  }

  /**
   * Scrape manga list using Puppeteer
   */
  protected async scrapeMangaListWithPuppeteer(
    url: string, 
    limit: number = 10, 
    config?: Partial<MangaScrapingConfig>
  ): Promise<MangaItemDto[]> {
    if (!this.puppeteerService) {
      throw new Error('Puppeteer service not initialized');
    }

    const scrapingConfig = { ...this.getDefaultScrapingConfig(), ...config };
    const result = await this.puppeteerService.scrapeMangaList(url, limit, this, scrapingConfig);

    if (result.errors.length > 0) {
      this.logger.warn(`Scraping completed with errors:`, result.errors);
    }
    console.log('url:(', url, ') limit:(', limit, ') result.manga.length:', result.manga.length);
    return result.manga.slice(0, limit);
  }

  abstract getLatestUpdated(page?: number, limit?: number): Promise<MangaItemDto[]>;
  abstract searchManga(query: string, limit?: number): Promise<MangaItemDto[]>;
  abstract getMangaDetails(identifier: string): Promise<MangaItemDto | null>;
  
  /**
   * Extract manga data from a Puppeteer page - must be implemented by each adapter
   */
  abstract extractMangaData(page: Page, baseUrl: string, limit?: number): Promise<MangaItemDto[]>;

  async isAvailable(): Promise<boolean> {
    try {
      // Simple availability check - can be overridden by specific adapters
      await this.simulateNetworkDelay(100, 300);
      return true;
    } catch (error) {
      this.logger.warn(`[${this.websiteKey}] Availability check failed:`, error.message);
      return false;
    }
  }
}
