import { PartialType } from '@nestjs/swagger';
import { CreateMangaDto } from '@/manga/dto/create-manga.dto';

export class UpdateMangaDto extends PartialType(CreateMangaDto) {}
