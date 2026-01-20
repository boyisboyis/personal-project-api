import { Injectable, Logger, BadRequestException } from '@nestjs/common';

import { PuppeteerService } from './services/puppeteer.service';
import { CheerioService } from './services/cheerio.service';
import { CreateScrapingTaskDto } from './dto/create-scraping-task.dto';

export interface ScrapingTask {
  id: string;
  url: string;
  config?: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  retryCount: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private tasks: ScrapingTask[] = []; // In-memory storage

  constructor(
    private puppeteerService: PuppeteerService,
    private cheerioService: CheerioService
  ) {}

  async createScrapingTask(userId: string, createTaskDto: CreateScrapingTaskDto): Promise<ScrapingTask> {
    const task: ScrapingTask = {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      ...createTaskDto,
      userId,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.tasks.push(task);

    // Start scraping in background
    this.executeScrapingTask(task.id);

    return task;
  }

  async getScrapingTasks(userId: string): Promise<ScrapingTask[]> {
    return this.tasks.filter(task => task.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getScrapingTask(taskId: string, userId: string): Promise<ScrapingTask> {
    const task = this.tasks.find(t => t.id === taskId && t.userId === userId);

    if (!task) {
      throw new BadRequestException('Task not found');
    }

    return task;
  }

  private async executeScrapingTask(taskId: string): Promise<void> {
    try {
      const taskIndex = this.tasks.findIndex(t => t.id === taskId);
      if (taskIndex === -1) {
        throw new Error('Task not found');
      }

      this.tasks[taskIndex].status = 'running';
      this.tasks[taskIndex].updatedAt = new Date();

      const task = this.tasks[taskIndex];
      let result: any;

      // Choose scraping method based on config
      if (task.config?.useHeadless) {
        result = await this.puppeteerService.scrapeWithPuppeteer(task.url, task.config);
      } else {
        result = await this.cheerioService.scrapeWithCheerio(task.url, task.config);
      }

      this.tasks[taskIndex].status = 'completed';
      this.tasks[taskIndex].result = result;
      this.tasks[taskIndex].updatedAt = new Date();

      this.logger.log(`Task ${taskId} completed successfully`);
    } catch (error) {
      this.logger.error(`Task ${taskId} failed: ${error.message}`);

      const taskIndex = this.tasks.findIndex(t => t.id === taskId);
      if (taskIndex !== -1) {
        this.tasks[taskIndex].status = 'failed';
        this.tasks[taskIndex].error = error.message;
        this.tasks[taskIndex].updatedAt = new Date();
      }
    }
  }
}
