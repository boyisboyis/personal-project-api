import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { MangaService } from '@/manga/manga.service';
import { WebsiteLastUpdatedDto } from '@/manga/dto/last-updated.dto';

@ApiTags('Manga')
@Controller('manga')
export class MangaController {
  constructor(private readonly mangaService: MangaService) {}

  @Get('webs')
  async getSupportedWebsites() {
    return this.mangaService.getSupportedWebsites();
  }

  @ApiOperation({
    summary: 'Get latest updated manga from a specific website',
    description: 'Returns the 5 most recently updated manga from the specified website',
  })
  @ApiQuery({ name: 'web', required: true, description: 'Website key to fetch from (required)', example: 'niceoppai' })
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @Get('last-updated')
  async getLastUpdated(@Query('web') webKey: string): Promise<WebsiteLastUpdatedDto> {
    return this.mangaService.getLastUpdated(webKey);
  }
}
