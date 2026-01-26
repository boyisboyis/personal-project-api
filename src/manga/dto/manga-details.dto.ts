import { ApiProperty } from '@nestjs/swagger';
import { MangaItemDto, ChapterDto } from './last-updated.dto';

export class MangaDetailsDto {
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
    description: 'Cover image URL at root level',
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

/**
 * Convert MangaItemDto to MangaDetailsDto with coverImage at root level
 */
export function toMangaDetailsDto(mangaItem: MangaItemDto): MangaDetailsDto {
  return {
    id: mangaItem.id,
    title: mangaItem.title,
    author: mangaItem.author,
    coverImage: mangaItem.coverImage, // Move coverImage to root level
    latestChapter: mangaItem.latestChapter,
    lastUpdated: mangaItem.lastUpdated,
    url: mangaItem.url,
    chapters: mangaItem.chapters,
  };
}