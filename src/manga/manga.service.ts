import { Injectable, Logger } from '@nestjs/common';
import { SupportedWebsiteDto } from '@/manga/dto/supported-website.dto';
import { MangaAdapterService } from '@/manga/services/manga-adapter.service';

@Injectable()
export class MangaService {
  private readonly logger = new Logger(MangaService.name);

  constructor(private readonly mangaAdapterService: MangaAdapterService) {}

  async getSupportedWebsites(): Promise<SupportedWebsiteDto[]> {
    return this.mangaAdapterService.getSupportedWebsites();
  }

  async getLastUpdated(webKey: string) {
    this.logger.log(`Delegating to MangaAdapterService for last updated manga from ${webKey}`);
    return this.mangaAdapterService.getLastUpdatedByWebsite(webKey, 5);
  }
}
