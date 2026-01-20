import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { MangaService } from '@/manga/manga.service';
import { LastUpdatedResponseDto } from '@/manga/dto/last-updated.dto';

@ApiTags('Manga')
@Controller('manga')
export class MangaController {
  constructor(private readonly mangaService: MangaService) {}

  @Get('webs')
  async getSupportedWebsites() {
    return this.mangaService.getSupportedWebsites();
  }

  @ApiOperation({
    summary: 'Get latest updated manga from all supported websites',
    description: 'Returns the 5 most recently updated manga from each supported website',
  })
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @Get('last-updated')
  async getLastUpdated(): Promise<LastUpdatedResponseDto> {
    return this.mangaService.getLastUpdated();
  }
}
