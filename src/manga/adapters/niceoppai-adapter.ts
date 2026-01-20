import { Injectable } from '@nestjs/common';
import { BaseMangaAdapter } from '@/manga/adapters/base/base-manga-adapter';
import { MangaItemDto } from '@/manga/dto/last-updated.dto';
import { MangaPuppeteerService } from '@/manga/services/manga-puppeteer-improved.service';

@Injectable()
export class NiceoppaiAdapter extends BaseMangaAdapter {
  readonly websiteKey = 'niceoppai';
  readonly websiteName = 'Niceoppai';
  readonly websiteUrl = 'https://www.niceoppai.net';

  constructor(private readonly mangaPuppeteerService: MangaPuppeteerService) {
    super();
    this.setPuppeteerService(mangaPuppeteerService);
  }

  private readonly mockMangaData: MangaItemDto[] = [
    {
      id: '1',
      title: 'Chainsaw Man',
      author: 'Tatsuki Fujimoto',
      coverImage: 'https://example.com/chainsaw-man.jpg',
      latestChapter: 145,
      lastUpdated: new Date('2026-01-20T09:00:00.000Z'),
      url: `${this.websiteUrl}/manga/chainsaw-man`,
    },
    {
      id: '2',
      title: 'Jujutsu Kaisen',
      author: 'Gege Akutami',
      coverImage: 'https://example.com/jujutsu-kaisen.jpg',
      latestChapter: 248,
      lastUpdated: new Date('2026-01-20T08:30:00.000Z'),
      url: `${this.websiteUrl}/manga/jujutsu-kaisen`,
    },
    {
      id: '3',
      title: 'One Piece',
      author: 'Eiichiro Oda',
      coverImage: 'https://example.com/one-piece.jpg',
      latestChapter: 1108,
      lastUpdated: new Date('2026-01-20T08:00:00.000Z'),
      url: `${this.websiteUrl}/manga/one-piece`,
    },
    {
      id: '4',
      title: 'My Hero Academia',
      author: 'Kohei Horikoshi',
      coverImage: 'https://example.com/my-hero-academia.jpg',
      latestChapter: 412,
      lastUpdated: new Date('2026-01-20T07:30:00.000Z'),
      url: `${this.websiteUrl}/manga/my-hero-academia`,
    },
    {
      id: '5',
      title: 'Demon Slayer',
      author: 'Koyoharu Gotouge',
      coverImage: 'https://example.com/demon-slayer.jpg',
      latestChapter: 205,
      lastUpdated: new Date('2026-01-20T07:00:00.000Z'),
      url: `${this.websiteUrl}/manga/demon-slayer`,
    },
    {
      id: '6',
      title: 'Black Clover',
      author: 'Yuki Tabata',
      coverImage: 'https://example.com/black-clover.jpg',
      latestChapter: 368,
      lastUpdated: new Date('2026-01-20T06:30:00.000Z'),
      url: `${this.websiteUrl}/manga/black-clover`,
    },
    {
      id: '7',
      title: 'Tokyo Ghoul',
      author: 'Sui Ishida',
      coverImage: 'https://example.com/tokyo-ghoul.jpg',
      latestChapter: 179,
      lastUpdated: new Date('2026-01-20T06:00:00.000Z'),
      url: `${this.websiteUrl}/manga/tokyo-ghoul`,
    },
  ];

  async getLatestUpdated(limit: number = 5): Promise<MangaItemDto[]> {
    try {
      this.logOperation(`Fetching latest ${limit} manga`);
      
      // Option 1: Use real scraping (uncomment to enable)
      const latestUrl = `${this.websiteUrl}/latest-updates`;
      const scrapedData = await this.scrapeMangaListWithPuppeteer(latestUrl, limit, {
        waitForSelector: '.manga-list, .series-list',
        delay: { min: 800, max: 1500 },
      });
      if (scrapedData.length > 0) {
        this.logOperation(`Successfully scraped ${scrapedData.length} manga from real website`);
        return scrapedData;
      }

      // Option 2: Fallback to mock data (current implementation)
      await this.simulateNetworkDelay();

      // Sort by lastUpdated descending and take the limit
      const result = this.mockMangaData.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime()).slice(0, limit);

      this.logOperation(`Successfully fetched ${result.length} manga (using mock data)`);
      return result;
    } catch (error) {
      this.handleError('getLatestUpdated', error);
    }
  }

  async searchManga(query: string, limit: number = 10): Promise<MangaItemDto[]> {
    try {
      this.logOperation(`Searching manga with query: "${query}"`);
      
      // Option 1: Use real scraping (uncomment to enable)
      // const searchUrl = `${this.websiteUrl}/search?q=${encodeURIComponent(query)}`;
      // const scrapedData = await this.scrapeMangaListWithPuppeteer(searchUrl, limit, {
      //   waitForSelector: '.search-results, .manga-grid',
      //   delay: { min: 1000, max: 2000 },
      // });
      // if (scrapedData.length > 0) {
      //   this.logOperation(`Found ${scrapedData.length} manga for query: "${query}" (scraped)`);
      //   return scrapedData;
      // }

      // Option 2: Fallback to mock data search
      await this.simulateNetworkDelay();

      const searchTerm = query.toLowerCase();
      const result = this.mockMangaData
        .filter(manga => manga.title.toLowerCase().includes(searchTerm) || (manga.author && manga.author.toLowerCase().includes(searchTerm)))
        .slice(0, limit);

      this.logOperation(`Found ${result.length} manga for query: "${query}" (using mock data)`);
      return result;
    } catch (error) {
      this.handleError('searchManga', error);
    }
  }

  async getMangaDetails(identifier: string): Promise<MangaItemDto | null> {
    try {
      this.logOperation(`Fetching manga details for: ${identifier}`);
      
      // Option 1: Use real scraping if identifier is a URL
      if (identifier.startsWith('http')) {
        // const scrapedData = await this.scrapeMangaDetailsWithPuppeteer(identifier, {
        //   waitForSelector: '.manga-info, .series-details',
        //   delay: { min: 500, max: 1000 },
        // });
        // if (scrapedData) {
        //   this.logOperation(`Successfully scraped details for: ${scrapedData.title}`);
        //   return scrapedData;
        // }
      }
      
      // Option 2: Fallback to mock data lookup
      await this.simulateNetworkDelay();

      const result = this.mockMangaData.find(manga => manga.id === identifier || manga.url === identifier);

      if (result) {
        this.logOperation(`Successfully fetched details for: ${result.title} (using mock data)`);
      } else {
        this.logOperation(`Manga not found for identifier: ${identifier}`);
      }

      return result || null;
    } catch (error) {
      this.handleError('getMangaDetails', error);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      this.logOperation('Checking availability');
      await this.simulateNetworkDelay(100, 300);

      // Simulate occasional unavailability (5% chance)
      const isAvailable = Math.random() > 0.05;

      this.logOperation(`Availability check: ${isAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}`);
      return isAvailable;
    } catch (error) {
      this.logger.warn(`[${this.websiteKey}] Availability check failed:`, error.message);
      return false;
    }
  }
}
