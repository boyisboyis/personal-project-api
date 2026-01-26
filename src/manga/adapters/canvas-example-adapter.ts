import { Injectable, Logger } from '@nestjs/common';
import { MangaScraperAdapter } from '@/manga/adapters/base/manga-scraper.interface';
import { BaseMangaAdapter } from '@/manga/adapters/base/base-manga-adapter';
import { MangaItemDto } from '@/manga/dto/last-updated.dto';
import { ChapterImageDto } from '@/manga/dto/chapter-image.dto';
import { Page } from 'puppeteer';
import { MangaPuppeteerService } from '@/manga/services/manga-puppeteer-improved.service';

@Injectable()
export class CanvasExampleAdapter extends BaseMangaAdapter implements MangaScraperAdapter {
  readonly websiteKey = 'canvas-example';
  readonly websiteName = 'Canvas Example Site';
  readonly websiteUrl = 'https://example-canvas-site.com';

  protected readonly logger = new Logger(CanvasExampleAdapter.name);

  constructor(protected readonly puppeteerService: MangaPuppeteerService) {
    super();
  }

  async getLatestUpdated(page = 1, limit = 10): Promise<MangaItemDto[]> {
    // Implementation similar to other adapters
    return this.generateMockLatestUpdated(limit);
  }

  async extractMangaData(page: Page, baseUrl: string, limit?: number): Promise<MangaItemDto[]> {
    return this.generateMockLatestUpdated(limit || 10);
  }

  async searchManga(query: string, page = 1, limit = 10): Promise<MangaItemDto[]> {
    return this.generateMockSearchResults(query, limit);
  }

  async getMangaDetails(mangaKey: string): Promise<MangaItemDto | null> {
    return this.generateMockMangaDetails(mangaKey);
  }

  /**
   * Enhanced chapter image extraction with canvas support
   * This method demonstrates the new ChapterImageDto format
   */
  async extractChapterImages(page: Page, chapterUrl: string): Promise<ChapterImageDto[]> {
    return await page.evaluate((url) => {
      try {
        const images: ChapterImageDto[] = [];

        // Find regular images
        const regularImages = document.querySelectorAll('.manga-page img:not(.encrypted)') as NodeListOf<HTMLImageElement>;
        regularImages.forEach((img, index) => {
          const src = img.src || img.getAttribute('data-src');
          if (src) {
            images.push({
              url: src,
              type: 'image'
            });
          }
        });

        // Find encrypted/canvas images
        const encryptedImages = document.querySelectorAll('.manga-page img.encrypted, .encrypted-image') as NodeListOf<HTMLImageElement>;
        encryptedImages.forEach((img, index) => {
          const src = img.src || img.getAttribute('data-src');
          const decryptionKey = img.getAttribute('data-key') || 'default';
          
          if (src) {
            const canvasId = `encrypted-page-${index}-${Date.now()}`;
            images.push({
              url: src,
              type: 'canvas',
              html: `<canvas id="${canvasId}" class="encrypted-manga-page" style="max-width: 100%; height: auto; border: 1px solid #ccc;"></canvas>`,
              script: `<script>
                (function() {
                  const canvas = document.getElementById('${canvasId}');
                  if (!canvas) return;
                  
                  const ctx = canvas.getContext('2d');
                  const img = new Image();
                  img.crossOrigin = 'anonymous';
                  
                  img.onload = function() {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    
                    // Draw the encrypted image
                    ctx.drawImage(img, 0, 0);
                    
                    // Apply decryption (example: simple pixel manipulation)
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;
                    const key = parseInt('${decryptionKey}') || 128;
                    
                    // Simple decryption example - XOR each color channel
                    for (let i = 0; i < data.length; i += 4) {
                      data[i] = data[i] ^ key;     // Red
                      data[i + 1] = data[i + 1] ^ key; // Green
                      data[i + 2] = data[i + 2] ^ key; // Blue
                      // Alpha channel unchanged
                    }
                    
                    // Put the decrypted image back
                    ctx.putImageData(imageData, 0, 0);
                    
                    console.log('Decrypted image:', '${src}');
                  };
                  
                  img.onerror = function() {
                    console.error('Failed to load encrypted image:', '${src}');
                    // Show error message in canvas
                    ctx.fillStyle = '#ff0000';
                    ctx.font = '16px Arial';
                    ctx.fillText('Failed to load image', 10, 30);
                  };
                  
                  img.src = '${src}';
                })();
              </script>`
            });
          }
        });

        // Find images that need special handling (scrambled)
        const scrambledImages = document.querySelectorAll('.scrambled-image, .protected-content img') as NodeListOf<HTMLImageElement>;
        scrambledImages.forEach((img, index) => {
          const src = img.src || img.getAttribute('data-src');
          const scramblePattern = img.getAttribute('data-pattern') || 'default';
          
          if (src) {
            const canvasId = `scrambled-page-${index}-${Date.now()}`;
            images.push({
              url: src,
              type: 'canvas',
              html: `<canvas id="${canvasId}" class="scrambled-manga-page" style="max-width: 100%; height: auto;"></canvas>`,
              script: `<script>
                (function() {
                  const canvas = document.getElementById('${canvasId}');
                  if (!canvas) return;
                  
                  const ctx = canvas.getContext('2d');
                  const img = new Image();
                  img.crossOrigin = 'anonymous';
                  
                  img.onload = function() {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    
                    // Descramble the image based on pattern
                    const pattern = '${scramblePattern}';
                    
                    if (pattern === 'vertical_split') {
                      // Example: image is split vertically and needs reassembly
                      const halfHeight = img.height / 2;
                      ctx.drawImage(img, 0, halfHeight, img.width, halfHeight, 0, 0, img.width, halfHeight);
                      ctx.drawImage(img, 0, 0, img.width, halfHeight, 0, halfHeight, img.width, halfHeight);
                    } else if (pattern === 'tile_shuffle') {
                      // Example: image is divided into tiles that need reordering
                      // This is a simplified example - real implementation would be more complex
                      const tileSize = 64;
                      for (let y = 0; y < img.height; y += tileSize) {
                        for (let x = 0; x < img.width; x += tileSize) {
                          const newX = (x + tileSize) % img.width;
                          const newY = (y + tileSize) % img.height;
                          ctx.drawImage(img, x, y, tileSize, tileSize, newX, newY, tileSize, tileSize);
                        }
                      }
                    } else {
                      // Default: just draw normally
                      ctx.drawImage(img, 0, 0);
                    }
                    
                    console.log('Descrambled image with pattern:', pattern);
                  };
                  
                  img.src = '${src}';
                })();
              </script>`
            });
          }
        });

        return images;
      } catch (error) {
        console.error('Error extracting chapter images:', error);
        return [];
      }
    }, chapterUrl);
  }

  // Mock methods for demonstration
  private generateMockLatestUpdated(limit: number): MangaItemDto[] {
    return Array.from({ length: limit }, (_, i) => ({
      id: `canvas-manga-${i + 1}`,
      title: `Canvas Manga ${i + 1}`,
      author: 'Canvas Author',
      coverImage: `https://via.placeholder.com/200x300?text=Canvas+${i + 1}`,
      latestChapter: i + 10,
      lastUpdated: new Date().toISOString(),
      url: `${this.websiteUrl}/manga/canvas-manga-${i + 1}`,
      chapters: []
    }));
  }

  private generateMockSearchResults(query: string, limit: number): MangaItemDto[] {
    return this.generateMockLatestUpdated(limit);
  }

  private generateMockMangaDetails(mangaKey: string): MangaItemDto {
    return {
      id: mangaKey,
      title: 'Canvas Demo Manga',
      author: 'Canvas Demo Author',
      coverImage: 'https://via.placeholder.com/200x300?text=Canvas+Demo',
      latestChapter: 25,
      lastUpdated: new Date().toISOString(),
      url: `${this.websiteUrl}/manga/${mangaKey}`,
      chapters: Array.from({ length: 25 }, (_, i) => ({
        id: `ch-${i + 1}`,
        title: `Chapter ${i + 1}`,
        url: `${this.websiteUrl}/manga/${mangaKey}/chapter-${i + 1}`,
        chapterNumber: i + 1,
        publishedAt: new Date(Date.now() - (25 - i) * 86400000)
      }))
    };
  }
}