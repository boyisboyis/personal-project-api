import { MangaItemDto } from '../../dto/last-updated.dto';

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
   * @param limit Maximum number of manga to return
   * @returns Promise resolving to array of manga items
   */
  getLatestUpdated(limit?: number): Promise<MangaItemDto[]>;

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
}
