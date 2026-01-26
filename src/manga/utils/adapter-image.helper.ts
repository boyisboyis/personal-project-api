import { ChapterImageDto } from '../dto/chapter-image.dto';

/**
 * Legacy adapter helper to convert string[] results to ChapterImageDto[]
 * This allows existing adapters to work with new format without modification
 */
export class AdapterImageHelper {
  /**
   * Convert array of image URLs to ChapterImageDto array
   */
  static convertLegacyImages(urls: string[], websiteKey?: string): ChapterImageDto[] {
    return urls.map((url, index) => {
      // Detect if image might need canvas rendering based on URL or website
      // const needsCanvas = this.detectCanvasNeed(url, websiteKey);
      
      const image: ChapterImageDto = {
        url,
        // type: needsCanvas ? 'canvas' : 'image',
        type: 'image',
      };

      // if (needsCanvas) {
      //   image.html = this.generateCanvasHtml(url, index);
      //   image.script = this.generateCanvasScript(url, index);
      // }

      return image;
    });
  }

  /**
   * Detect if image needs canvas rendering
   */
  private static detectCanvasNeed(url: string, websiteKey?: string): boolean {
    // URL patterns that suggest canvas rendering
    const canvasPatterns = [
      /encrypted/i,
      /protected/i,
      /scrambled/i,
      /obfuscated/i,
      /canvas/i,
    ];

    // Website-specific detection
    const canvasWebsites = ['ntrmanga', 'some-encrypted-site'];
    const isCanvasWebsite = websiteKey && canvasWebsites.includes(websiteKey);

    return canvasPatterns.some(pattern => pattern.test(url)) || isCanvasWebsite || false;
  }

  /**
   * Generate canvas HTML element
   */
  private static generateCanvasHtml(url: string, index: number): string {
    const canvasId = `manga-canvas-${index}-${Date.now()}`;
    return `<canvas id="${canvasId}" class="manga-page-canvas" style="max-width: 100%; height: auto;"></canvas>`;
  }

  /**
   * Generate canvas rendering script
   */
  private static generateCanvasScript(url: string, index: number): string {
    const canvasId = `manga-canvas-${index}-${Date.now()}`;
    return `<script>
      (function() {
        const canvas = document.getElementById('${canvasId}');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = function() {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          
          // Add any decryption/descrambling logic here if needed
          // This is a placeholder for site-specific image processing
        };
        
        img.onerror = function() {
          console.error('Failed to load image:', '${url}');
          // Fallback: show error message or retry
        };
        
        img.src = '${url}';
      })();
    </script>`;
  }

  /**
   * Enhanced canvas script with decryption support
   */
  static generateDecryptionScript(url: string, index: number, decryptionKey?: string): string {
    const canvasId = `manga-canvas-${index}-${Date.now()}`;
    return `<script>
      (function() {
        const canvas = document.getElementById('${canvasId}');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = function() {
          canvas.width = img.width;
          canvas.height = img.height;
          
          // Draw original image
          ctx.drawImage(img, 0, 0);
          
          // Apply decryption if key is provided
          ${decryptionKey ? `
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Simple XOR decryption example (site-specific logic should go here)
          for (let i = 0; i < data.length; i += 4) {
            data[i] = data[i] ^ ${decryptionKey}; // Red
            data[i + 1] = data[i + 1] ^ ${decryptionKey}; // Green
            data[i + 2] = data[i + 2] ^ ${decryptionKey}; // Blue
            // Alpha channel remains unchanged
          }
          
          ctx.putImageData(imageData, 0, 0);
          ` : '// No decryption needed'}
        };
        
        img.onerror = function() {
          console.error('Failed to load image:', '${url}');
        };
        
        img.src = '${url}';
      })();
    </script>`;
  }
}