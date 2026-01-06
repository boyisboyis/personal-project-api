import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsEnum, IsArray, Min, Max } from 'class-validator';

export class CreateMangaDto {
  @ApiProperty({
    example: 'One Piece',
    description: 'Manga title',
  })
  @IsString()
  title: string;

  @ApiProperty({
    example: 'Eiichiro Oda',
    description: 'Manga author',
    required: false,
  })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiProperty({
    example: 'The adventures of Monkey D. Luffy and his pirate crew',
    description: 'Manga description',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 'https://example.com/cover.jpg',
    description: 'Cover image URL',
    required: false,
  })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiProperty({
    example: 1000,
    description: 'Number of chapters',
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  chapters?: number;

  @ApiProperty({
    example: 'ongoing',
    description: 'Manga status',
    enum: ['ongoing', 'completed', 'hiatus'],
    required: false,
    default: 'ongoing',
  })
  @IsOptional()
  @IsEnum(['ongoing', 'completed', 'hiatus'])
  status?: 'ongoing' | 'completed' | 'hiatus';

  @ApiProperty({
    example: ['Action', 'Adventure', 'Comedy'],
    description: 'Manga genres',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genres?: string[];

  @ApiProperty({
    example: 9.5,
    description: 'Manga rating (0-10)',
    required: false,
    minimum: 0,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  rating?: number;

  @ApiProperty({
    example: 'https://manga-site.com/one-piece',
    description: 'Manga source URL',
    required: false,
  })
  @IsOptional()
  @IsString()
  url?: string;
}