import { ApiProperty } from '@nestjs/swagger';

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
