import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class SupportedWebsiteDto {
  @ApiProperty({
    example: "MangaDex",
    description: "Website name",
  })
  @IsString()
  key: string;

  @ApiProperty({
    example: "One Piece",
    description: "Manga title",
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: "https://mangadex.org",
    description: "Website URL",
  })
  @IsString()
  url: string;
}
