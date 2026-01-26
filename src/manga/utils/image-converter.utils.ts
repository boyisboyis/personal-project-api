import { ChapterImageDto, ImageType } from '../dto/chapter-image.dto';

/**
 * Convert string URLs to ChapterImageDto objects
 * Detects canvas-based images and marks them appropriately
 */
export function convertUrlsToChapterImages(urls: string[]): ChapterImageDto[] {
  return urls.map(url => {
    // Check if URL or page suggests canvas rendering is needed
    const isCanvasType = detectCanvasImage(url);
    
    const image: ChapterImageDto = {
      url: url,
      type: isCanvasType ? 'canvas' : 'image',
    };

    // If it's a canvas type, add placeholder HTML and script
    if (isCanvasType) {
      image.html = generateCanvasHtml(url);
      image.script = generateCanvasScript(url);
    }

    return image;
  });
}

/**
 * Detect if an image requires canvas rendering
 * This can be expanded based on URL patterns or specific website logic
 */
function detectCanvasImage(url: string): boolean {
  // Add patterns that suggest canvas rendering is needed
  const canvasPatterns = [
    /encrypted/i,
    /protected/i,
    /canvas/i,
    /scrambled/i,
    /obfuscated/i,
  ];

  return canvasPatterns.some(pattern => pattern.test(url));
}

/**
 * Generate canvas HTML for canvas-type images
 */
function generateCanvasHtml(url: string): string {
  const imageId = generateImageId(url);
  return `<canvas id="${imageId}" class="manga-page-canvas"></canvas>`;
}

/**
 * Generate canvas rendering script
 */
function generateCanvasScript(url: string): string {
  const imageId = generateImageId(url);
  return `<script>
    (function() {
      const canvas = document.getElementById('${imageId}');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function() {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
      };
      img.src = '${url}';
    })();
  </script>`;
}

/**
 * Generate unique ID for canvas element based on URL
 */
function generateImageId(url: string): string {
  // Create a simple hash from URL for ID
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `manga-page-${Math.abs(hash)}`;
}

/**
 * Convert legacy string[] images to new format for backward compatibility
 */
export function convertLegacyImages(images: string[] | ChapterImageDto[]): ChapterImageDto[] {
  if (!images || images.length === 0) {
    return [];
  }

  // If already in new format, return as-is
  if (typeof images[0] === 'object' && 'url' in images[0]) {
    return images as ChapterImageDto[];
  }

  // Convert from string[] format
  return convertUrlsToChapterImages(images as string[]);
}