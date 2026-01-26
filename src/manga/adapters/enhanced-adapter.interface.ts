import { ChapterImageDto } from '../dto/chapter-image.dto';
import { MangaScraperAdapter } from './base/manga-scraper.interface';
import { AdapterImageHelper } from '../utils/adapter-image.helper';
import { Page } from 'puppeteer';

/**
 * Enhanced manga scraper adapter that supports both legacy and new image formats
 */
export interface EnhancedMangaScraperAdapter extends Omit<MangaScraperAdapter, 'extractChapterImages'> {
  /**
   * Extract chapter images with enhanced metadata (new format)
   */
  extractChapterImagesEnhanced?(page: Page, chapterUrl: string): Promise<ChapterImageDto[]>;

  /**
   * Legacy method for backward compatibility (still returns string[])
   * Will be automatically converted to ChapterImageDto[] by the wrapper
   */
  extractChapterImages?(page: Page, chapterUrl: string): Promise<string[]>;
}

/**
 * Wrapper class to provide backward compatibility for existing adapters
 */
export class AdapterWrapper {
  /**
   * Wrap an adapter to provide enhanced image extraction
   */
  static wrapAdapter(adapter: MangaScraperAdapter): EnhancedMangaScraperAdapter {
    const wrapped = adapter as EnhancedMangaScraperAdapter;
    
    // If adapter already has enhanced method, use it
    if (wrapped.extractChapterImagesEnhanced) {
      return wrapped;
    }

    // Create enhanced method from legacy method
    if (wrapped.extractChapterImages) {
      const originalMethod = wrapped.extractChapterImages.bind(wrapped);
      
      wrapped.extractChapterImagesEnhanced = async (page: Page, chapterUrl: string): Promise<ChapterImageDto[]> => {
        const legacyImages = await originalMethod(page, chapterUrl);
        return AdapterImageHelper.convertLegacyImages(legacyImages, adapter.websiteKey);
      };
    }

    return wrapped;
  }

  /**
   * Get images from adapter, trying enhanced method first, falling back to legacy
   */
  static async getChapterImages(adapter: MangaScraperAdapter, page: Page, chapterUrl: string): Promise<ChapterImageDto[]> {
    try {
      // Try extracting images using the adapter's method
      if (adapter.extractChapterImages) {
        const result = await adapter.extractChapterImages(page, chapterUrl);
        
        // Check if result is already in new format
        if (result.length > 0 && typeof result[0] === 'object' && 'url' in result[0]) {
          return result as ChapterImageDto[];
        }
        
        // Convert legacy string[] format to new format
        return AdapterImageHelper.convertLegacyImages(result as string[], adapter.websiteKey);
      }

      return [];
    } catch (error) {
      console.error('Error extracting chapter images:', error);
      return [];
    }
  }
}