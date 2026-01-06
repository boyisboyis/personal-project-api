import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

export class SearchMangaDto {
  @ApiProperty({
    example: 'One Piece',
    description: 'Search by manga title or author',
    required: false,
  })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiProperty({
    example: 'Action',
    description: 'Filter by genre',
    required: false,
  })
  @IsOptional()
  @IsString()
  genre?: string;

  @ApiProperty({
    example: 'ongoing',
    description: 'Filter by manga status',
    enum: ['ongoing', 'completed', 'hiatus'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['ongoing', 'completed', 'hiatus'])
  status?: 'ongoing' | 'completed' | 'hiatus';

  @ApiProperty({
    example: 10,
    description: 'Limit number of results',
    required: false,
    default: 10,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  limit?: number = 10;
}