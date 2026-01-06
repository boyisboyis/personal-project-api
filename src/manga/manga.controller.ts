import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { MangaService } from './manga.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SearchMangaDto } from './dto/search-manga.dto';
import { CreateMangaDto } from './dto/create-manga.dto';
import { UpdateMangaDto } from './dto/update-manga.dto';

@ApiTags('Manga')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('manga')
export class MangaController {
  constructor(private readonly mangaService: MangaService) {}

  @Get('webs')
  async getSupportedWebsites() {
    return this.mangaService.getSupportedWebsites();
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