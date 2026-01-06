import { ApiProperty } from '@nestjs/swagger';
import { IsUrl, IsOptional, IsObject, IsBoolean } from 'class-validator';

export class CreateScrapingTaskDto {
  @ApiProperty({
    example: 'https://example.com',
    description: 'URL to scrape',
  })
  @IsUrl()
  url: string;

  @ApiProperty({
    example: {
      selectors: ['h1', 'p', '.content'],
      useHeadless: true,
      waitForSelector: '.dynamic-content',
      screenshot: false,
    },
    description: 'Scraping configuration',
    required: false,
  })
  @IsOptional()
  @IsObject()
  config?: {
    selectors?: string[];
    useHeadless?: boolean;
    waitForSelector?: string;
    screenshot?: boolean;
    timeout?: number;
    userAgent?: string;
  };
}