import { Injectable, Logger } from '@nestjs/common';
import { SupportedWebsiteDto } from '@/manga/dto/supported-website.dto';
import { WebsiteLastUpdatedPaginatedDto } from '@/manga/dto/last-updated.dto';
import { MangaAdapterService } from '@/manga/services/manga-adapter.service';

@Injectable()
export class MangaService {
  private readonly logger = new Logger(MangaService.name);

  constructor(private readonly mangaAdapterService: MangaAdapterService) {}

  async getSupportedWebsites(): Promise<SupportedWebsiteDto[]> {
    return this.mangaAdapterService.getSupportedWebsites();
  }

  async getLastUpdated(webKey: string, limit: number = 5) {
    this.logger.log(`Delegating to MangaAdapterService for last updated manga from ${webKey}`);
    return this.mangaAdapterService.getLastUpdatedByWebsite(webKey, limit);
  }

  async getAllLastUpdated(limit: number = 5) {
    this.logger.log(`Delegating to MangaAdapterService for last updated manga from all websites`);
    return this.mangaAdapterService.getAllLastUpdated(limit);
  }

  async getLastUpdatedWithPagination(webKey: string, page: number = 1): Promise<WebsiteLastUpdatedPaginatedDto> {
    // const limit = 10; // Fixed limit of 10 items per page
    this.logger.log(`Delegating to MangaAdapterService for last updated manga from ${webKey} (page: ${page})`);
    
    // Use same cache as the original endpoint by getting all available data (no limit)
    const websiteData = await this.mangaAdapterService.getLastUpdatedByWebsite(webKey, 9999, page);
    
    // Calculate pagination
    // const totalItems = websiteData.mangas.length;
    // const startIndex = (page - 1) * limit;
    // const endIndex = startIndex + limit;
    const paginatedMangas = websiteData.mangas;
    
    // const totalPages = Math.ceil(totalItems / limit);
    
    return {
      ...websiteData,
      mangas: paginatedMangas,
      pagination: {
        currentPage: page,
        totalPages: 10,
        // hasNextPage: page < totalPages,
        // hasPrevPage: page > 1,
      },
    };
  }
}
