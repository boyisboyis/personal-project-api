import { Controller, Get, Query, Res, Logger, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import axios from 'axios';

@ApiTags('Image Proxy')
@Controller('image')
export class ImageController {
  private readonly logger = new Logger(ImageController.name);

  @ApiOperation({
    summary: 'Proxy image to bypass CORS restrictions',
    description: 'Fetches an image from external URL and returns it with proper headers to bypass CORS restrictions',
  })
  @ApiQuery({
    name: 'image',
    required: true,
    description: 'External image URL to proxy',
    example: 'https://god-manga.com/wp-content/uploads/2023/08/Martial-God-Regressed-to-Level-2.webp',
  })
  @ApiResponse({
    status: 200,
    description: 'Image successfully proxied',
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or missing image URL',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests',
  })
  @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 requests per minute
  @Get()
  async proxyImage(@Query('image') imageUrl: string, @Res() res: Response): Promise<void> {
    if (!imageUrl) {
      throw new BadRequestException('Image URL is required');
    }

    // Validate URL format
    try {
      const url = new URL(imageUrl);

      // Security check: only allow certain domains
      const allowedDomains = [
        'god-manga.com',
        'niceoppai.net',
        'www.niceoppai.net',
        'dokimori.com',
        'www.dokimori.com',
        'tanuki-manga.com',
        'www.tanuki-manga.com',
        'wp.com',
        'ntr-manga.com',
        'mangaisekaithai.com'
      ].concat(
        Array(10)
          .fill(1)
          .map((_, i) => `server${i + 1}.webtoon168.com`)
      );

      const isAllowedDomain = allowedDomains.some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain));

      if (!isAllowedDomain) {
        throw new BadRequestException('Domain not allowed for image proxying');
      }

      // Validate file extension (optional security measure)
      const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
      const hasValidExtension = validExtensions.some(ext => url.pathname.toLowerCase().endsWith(ext));

      if (!hasValidExtension) {
        this.logger.warn(`Suspicious file extension in URL: ${imageUrl}`);
      }
    } catch (error) {
      throw new BadRequestException('Invalid image URL format');
    }

    try {
      this.logger.debug(`Proxying image: ${imageUrl}`);

      let response;
      try {
        // First attempt with full browser headers
        response = await this.fetchImageWithHeaders(imageUrl, 'full');
      } catch (error) {
        if (error.response?.status === 403) {
          this.logger.debug(`403 error, trying with minimal headers: ${imageUrl}`);
          // Retry with minimal headers if 403
          response = await this.fetchImageWithHeaders(imageUrl, 'minimal');
        } else {
          throw error;
        }
      }

      // Handle non-success HTTP status codes
      if (response.status >= 400) {
        this.logger.warn(`Received HTTP ${response.status} for image: ${imageUrl}`);

        if (response.status === 403) {
          throw new BadRequestException('Image access forbidden - may be protected by hotlink protection');
        } else if (response.status === 404) {
          throw new BadRequestException('Image not found');
        } else {
          throw new BadRequestException(`Image server returned: ${response.status} ${response.statusText}`);
        }
      }

      // Verify we received image data
      if (!response.data || response.data.length === 0) {
        throw new BadRequestException('Received empty image data');
      }

      // Get content type from response or determine from URL
      let contentType = response.headers['content-type'] || 'image/jpeg';

      if (!contentType.startsWith('image/')) {
        // Determine content type from URL extension
        const url = new URL(imageUrl);
        const extension = url.pathname.toLowerCase().split('.').pop();
        const mimeTypes: Record<string, string> = {
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          png: 'image/png',
          gif: 'image/gif',
          webp: 'image/webp',
          bmp: 'image/bmp',
          svg: 'image/svg+xml',
        };
        contentType = (extension && mimeTypes[extension]) || 'image/jpeg';
      }

      // Set response headers
      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'X-Proxied-From': new URL(imageUrl).hostname,
      });

      // Send image buffer
      res.send(Buffer.from(response.data));

      this.logger.debug(`Successfully proxied image: ${imageUrl} (${contentType})`);
    } catch (error) {
      this.logger.error(`Failed to proxy image ${imageUrl}:`, error.message);

      if (error.response?.status) {
        throw new HttpException(
          `Failed to fetch image: ${error.response.status} ${error.response.statusText}`,
          error.response.status >= 400 && error.response.status < 500 ? HttpStatus.BAD_REQUEST : HttpStatus.BAD_GATEWAY
        );
      } else if (error.code === 'ENOTFOUND') {
        throw new BadRequestException('Image URL not found or unreachable');
      } else if (error.code === 'ETIMEDOUT') {
        throw new HttpException('Image request timeout', HttpStatus.REQUEST_TIMEOUT);
      } else {
        throw new HttpException('Failed to proxy image', HttpStatus.BAD_GATEWAY);
      }
    }
  }

  private async fetchImageWithHeaders(imageUrl: string, strategy: 'full' | 'minimal') {
    const parsedUrl = new URL(imageUrl);

    let headers;
    if (strategy === 'full') {
      headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site',
        Referer: parsedUrl.origin + '/',
        Origin: parsedUrl.origin,
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Upgrade-Insecure-Requests': '1',
      };
    } else {
      // Minimal headers strategy - sometimes less is more
      headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: '*/*',
        Referer: parsedUrl.origin + '/',
      };
    }

    const godDomain = Array(10)
      .fill(1)
      .map((_, i) => `server${i + 1}.webtoon168.com`);
    const isGodManga = godDomain.some(domain => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith('.' + domain));

    if (isGodManga) {
      headers = {
        accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9,th;q=0.8',
        priority: 'i',
        referer: 'https://god-manga.com/',
        'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'image',
        'sec-fetch-mode': 'no-cors',
        'sec-fetch-site': 'cross-site',
        'sec-fetch-storage-access': 'none',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
      };
    }

    return axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxContentLength: 10 * 1024 * 1024,
      maxRedirects: 5,
      headers,
      validateStatus: function (status) {
        return status < 500;
      },
    });
  }
}
