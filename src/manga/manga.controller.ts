import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { MangaService } from '@/manga/manga.service';
import { WebsiteLastUpdatedDto, WebsiteLastUpdatedPaginatedDto } from '@/manga/dto/last-updated.dto';

@ApiTags('Manga')
@Controller('manga')
export class MangaController {
  constructor(private readonly mangaService: MangaService) {}

  @Get('webs')
  async getSupportedWebsites() {
    return this.mangaService.getSupportedWebsites();
  }

  @ApiOperation({
    summary: 'Get latest updated manga from all websites or a specific website',
    description: 'Returns the latest updated manga. If no "web" parameter is provided, returns aggregated results from all websites. If "web" parameter is provided, returns results from that specific website only.',
  })
  @ApiQuery({ 
    name: 'web', 
    required: false, 
    description: 'Website key to fetch from (optional). If not provided, aggregates from all websites.', 
    example: 'niceoppai',
    enum: ['niceoppai', 'dokimori', 'godmanga', 'tanuki']
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    description: 'Maximum number of manga per website to return (default: 5)', 
    example: 5,
    type: 'number'
  })
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @Get('last-updated')
  async getLastUpdated(
    @Query('web') webKey?: string,
    @Query('limit') limit?: string
  ): Promise<WebsiteLastUpdatedDto | WebsiteLastUpdatedDto[]> {
    const limitNum = parseInt(limit || '5', 10) || 5;
    
    if (webKey) {
      // Return single website data
      return this.mangaService.getLastUpdated(webKey, limitNum);
    } else {
      // Return aggregated data from all websites
      return this.mangaService.getAllLastUpdated(limitNum);
    }
  }

  @ApiOperation({
    summary: 'Get latest updated manga from a specific website (path parameter)',
    description: 'Returns the latest updated manga from the specified website using path parameter with pagination support (10 items per page)',
  })
  @ApiParam({ 
    name: 'web', 
    required: true, 
    description: 'Website key to fetch from', 
    example: 'niceoppai',
    enum: ['niceoppai', 'dokimori', 'godmanga', 'tanuki']
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (starts from 1)', example: 1, type: 'number' })
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @Get(':web/last-updated')
  async getLastUpdatedByPath(
    @Param('web') webKey: string,
    @Query('page') page: string = '1'
  ): Promise<WebsiteLastUpdatedPaginatedDto> {
    const pageNum = parseInt(page, 10) || 1;
    return this.mangaService.getLastUpdatedWithPagination(webKey, pageNum);
  }
}
