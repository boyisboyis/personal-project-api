import { ApiProperty } from '@nestjs/swagger';

export type ImageType = 'image' | 'canvas';

export class ChapterImageDto {
  @ApiProperty({
    example: 'https://example.com/manga/chapter-1/page-1.jpg',
    description: 'Image URL',
  })
  url: string;

  @ApiProperty({
    example: 'image',
    enum: ['image', 'canvas'],
    description: 'Type of content: image (direct image) or canvas (requires rendering)',
  })
  type: ImageType;

  @ApiProperty({
    example: '<canvas id="page1" width="800" height="1200"></canvas>',
    description: 'HTML content for canvas type images',
    required: false,
  })
  html?: string;

  @ApiProperty({
    example: '<script>// Canvas drawing script here</script>',
    description: 'JavaScript code to render canvas or handle special image loading',
    required: false,
  })
  script?: string;
}