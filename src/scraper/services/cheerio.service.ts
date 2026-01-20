import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';

@Injectable()
export class CheerioService {
  private readonly logger = new Logger(CheerioService.name);

  async scrapeWithCheerio(url: string, config: any = {}): Promise<any> {
    try {
      this.logger.log(`Scraping ${url} with Cheerio`);

      const response = await axios.get(url, {
        timeout: config.timeout || 30000,
        headers: {
          'User-Agent': config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      const $ = cheerio.load(response.data);

      let result: any = {
        url,
        timestamp: new Date().toISOString(),
        title: $('title').text().trim(),
      };

      // Extract data based on selectors
      if (config.selectors && Array.isArray(config.selectors)) {
        result.data = {};

        for (const selector of config.selectors) {
          try {
            const elements = $(selector);
            const texts: string[] = [];

            elements.each((i, el) => {
              const text = $(el).text().trim();
              if (text && text.length > 0) {
                texts.push(text);
              }
            });

            result.data[selector] = texts;
          } catch (error) {
            this.logger.warn(`Failed to extract selector ${selector}: ${error.message}`);
            result.data[selector] = [];
          }
        }
      } else {
        // Extract common page data
        result.data = {
          title: $('title').text().trim(),
          description: $('meta[name="description"]').attr('content') || '',
          headings: [] as string[],
          paragraphs: [] as string[],
          links: [] as { text: string; href: string }[],
        };

        // Extract headings
        $('h1, h2, h3').each((i, el) => {
          const text = $(el).text().trim();
          if (text) result.data.headings.push(text);
        });

        // Extract paragraphs (limit to first 10)
        $('p')
          .slice(0, 10)
          .each((i, el) => {
            const text = $(el).text().trim();
            if (text) result.data.paragraphs.push(text);
          });

        // Extract links (limit to first 20)
        $('a[href]')
          .slice(0, 20)
          .each((i, el) => {
            const text = $(el).text().trim();
            const href = $(el).attr('href');
            if (text && href) {
              result.data.links.push({ text, href });
            }
          });
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to scrape ${url}: ${error.message}`);
      throw new Error(`Scraping failed: ${error.message}`);
    }
  }
}
