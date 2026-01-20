import { Injectable, Logger } from "@nestjs/common";
import { SupportedWebsiteDto } from "./dto/supported-website.dto";
import { LastUpdatedResponseDto, WebsiteLastUpdatedDto, MangaItemDto } from "./dto/last-updated.dto";

export interface Manga {
  id: string;
  title: string;
  author?: string;
  description?: string;
  coverImage?: string;
  chapters?: number;
  status?: "ongoing" | "completed" | "hiatus";
  genres?: string[];
  rating?: number;
  url?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class MangaService {
  private readonly logger = new Logger(MangaService.name);
  private mangas: Manga[] = []; // In-memory storage

  async getSupportedWebsites(): Promise<SupportedWebsiteDto[]> {
    // Sample supported websites
    return [
      {
        key: "niceoppai",
        name: "Niceoppai",
        url: "https://www.niceoppai.net",
      },
      {
        key: 'dokimori',
        name: 'Dokimori',
        url: 'https://dokimori.com',
      }
    ];
  }
  /*
  async searchManga(searchDto: SearchMangaDto): Promise<Manga[]> {
    const { query, genre, status, limit = 10 } = searchDto;

    let filteredMangas = [...this.mangas];

    // Filter by query (title or author)
    if (query) {
      const searchTerm = query.toLowerCase();
      filteredMangas = filteredMangas.filter(
        manga => 
          manga.title.toLowerCase().includes(searchTerm) ||
          (manga.author && manga.author.toLowerCase().includes(searchTerm))
      );
    }

    // Filter by genre
    if (genre) {
      filteredMangas = filteredMangas.filter(
        manga => manga.genres && manga.genres.includes(genre)
      );
    }

    // Filter by status
    if (status) {
      filteredMangas = filteredMangas.filter(manga => manga.status === status);
    }

    // Limit results
    return filteredMangas.slice(0, limit);
  }

  async getAllMangas(): Promise<Manga[]> {
    return this.mangas.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async getMangaById(id: string): Promise<Manga> {
    const manga = this.mangas.find(m => m.id === id);
    if (!manga) {
      throw new NotFoundException('Manga not found');
    }
    return manga;
  }

  async addManga(mangaData: Partial<Manga>): Promise<Manga> {
    const manga: Manga = {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      title: mangaData.title || '',
      author: mangaData.author,
      description: mangaData.description,
      coverImage: mangaData.coverImage,
      chapters: mangaData.chapters || 0,
      status: mangaData.status || 'ongoing',
      genres: mangaData.genres || [],
      rating: mangaData.rating,
      url: mangaData.url,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.mangas.push(manga);
    this.logger.log(`Added new manga: ${manga.title}`);
    return manga;
  }

  async updateManga(id: string, updateData: Partial<Manga>): Promise<Manga> {
    const mangaIndex = this.mangas.findIndex(m => m.id === id);
    if (mangaIndex === -1) {
      throw new NotFoundException('Manga not found');
    }

    this.mangas[mangaIndex] = {
      ...this.mangas[mangaIndex],
      ...updateData,
      updatedAt: new Date(),
    };

    this.logger.log(`Updated manga: ${this.mangas[mangaIndex].title}`);
    return this.mangas[mangaIndex];
  }

  async deleteManga(id: string): Promise<void> {
    const mangaIndex = this.mangas.findIndex(m => m.id === id);
    if (mangaIndex === -1) {
      throw new NotFoundException('Manga not found');
    }

    const deletedManga = this.mangas.splice(mangaIndex, 1)[0];
    this.logger.log(`Deleted manga: ${deletedManga.title}`);
  }

  // Sample data for testing
  async seedSampleData(): Promise<void> {
    if (this.mangas.length === 0) {
      const sampleMangas: Partial<Manga>[] = [
        {
          title: 'One Piece',
          author: 'Eiichiro Oda',
          description: 'The adventures of Monkey D. Luffy and his pirate crew',
          chapters: 1000,
          status: 'ongoing',
          genres: ['Action', 'Adventure', 'Comedy'],
          rating: 9.5,
        },
        {
          title: 'Attack on Titan',
          author: 'Hajime Isayama',
          description: 'Humanity fights against giant titans',
          chapters: 139,
          status: 'completed',
          genres: ['Action', 'Drama', 'Fantasy'],
          rating: 9.0,
        },
        {
          title: 'Demon Slayer',
          author: 'Koyoharu Gotouge',
          description: 'A young boy becomes a demon slayer to save his sister',
          chapters: 205,
          status: 'completed',
          genres: ['Action', 'Supernatural'],
          rating: 8.7,
        },
      ];

      for (const mangaData of sampleMangas) {
        await this.addManga(mangaData);
      }

      this.logger.log('Sample manga data seeded');
    }
  }
    */

  async getLastUpdated(): Promise<LastUpdatedResponseDto> {
    this.logger.log('Fetching last updated manga from all supported websites');
    
    const supportedWebsites = await this.getSupportedWebsites();
    const websites: WebsiteLastUpdatedDto[] = [];
    const fetchedAt = new Date();

    for (const website of supportedWebsites) {
      try {
        const mangaData = await this.scrapeWebsiteLastUpdated(website.key);
        websites.push({
          websiteKey: website.key,
          websiteName: website.name,
          mangas: mangaData,
          fetchedAt,
        });
      } catch (error) {
        this.logger.error(`Failed to fetch data from ${website.name}: ${error.message}`);
        // Add empty result for failed website
        websites.push({
          websiteKey: website.key,
          websiteName: website.name,
          mangas: [],
          fetchedAt,
        });
      }
    }

    return {
      websites,
      timestamp: fetchedAt,
    };
  }

  private async scrapeWebsiteLastUpdated(websiteKey: string): Promise<MangaItemDto[]> {
    // Mock data สำหรับ demo - ในความเป็นจริงจะต้องใช้ scraper service
    // เพื่อ scrape ข้อมูลจริงจากเว็บไซต์
    
    const mockData: { [key: string]: MangaItemDto[] } = {
      niceoppai: [
        {
          id: '1',
          title: 'Chainsaw Man',
          author: 'Tatsuki Fujimoto',
          coverImage: 'https://example.com/chainsaw-man.jpg',
          latestChapter: 145,
          lastUpdated: new Date('2026-01-20T09:00:00.000Z'),
          url: 'https://www.niceoppai.net/manga/chainsaw-man',
        },
        {
          id: '2',
          title: 'Jujutsu Kaisen',
          author: 'Gege Akutami',
          coverImage: 'https://example.com/jujutsu-kaisen.jpg',
          latestChapter: 248,
          lastUpdated: new Date('2026-01-20T08:30:00.000Z'),
          url: 'https://www.niceoppai.net/manga/jujutsu-kaisen',
        },
        {
          id: '3',
          title: 'One Piece',
          author: 'Eiichiro Oda',
          coverImage: 'https://example.com/one-piece.jpg',
          latestChapter: 1108,
          lastUpdated: new Date('2026-01-20T08:00:00.000Z'),
          url: 'https://www.niceoppai.net/manga/one-piece',
        },
        {
          id: '4',
          title: 'My Hero Academia',
          author: 'Kohei Horikoshi',
          coverImage: 'https://example.com/my-hero-academia.jpg',
          latestChapter: 412,
          lastUpdated: new Date('2026-01-20T07:30:00.000Z'),
          url: 'https://www.niceoppai.net/manga/my-hero-academia',
        },
        {
          id: '5',
          title: 'Demon Slayer',
          author: 'Koyoharu Gotouge',
          coverImage: 'https://example.com/demon-slayer.jpg',
          latestChapter: 205,
          lastUpdated: new Date('2026-01-20T07:00:00.000Z'),
          url: 'https://www.niceoppai.net/manga/demon-slayer',
        },
      ],
      dokimori: [
        {
          id: '6',
          title: 'Attack on Titan',
          author: 'Hajime Isayama',
          coverImage: 'https://example.com/attack-on-titan.jpg',
          latestChapter: 139,
          lastUpdated: new Date('2026-01-20T09:15:00.000Z'),
          url: 'https://dokimori.com/manga/attack-on-titan',
        },
        {
          id: '7',
          title: 'Naruto',
          author: 'Masashi Kishimoto',
          coverImage: 'https://example.com/naruto.jpg',
          latestChapter: 700,
          lastUpdated: new Date('2026-01-20T08:45:00.000Z'),
          url: 'https://dokimori.com/manga/naruto',
        },
        {
          id: '8',
          title: 'Dragon Ball Super',
          author: 'Akira Toriyama',
          coverImage: 'https://example.com/dragon-ball-super.jpg',
          latestChapter: 98,
          lastUpdated: new Date('2026-01-20T08:15:00.000Z'),
          url: 'https://dokimori.com/manga/dragon-ball-super',
        },
        {
          id: '9',
          title: 'Death Note',
          author: 'Tsugumi Ohba',
          coverImage: 'https://example.com/death-note.jpg',
          latestChapter: 108,
          lastUpdated: new Date('2026-01-20T07:45:00.000Z'),
          url: 'https://dokimori.com/manga/death-note',
        },
        {
          id: '10',
          title: 'Bleach',
          author: 'Tite Kubo',
          coverImage: 'https://example.com/bleach.jpg',
          latestChapter: 686,
          lastUpdated: new Date('2026-01-20T07:15:00.000Z'),
          url: 'https://dokimori.com/manga/bleach',
        },
      ],
    };

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    
    return mockData[websiteKey] || [];
  }
}
