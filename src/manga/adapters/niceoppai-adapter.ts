import { Injectable } from '@nestjs/common';
import { BaseMangaAdapter } from './base/base-manga-adapter';
import { MangaItemDto } from '../dto/last-updated.dto';

@Injectable()
export class NiceoppaiAdapter extends BaseMangaAdapter {
  readonly websiteKey = 'niceoppai';
  readonly websiteName = 'Niceoppai';
  readonly websiteUrl = 'https://www.niceoppai.net';

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

      await this.simulateNetworkDelay();

      // Sort by lastUpdated descending and take the limit
      const result = this.mockMangaData.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime()).slice(0, limit);

      this.logOperation(`Successfully fetched ${result.length} manga`);
      return result;
    } catch (error) {
      this.handleError('getLatestUpdated', error);
    }
  }

  async searchManga(query: string, limit: number = 10): Promise<MangaItemDto[]> {
    try {
      this.logOperation(`Searching manga with query: "${query}"`);

      await this.simulateNetworkDelay();

      const searchTerm = query.toLowerCase();
      const result = this.mockMangaData
        .filter(manga => manga.title.toLowerCase().includes(searchTerm) || (manga.author && manga.author.toLowerCase().includes(searchTerm)))
        .slice(0, limit);

      this.logOperation(`Found ${result.length} manga for query: "${query}"`);
      return result;
    } catch (error) {
      this.handleError('searchManga', error);
    }
  }

  async getMangaDetails(identifier: string): Promise<MangaItemDto | null> {
    try {
      this.logOperation(`Fetching manga details for: ${identifier}`);

      await this.simulateNetworkDelay();

      const result = this.mockMangaData.find(manga => manga.id === identifier || manga.url === identifier);

      if (result) {
        this.logOperation(`Successfully fetched details for: ${result.title}`);
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
