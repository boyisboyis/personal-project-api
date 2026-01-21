import { MangaItemDto } from '@/manga/dto/last-updated.dto';
import { Page } from 'puppeteer';

export interface MangaScraperAdapter {
  /**
   * Website identifier key
   */
  readonly websiteKey: string;

  /**
   * Website display name
   */
  readonly websiteName: string;

  /**
   * Website base URL
   */
  readonly websiteUrl: string;

  /**
   * Get latest updated manga from this website
   * @param page Page number for pagination
   * @param limit Maximum number of manga to return
   * @returns Promise resolving to array of manga items
   */
  getLatestUpdated(page?: number, limit?: number): Promise<MangaItemDto[]>;

  /**
   * Search manga by title or keywords
   * @param query Search query
   * @param limit Maximum number of results
   * @returns Promise resolving to array of manga items
   */
  searchManga(query: string, limit?: number): Promise<MangaItemDto[]>;

  /**
   * Get manga details by URL or ID
   * @param identifier Manga URL or ID
   * @returns Promise resolving to manga details
   */
  getMangaDetails(identifier: string): Promise<MangaItemDto | null>;

  /**
   * Check if the adapter is available and working
   * @returns Promise resolving to boolean
   */
  isAvailable(): Promise<boolean>;

  /**
   * Extract manga data from a Puppeteer page
   * Each adapter implements its own scraping logic
   * @param page Puppeteer page instance
   * @param baseUrl Base URL of the website
   * @param limit Maximum number of manga to extract
   * @returns Promise resolving to array of manga items
   */
  extractMangaData(page: Page, baseUrl: string, limit?: number): Promise<MangaItemDto[]>;
}
