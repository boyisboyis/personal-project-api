import { Injectable, Logger } from '@nestjs/common';
import { MangaScraperAdapter } from './manga-scraper.interface';
import { MangaItemDto } from '../../dto/last-updated.dto';

@Injectable()
export abstract class BaseMangaAdapter implements MangaScraperAdapter {
  protected readonly logger = new Logger(this.constructor.name);

  abstract readonly websiteKey: string;
  abstract readonly websiteName: string;
  abstract readonly websiteUrl: string;

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

  abstract getLatestUpdated(limit?: number): Promise<MangaItemDto[]>;
  abstract searchManga(query: string, limit?: number): Promise<MangaItemDto[]>;
  abstract getMangaDetails(identifier: string): Promise<MangaItemDto | null>;

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
