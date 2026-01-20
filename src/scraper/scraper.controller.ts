import { Controller, Post, Get, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { ScraperService } from './scraper.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateScrapingTaskDto } from './dto/create-scraping-task.dto';

@ApiTags('Web Scraping')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @ApiOperation({ summary: 'Create a new scraping task' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('tasks')
  async createScrapingTask(@Request() req: any, @Body() createTaskDto: CreateScrapingTaskDto) {
    return this.scraperService.createScrapingTask(req.user.id, createTaskDto);
  }

  @ApiOperation({ summary: 'Get all scraping tasks for user' })
  @Get('tasks')
  async getScrapingTasks(@Request() req: any) {
    return this.scraperService.getScrapingTasks(req.user.id);
  }

  @ApiOperation({ summary: 'Get specific scraping task' })
  @Get('tasks/:taskId')
  async getScrapingTask(@Request() req: any, @Param('taskId') taskId: string) {
    return this.scraperService.getScrapingTask(taskId, req.user.id);
  }
}
