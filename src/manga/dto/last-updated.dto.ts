import { ApiProperty } from '@nestjs/swagger';
import { ChapterImageDto } from './chapter-image.dto';

export class ChapterDto {

  @ApiProperty({
    example: 'ch-1090',
    description: 'Chapter ID',
  })
  id: string;

  @ApiProperty({
    example: 'Chapter 1090',
    description: 'Chapter title',
  })
  title: string;

  @ApiProperty({
    example: 'https://example.com/manga/one-piece/chapter-1090',
    description: 'Chapter URL',
  })
  url: string;

  @ApiProperty({
    example: 1090,
    description: 'Chapter number',
    required: false,
  })
  chapterNumber?: number;

  @ApiProperty({
    example: '2026-01-20T10:00:00.000Z',
    description: 'Chapter publish date',
    required: false,
  })
  publishedAt?: Date;

  @ApiProperty({
    example: [
      {
        url: 'https://example.com/manga/one-piece/chapter-1090/page-1.jpg',
        type: 'image'
      },
      {
        url: 'https://example.com/manga/one-piece/chapter-1090/page-2.jpg',
        type: 'canvas',
        html: '<canvas id="page2" width="800" height="1200"></canvas>',
        script: '<script>// Canvas rendering script</script>'
      }
    ],
    description: 'List of chapter page images with metadata',
    required: false,
    type: [ChapterImageDto],
  })
  images?: ChapterImageDto[];
}

export class ChapterDetailsDto extends ChapterDto {
  @ApiProperty({
    description: 'Manga information context',
    example: {
      id: 'glory-hole',
      title: 'Glory Hole',
      author: 'Author Name',
      coverImage: 'https://example.com/cover.jpg',
      url: 'https://example.com/manga/glory-hole'
    }
  })
  manga: {
    id: string;
    title: string;
    author?: string;
    coverImage?: string;
    url?: string;
  };

  @ApiProperty({
    example: [
      {
        url: 'https://example.com/manga/one-piece/chapter-1090/page-1.jpg',
        type: 'image'
      },
      {
        url: 'https://example.com/manga/one-piece/chapter-1090/page-2.jpg',
        type: 'canvas',
        html: '<canvas id="page2" width="800" height="1200"></canvas>',
        script: '<script>// Canvas rendering script</script>'
      },
      {
        url: 'https://example.com/manga/one-piece/chapter-1090/page-3.jpg',
        type: 'image'
      }
    ],
    description: 'List of chapter page images with metadata',
    type: [ChapterImageDto],
  })
  images: ChapterImageDto[];

  @ApiProperty({
    description: 'Previous chapter information',
    required: false,
    example: {
      id: 'ch-1089',
      title: 'Chapter 1089',
      url: 'https://example.com/manga/one-piece/chapter-1089',
      chapterNumber: 1089
    }
  })
  previousChapter?: {
    id: string;
    title: string;
    url: string;
    chapterNumber?: number;
  };

  @ApiProperty({
    description: 'Next chapter information',
    required: false,
    example: {
      id: 'ch-1091',
      title: 'Chapter 1091', 
      url: 'https://example.com/manga/one-piece/chapter-1091',
      chapterNumber: 1091
    }
  })
  nextChapter?: {
    id: string;
    title: string;
    url: string;
    chapterNumber?: number;
  };
}

export class MangaItemDto {
  @ApiProperty({
    example: '1',
    description: 'Manga ID',
  })
  id: string;

  @ApiProperty({
    example: 'One Piece',
    description: 'Manga title',
  })
  title: string;

  @ApiProperty({
    example: 'Eiichiro Oda',
    description: 'Manga author',
    required: false,
  })
  author?: string;

  @ApiProperty({
    example: 'https://example.com/cover.jpg',
    description: 'Cover image URL',
    required: false,
  })
  coverImage?: string;

  @ApiProperty({
    example: 1090,
    description: 'Latest chapter number',
    required: false,
  })
  latestChapter?: number;

  @ApiProperty({
    description: 'Last updated timestamp',
  })
  lastUpdated: String;

  @ApiProperty({
    example: 'https://example.com/manga/one-piece',
    description: 'Manga URL',
    required: false,
  })
  url?: string;

  @ApiProperty({
    type: [ChapterDto],
    description: 'List of available chapters',
    required: false,
  })
  chapters?: ChapterDto[];
}

export class WebsiteLastUpdatedDto {
  @ApiProperty({
    example: 'niceoppai',
    description: 'Website key',
  })
  websiteKey: string;

  @ApiProperty({
    example: 'Niceoppai',
    description: 'Website name',
  })
  websiteName: string;

  @ApiProperty({
    type: [MangaItemDto],
    description: 'List of latest updated manga (max 5)',
  })
  mangas: MangaItemDto[];

  @ApiProperty({
    example: '2026-01-20T10:00:00.000Z',
    description: 'Data fetched timestamp',
  })
  fetchedAt: Date;
}

export class LastUpdatedResponseDto {
  @ApiProperty({
    type: [WebsiteLastUpdatedDto],
    description: 'Latest updated manga from each supported website',
  })
  websites: WebsiteLastUpdatedDto[];

  @ApiProperty({
    example: '2026-01-20T10:00:00.000Z',
    description: 'Response timestamp',
  })
  timestamp: Date;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 1, description: 'Current page number' })
  currentPage: number;

  // @ApiProperty({ example: 10, description: 'Number of items per page' })
  // perPage: number;

  // @ApiProperty({ example: 50, description: 'Total number of items' })
  // total: number;

  @ApiProperty({ example: 5, description: 'Total number of pages' })
  totalPages: number;

  // @ApiProperty({ example: true, description: 'Whether there is a next page' })
  // hasNextPage: boolean;

  // @ApiProperty({ example: false, description: 'Whether there is a previous page' })
  // hasPrevPage: boolean;
}

export class WebsiteLastUpdatedPaginatedDto extends WebsiteLastUpdatedDto {
  @ApiProperty({ type: PaginationMetaDto, description: 'Pagination metadata' })
  pagination: PaginationMetaDto;
}
