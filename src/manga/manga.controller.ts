import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { MangaService } from '@/manga/manga.service';
import { WebsiteLastUpdatedDto, WebsiteLastUpdatedPaginatedDto, ChapterDetailsDto } from '@/manga/dto/last-updated.dto';
import { MangaDetailsDto } from '@/manga/dto/manga-details.dto';

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
    description:
      'Returns the latest updated manga. If no "web" parameter is provided, returns aggregated results from all websites. If "web" parameter is provided, returns results from that specific website only.',
  })
  @ApiQuery({
    name: 'web',
    required: true,
    description: 'Website key to fetch from (optional). If not provided, aggregates from all websites.',
    example: 'niceoppai',
    enum: ['niceoppai', 'dokimori', 'godmanga', 'tanuki', 'ntrmanga', 'mangaisekaithai', 'manga-neko', 'god-doujin', 'toonhunter'],
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of manga per website to return (default: 5)',
    example: 5,
    type: 'number',
  })
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @Get('last-updated')
  async getLastUpdated(@Query('web') webKey: string, @Query('limit') limit?: string): Promise<WebsiteLastUpdatedDto | WebsiteLastUpdatedDto[]> {
    const limitNum = parseInt(limit || '5', 10) || 5;

    return this.mangaService.getLastUpdated(webKey, limitNum);
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
    enum: ['niceoppai', 'dokimori', 'godmanga', 'tanuki', 'ntrmanga', 'mangaisekaithai', 'manga-neko', 'god-doujin', 'toonhunter'],
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (starts from 1)', example: 1, type: 'number' })
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @Get(':web/last-updated')
  async getLastUpdatedByPath(@Param('web') webKey: string, @Query('page') page: string = '1'): Promise<WebsiteLastUpdatedPaginatedDto> {
    const pageNum = parseInt(page, 10) || 1;
    return this.mangaService.getLastUpdatedWithPagination(webKey, pageNum);
  }

  @ApiOperation({
    summary: 'Get manga details by website and manga key',
    description: 'Returns detailed information about a specific manga from the specified website using the manga key/slug',
  })
  @ApiParam({
    name: 'web',
    required: true,
    description: 'Website key to fetch from',
    example: 'niceoppai',
    enum: ['niceoppai', 'dokimori', 'godmanga', 'tanuki', 'ntrmanga', 'mangaisekaithai', 'manga-neko', 'god-doujin', 'toonhunter'],
  })
  @ApiParam({
    name: 'mangaKey',
    required: true,
    description: 'Manga key/slug identifier from the website',
    example: 'glory-hole',
  })
  @ApiResponse({
    status: 200,
    description: 'Manga details retrieved successfully',
    type: MangaDetailsDto,
  })
  @Throttle({ default: { limit: 15, ttl: 60000 } }) // 15 requests per minute
  @Get(':web/details/:mangaKey')
  async getMangaDetails(@Param('web') webKey: string, @Param('mangaKey') mangaKey: string): Promise<MangaDetailsDto | null> {
    return this.mangaService.getMangaDetails(webKey, mangaKey);
  }

  @ApiOperation({
    summary: 'Get chapter details by website, manga key, and chapter ID',
    description: 'Returns detailed information about a specific chapter from the specified manga and website',
  })
  @ApiParam({
    name: 'web',
    required: true,
    description: 'Website key to fetch from',
    example: 'niceoppai',
    enum: ['niceoppai', 'dokimori', 'godmanga', 'tanuki', 'ntrmanga', 'mangaisekaithai', 'manga-neko', 'god-doujin', 'toonhunter'],
  })
  @ApiParam({
    name: 'mangaKey',
    required: true,
    description: 'Manga key/slug identifier from the website',
    example: 'glory-hole',
  })
  @ApiParam({
    name: 'chapterId',
    required: true,
    description: 'Chapter ID/slug identifier',
    example: 'ch-1',
  })
  @ApiResponse({
    status: 200,
    description: 'Chapter details retrieved successfully',
    type: ChapterDetailsDto,
  })
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute
  @Get(':web/:mangaKey/:chapterId')
  async getChapterDetails(@Param('web') webKey: string, @Param('mangaKey') mangaKey: string, @Param('chapterId') chapterId: string): Promise<ChapterDetailsDto | null> {
    return this.mangaService.getChapterDetails(webKey, mangaKey, chapterId);
  }
}
