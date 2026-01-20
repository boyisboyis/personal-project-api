import {
  Controller,
  Get,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { MangaService } from './manga.service';
import { LastUpdatedResponseDto } from './dto/last-updated.dto';

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
    description: 'Returns the 5 most recently updated manga from each supported website'
  })
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @Get('last-updated')
  async getLastUpdated(): Promise<LastUpdatedResponseDto> {
    return this.mangaService.getLastUpdated();
  }

  // @ApiOperation({ summary: 'Search manga by query, genre, or status' })
  // @ApiQuery({ name: 'query', required: false, description: 'Search by title or author' })
  // @ApiQuery({ name: 'genre', required: false, description: 'Filter by genre' })
  // @ApiQuery({ name: 'status', required: false, enum: ['ongoing', 'completed', 'hiatus'] })
  // @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limit results' })
  // @Get('search')
  // async searchManga(@Query() searchDto: SearchMangaDto) {
  //   return this.mangaService.searchManga(searchDto);
  // }

  // @ApiOperation({ summary: 'Get all manga' })
  // @Get()
  // async getAllMangas() {
  //   return this.mangaService.getAllMangas();
  // }

  // @ApiOperation({ summary: 'Get manga by ID' })
  // @Get(':id')
  // async getMangaById(@Param('id') id: string) {
  //   return this.mangaService.getMangaById(id);
  // }

  // @ApiOperation({ summary: 'Add new manga' })
  // @Throttle({ default: { limit: 5, ttl: 60000 } })
  // @Post()
  // async addManga(@Body() createMangaDto: CreateMangaDto) {
  //   return this.mangaService.addManga(createMangaDto);
  // }

  // @ApiOperation({ summary: 'Update manga by ID' })
  // @Put(':id')
  // async updateManga(@Param('id') id: string, @Body() updateMangaDto: UpdateMangaDto) {
  //   return this.mangaService.updateManga(id, updateMangaDto);
  // }

  // @ApiOperation({ summary: 'Delete manga by ID' })
  // @Delete(':id')
  // async deleteManga(@Param('id') id: string) {
  //   await this.mangaService.deleteManga(id);
  //   return { message: 'Manga deleted successfully' };
  // }

  // @ApiOperation({ summary: 'Seed sample manga data for testing' })
  // @Post('seed')
  // async seedSampleData() {
  //   await this.mangaService.seedSampleData();
  //   return { message: 'Sample data seeded successfully' };
  // }
}