import { MangaItemDto } from '@/manga/dto/last-updated.dto';
import { ChapterImageDto } from '@/manga/dto/chapter-image.dto';
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

  /**
   * Extract detailed manga information from a manga detail page
   * @param page Puppeteer page instance
   * @param url URL of the manga detail page
   * @returns Promise resolving to manga details with chapters
   */
  extractMangaDetails?(page: Page, url: string): Promise<MangaItemDto | null>;

  /**
   * Extract chapter images from a chapter page
   * @param page Puppeteer page instance
   * @param chapterUrl URL of the chapter page
   * @returns Promise resolving to array of image data with metadata or legacy string URLs
   */
  extractChapterImages?(page: Page, chapterUrl: string): Promise<ChapterImageDto[] | string[]>;
}
