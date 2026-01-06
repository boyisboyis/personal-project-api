import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { ScraperController } from './scraper.controller';
import { ScraperService } from './scraper.service';
import { PuppeteerService } from './services/puppeteer.service';
import { CheerioService } from './services/cheerio.service';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 5, // Limit scraping requests
      },
    ]),
  ],
  controllers: [ScraperController],
  providers: [ScraperService, PuppeteerService, CheerioService],
  exports: [ScraperService],
})
export class ScraperModule {}