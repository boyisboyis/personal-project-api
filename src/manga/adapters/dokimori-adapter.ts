import { Injectable } from '@nestjs/common';
import { BaseMangaAdapter } from '@/manga/adapters/base/base-manga-adapter';
import { MangaItemDto } from '@/manga/dto/last-updated.dto';
import { MangaPuppeteerService } from '@/manga/services/manga-puppeteer-improved.service';

@Injectable()
export class DokimoriAdapter extends BaseMangaAdapter {
  readonly websiteKey = 'dokimori';
  readonly websiteName = 'Dokimori';
  readonly websiteUrl = 'https://dokimori.com';

  constructor(private readonly mangaPuppeteerService: MangaPuppeteerService) {
    super();
    this.setPuppeteerService(mangaPuppeteerService);
  }

  private readonly mockMangaData: MangaItemDto[] = [
    {
      id: '1',
      title: 'Attack on Titan',
      author: 'Hajime Isayama',
      coverImage: 'https://example.com/attack-on-titan.jpg',
      latestChapter: 139,
      lastUpdated: new Date('2026-01-20T09:15:00.000Z'),
      url: `${this.websiteUrl}/manga/attack-on-titan`,
    },
    {
      id: '2',
      title: 'Naruto',
      author: 'Masashi Kishimoto',
      coverImage: 'https://example.com/naruto.jpg',
      latestChapter: 700,
      lastUpdated: new Date('2026-01-20T08:45:00.000Z'),
      url: `${this.websiteUrl}/manga/naruto`,
    },
    {
      id: '3',
      title: 'Dragon Ball Super',
      author: 'Akira Toriyama',
      coverImage: 'https://example.com/dragon-ball-super.jpg',
      latestChapter: 98,
      lastUpdated: new Date('2026-01-20T08:15:00.000Z'),
      url: `${this.websiteUrl}/manga/dragon-ball-super`,
    },
    {
      id: '4',
      title: 'Death Note',
      author: 'Tsugumi Ohba',
      coverImage: 'https://example.com/death-note.jpg',
      latestChapter: 108,
      lastUpdated: new Date('2026-01-20T07:45:00.000Z'),
      url: `${this.websiteUrl}/manga/death-note`,
    },
    {
      id: '5',
      title: 'Bleach',
      author: 'Tite Kubo',
      coverImage: 'https://example.com/bleach.jpg',
      latestChapter: 686,
      lastUpdated: new Date('2026-01-20T07:15:00.000Z'),
      url: `${this.websiteUrl}/manga/bleach`,
    },
    {
      id: '6',
      title: 'Hunter x Hunter',
      author: 'Yoshihiro Togashi',
      coverImage: 'https://example.com/hunter-x-hunter.jpg',
      latestChapter: 390,
      lastUpdated: new Date('2026-01-20T06:45:00.000Z'),
      url: `${this.websiteUrl}/manga/hunter-x-hunter`,
    },
    {
      id: '7',
      title: 'Fullmetal Alchemist',
      author: 'Hiromu Arakawa',
      coverImage: 'https://example.com/fullmetal-alchemist.jpg',
      latestChapter: 108,
      lastUpdated: new Date('2026-01-20T06:15:00.000Z'),
      url: `${this.websiteUrl}/manga/fullmetal-alchemist`,
    },
  ];

  async getLatestUpdated(limit: number = 5): Promise<MangaItemDto[]> {
    try {
      this.logOperation(`Fetching latest ${limit} manga`);
      
      // Option 1: Use real scraping (uncomment to enable)
      const latestUrl = `${this.websiteUrl}`;
      const scrapedData = await this.scrapeMangaListWithPuppeteer(latestUrl, limit, {
        waitForSelector: '#loop-content',
        delay: { min: 600, max: 1200 },
      });
      // if (scrapedData.length > 0) {
        this.logOperation(`Successfully scraped ${scrapedData.length} manga from real website`);
        return scrapedData;
      // }

      // Option 2: Fallback to mock data (current implementation)
      // await this.simulateNetworkDelay(400, 1200);

      // Sort by lastUpdated descending and take the limit
      // const result = this.mockMangaData.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime()).slice(0, limit);

      // this.logOperation(`Successfully fetched ${result.length} manga (using mock data)`);
      // return result;
    } catch (error) {
      this.handleError('getLatestUpdated', error);
    }
  }

  async searchManga(query: string, limit: number = 10): Promise<MangaItemDto[]> {
    try {
      this.logOperation(`Searching manga with query: "${query}"`);
      
      // Option 1: Use real scraping (uncomment to enable)
      // const searchUrl = `${this.websiteUrl}/search?keyword=${encodeURIComponent(query)}`;
      // const scrapedData = await this.scrapeMangaListWithPuppeteer(searchUrl, limit, {
      //   waitForSelector: '.search-result, .manga-container',
      //   delay: { min: 800, max: 1500 },
      // });
      // if (scrapedData.length > 0) {
      //   this.logOperation(`Found ${scrapedData.length} manga for query: "${query}" (scraped)`);
      //   return scrapedData;
      // }

      // Option 2: Fallback to mock data search
      await this.simulateNetworkDelay(500, 1000);

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
        //   waitForSelector: '.manga-details, .series-info',
        //   delay: { min: 400, max: 800 },
        // });
        // if (scrapedData) {
        //   this.logOperation(`Successfully scraped details for: ${scrapedData.title}`);
        //   return scrapedData;
        // }
      }
      
      // Option 2: Fallback to mock data lookup
      await this.simulateNetworkDelay(300, 800);

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
      await this.simulateNetworkDelay(150, 400);

      // Simulate occasional unavailability (8% chance - slightly higher than niceoppai)
      const isAvailable = Math.random() > 0.08;

      this.logOperation(`Availability check: ${isAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}`);
      return isAvailable;
    } catch (error) {
      this.logger.warn(`[${this.websiteKey}] Availability check failed:`, error.message);
      return false;
    }
  }
}
