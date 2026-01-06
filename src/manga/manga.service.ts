import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { SearchMangaDto } from "./dto/search-manga.dto";
import { SupportedWebsiteDto } from "./dto/supported-website.dto";

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
}
