import { Injectable, Logger } from '@nestjs/common';
import puppeteer from 'puppeteer';

@Injectable()
export class PuppeteerService {
  private readonly logger = new Logger(PuppeteerService.name);

  async scrapeWithPuppeteer(url: string, config: any = {}): Promise<any> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();

      // Set user agent if provided
      if (config.userAgent) {
        await page.setUserAgent(config.userAgent);
      }

      // Set viewport
      await page.setViewport({ width: 1280, height: 720 });

      this.logger.log(`Navigating to ${url}`);
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: config.timeout || 30000,
      });

      // Wait for specific selector if provided
      if (config.waitForSelector) {
        await page.waitForSelector(config.waitForSelector, {
          timeout: 10000,
        });
      }

      let result: any = {
        url,
        timestamp: new Date().toISOString(),
        title: await page.title(),
      };

      // Extract data based on selectors
      if (config.selectors && Array.isArray(config.selectors)) {
        result.data = {};

        for (const selector of config.selectors) {
          try {
            const elements = await page.$$(selector);
            const texts = await Promise.all(elements.map(el => el.evaluate(node => node.textContent?.trim())));
            result.data[selector] = texts.filter(text => text && text.length > 0);
          } catch (error) {
            this.logger.warn(`Failed to extract selector ${selector}: ${error.message}`);
            result.data[selector] = [];
          }
        }
      } else {
        // Extract common page data
        result.data = await page.evaluate(() => {
          return {
            title: document.title,
            description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
            headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent?.trim()),
            paragraphs: Array.from(document.querySelectorAll('p'))
              .map(p => p.textContent?.trim())
              .slice(0, 10),
            links: Array.from(document.querySelectorAll('a[href]'))
              .map(a => ({
                text: a.textContent?.trim(),
                href: a.getAttribute('href'),
              }))
              .slice(0, 20),
          };
        });
      }

      // Take screenshot if requested
      if (config.screenshot) {
        const screenshot = await page.screenshot({
          type: 'png',
          fullPage: false,
          encoding: 'base64',
        });
        result.screenshot = `data:image/png;base64,${screenshot}`;
      }

      return result;
    } finally {
      await browser.close();
    }
  }
}
