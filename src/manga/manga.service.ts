import { Injectable, Logger } from '@nestjs/common';
import { SupportedWebsiteDto } from '@/manga/dto/supported-website.dto';
import { LastUpdatedResponseDto, MangaItemDto } from '@/manga/dto/last-updated.dto';
import { MangaAdapterService } from '@/manga/services/manga-adapter.service';

export interface Manga {
  id: string;
  title: string;
  author?: string;
  description?: string;
  coverImage?: string;
  chapters?: number;
  status?: 'ongoing' | 'completed' | 'hiatus';
  genres?: string[];
  rating?: number;
  url?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class MangaService {
  private readonly logger = new Logger(MangaService.name);
  private mangas: Manga[] = []; // In-memory storage

  constructor(private readonly mangaAdapterService: MangaAdapterService) {}

  async getSupportedWebsites(): Promise<SupportedWebsiteDto[]> {
    return this.mangaAdapterService.getSupportedWebsites();
  }

  async getLastUpdated(): Promise<LastUpdatedResponseDto> {
    this.logger.log('Delegating to MangaAdapterService for last updated manga');
    return this.mangaAdapterService.getLastUpdated(5);
  }

  // Additional convenience methods using the adapter service

  /**
   * Search manga by website
   */
  async searchMangaByWebsite(websiteKey: string, query: string, limit?: number): Promise<MangaItemDto[]> {
    return this.mangaAdapterService.searchMangaByWebsite(websiteKey, query, limit);
  }

  /**
   * Search manga across all websites
   */
  async searchMangaAllWebsites(query: string, limitPerWebsite?: number): Promise<{ [websiteKey: string]: MangaItemDto[] }> {
    return this.mangaAdapterService.searchMangaAllWebsites(query, limitPerWebsite);
  }

  /**
   * Get manga details from specific website
   */
  async getMangaDetails(websiteKey: string, identifier: string): Promise<MangaItemDto | null> {
    return this.mangaAdapterService.getMangaDetails(websiteKey, identifier);
  }

  /**
   * Check website availability
   */
  async getWebsiteAvailability(): Promise<{ [websiteKey: string]: boolean }> {
    return this.mangaAdapterService.getWebsiteAvailability();
  }
}
