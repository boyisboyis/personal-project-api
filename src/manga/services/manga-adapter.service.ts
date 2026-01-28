import { Injectable, Logger } from '@nestjs/common';
import { AdapterRegistry } from '@/manga/adapters/adapter-registry';
import { WebsiteLastUpdatedDto } from '@/manga/dto/last-updated.dto';
import { ChapterImageDto } from '@/manga/dto/chapter-image.dto';
import { SupportedWebsiteDto } from '@/manga/dto/supported-website.dto';
import { MangaDetailsDto, toMangaDetailsDto } from '@/manga/dto/manga-details.dto';
import { MetricsService } from '@/common/monitoring/metrics.service';
import { proxyImageUrl } from '@/common/image/image.utils';
import { CacheService } from '@/common/cache/cache.service';

@Injectable()
export class MangaAdapterService {
  private readonly logger = new Logger(MangaAdapterService.name);

  constructor(
    private readonly adapterRegistry: AdapterRegistry,
    private readonly metricsService: MetricsService,
    private readonly cacheService: CacheService
  ) {}

  /**
   * Get supported websites information
   */
  async getSupportedWebsites(): Promise<SupportedWebsiteDto[]> {
    const adaptersInfo = this.adapterRegistry.getAdaptersInfo();

    return adaptersInfo.map(info => ({
      key: info.key,
      name: info.name,
      url: info.url,
    }));
  }

  /**
   * Get latest updated manga from specific website
   */
  async getLastUpdatedByWebsite(websiteKey: string, limit: number = 5, page: number = 1): Promise<WebsiteLastUpdatedDto> {
    this.logger.log(`Fetching last updated manga from ${websiteKey} (page: ${page}) with limit ${limit})`);

    const adapter = this.adapterRegistry.getAdapter(websiteKey);
    if (!adapter) {
      throw new Error(`Adapter not found for website: ${websiteKey}`);
    }

    const fetchedAt = new Date();
    const overallStartTime = Date.now();

    try {
      const startTime = Date.now();
      const mangas = await adapter.getLatestUpdated(page, limit);
      const duration = Date.now() - startTime;

      // Record metrics
      this.metricsService.recordScrape(adapter.websiteKey, duration, true, mangas.length);
      this.metricsService.recordMetric('last_updated_single_operation', duration, {
        website: websiteKey,
        items: mangas.length.toString(),
      });

      // Apply image proxy to cover images
      const proxiedMangas = mangas.map(manga => ({
        ...manga,
        coverImage: manga.coverImage ? proxyImageUrl(manga.coverImage) : undefined,
      }));

      const website: WebsiteLastUpdatedDto = {
        websiteKey: adapter.websiteKey,
        websiteName: adapter.websiteName,
        mangas: proxiedMangas,
        fetchedAt,
      };

      const overallDuration = Date.now() - overallStartTime;

      this.logger.log(`Successfully fetched ${mangas.length} manga from ${adapter.websiteName} in ${overallDuration}ms`);

      return website;
    } catch (error) {
      this.metricsService.recordScrape(adapter.websiteKey, Date.now() - overallStartTime, false);
      this.logger.error(`Failed to fetch from ${adapter.websiteName}:`, error.message);

      // Return empty result instead of throwing error
      return {
        websiteKey: adapter.websiteKey,
        websiteName: adapter.websiteName,
        mangas: [],
        fetchedAt,
      };
    }
  }

  /**
   * Get latest updated manga from all websites
   */
  async getAllLastUpdated(limit: number = 5): Promise<WebsiteLastUpdatedDto[]> {
    this.logger.log(`Fetching last updated manga from all websites (limit: ${limit})`);

    const adapters = this.adapterRegistry.getAllAdapters();
    const results: WebsiteLastUpdatedDto[] = [];
    const overallStartTime = Date.now();

    // Fetch from all adapters in parallel
    const promises = adapters.map(async adapter => {
      try {
        const startTime = Date.now();
        const mangas = await adapter.getLatestUpdated(1, limit);
        const duration = Date.now() - startTime;

        this.metricsService.recordScrape(adapter.websiteKey, duration, true, mangas.length);

        return {
          websiteKey: adapter.websiteKey,
          websiteName: adapter.websiteName,
          mangas,
          fetchedAt: new Date(),
        };
      } catch (error) {
        this.metricsService.recordScrape(adapter.websiteKey, Date.now() - overallStartTime, false);
        this.logger.error(`Failed to fetch from ${adapter.websiteName}:`, error.message);

        // Return empty result for failed adapters
        return {
          websiteKey: adapter.websiteKey,
          websiteName: adapter.websiteName,
          mangas: [],
          fetchedAt: new Date(),
        };
      }
    });

    const websiteResults = await Promise.all(promises);

    // Apply image proxy to all cover images
    const proxiedResults = websiteResults.map(website => ({
      ...website,
      mangas: website.mangas.map(manga => ({
        ...manga,
        coverImage: manga.coverImage ? proxyImageUrl(manga.coverImage) : undefined,
      })),
    }));

    results.push(...proxiedResults);

    const overallDuration = Date.now() - overallStartTime;
    const totalManga = results.reduce((sum, site) => sum + site.mangas.length, 0);

    this.logger.log(`Successfully fetched ${totalManga} manga from ${results.length} websites in ${overallDuration}ms`);
    return results;
  }

  /**
   * Get manga details from specific website using manga key
   */
  async getMangaDetails(websiteKey: string, mangaKey: string): Promise<MangaDetailsDto | null> {
    this.logger.log(`Fetching manga details for ${mangaKey} from ${websiteKey}`);

    const adapter = this.adapterRegistry.getAdapter(websiteKey);
    if (!adapter) {
      throw new Error(`Adapter not found for website: ${websiteKey}`);
    }

    const startTime = Date.now();

    try {
      const cacheKey = `manga-chapter:${websiteKey}:${mangaKey}`;

      // Try to get from cache first
      const mangaDetails = await this.cacheService.getOrSet(
        cacheKey,
        () => adapter.getMangaDetails(mangaKey),
        10 * 60 * 1000 // 5 minutes TTL
      );

      const duration = Date.now() - startTime;

      // Record metrics
      this.metricsService.recordScrape(adapter.websiteKey, duration, true, mangaDetails ? 1 : 0);
      this.metricsService.recordMetric('manga_details_operation', duration, {
        website: websiteKey,
        found: mangaDetails ? 'true' : 'false',
      });

      if (!mangaDetails) {
        this.logger.warn(`Manga details not found for ${mangaKey} from ${adapter.websiteName}`);
        return null;
      }

      this.logger.log(`Successfully fetched manga details for ${mangaKey} from ${adapter.websiteName} in ${duration}ms`);

      // Apply image proxy to cover image and convert to MangaDetailsDto
      const proxiedMangaDetails = {
        ...mangaDetails,
        coverImage: mangaDetails.coverImage ? proxyImageUrl(mangaDetails.coverImage) : undefined,
      };

      // Convert to MangaDetailsDto which has coverImage at root level
      return toMangaDetailsDto(proxiedMangaDetails);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metricsService.recordScrape(adapter.websiteKey, duration, false);
      this.logger.error(`Failed to fetch manga details for ${mangaKey} from ${adapter.websiteName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get chapter details from specific website using manga key and chapter ID
   */
  async getChapterDetails(websiteKey: string, mangaKey: string, chapterId: string) {
    this.logger.log(`Fetching chapter details for ${chapterId} from ${mangaKey} on ${websiteKey}`);

    const adapter = this.adapterRegistry.getAdapter(websiteKey);
    if (!adapter) {
      throw new Error(`Adapter not found for website: ${websiteKey}`);
    }

    const startTime = Date.now();

    try {
      // First get manga details to find the chapter
      const cacheKey = `manga-chapter:${websiteKey}:${mangaKey}`;

      // Try to get from cache first
      const mangaDetails = await this.cacheService.getOrSet(
        cacheKey,
        () => adapter.getMangaDetails(mangaKey),
        10 * 60 * 1000 // 5 minutes TTL
      );
      const duration = Date.now() - startTime;

      if (!mangaDetails || !mangaDetails.chapters) {
        this.logger.warn(`Manga or chapters not found for ${mangaKey} from ${adapter.websiteName}`);
        return null;
      }

      // Find the specific chapter by ID and its index
      const chapterIndex = mangaDetails.chapters.findIndex(ch => ch.id === chapterId);

      if (chapterIndex === -1) {
        this.logger.warn(`Chapter ${chapterId} not found in manga ${mangaKey} from ${adapter.websiteName}`);
        return null;
      }

      const chapter = mangaDetails.chapters[chapterIndex];

      // Find previous and next chapters
      const previousChapter = chapterIndex < mangaDetails.chapters.length - 1 ? mangaDetails.chapters[chapterIndex + 1] : null;
      const nextChapter = chapterIndex > 0 ? mangaDetails.chapters[chapterIndex - 1] : null;

      this.logger.log(`Chapter navigation: Previous: ${previousChapter?.title || 'none'}, Current: ${chapter.title}, Next: ${nextChapter?.title || 'none'}`);

      // Scrape chapter images if the adapter supports it
      let images: ChapterImageDto[] = [];
      if (typeof (adapter as any).extractChapterImages === 'function' || typeof (adapter as any).extractChapterImagesEnhanced === 'function') {
        try {
          const puppeteerService = (adapter as any).puppeteerService;
          if (puppeteerService) {
            const scrapingConfig = (adapter as any).getDefaultScrapingConfig?.() || {};

            // Scrape images using enhanced service that returns ChapterImageDto[]
            const imageResult = await puppeteerService.scrapeChapterImages(chapter.url, adapter, scrapingConfig);

            // The result should now always be ChapterImageDto[] due to AdapterWrapper
            if (imageResult.images && imageResult.images.length > 0) {
              images = (imageResult.images as ChapterImageDto[]).map(img => ({
                ...img,
                url: proxyImageUrl(img.url), // Apply proxy to URLs
              }));
              this.logger.log(`Successfully scraped ${images.length} images for chapter ${chapterId} (proxied)`);
            }
          }
        } catch (error) {
          this.logger.warn(`Failed to scrape images for chapter ${chapterId}:`, error.message);
        }
      }

      // Record metrics
      this.metricsService.recordScrape(adapter.websiteKey, duration, true, 1);
      this.metricsService.recordMetric('chapter_details_operation', duration, {
        website: websiteKey,
        found: 'true',
        imagesCount: images.length.toString(),
      });

      this.logger.log(`Successfully fetched chapter details for ${chapterId} from ${adapter.websiteName} in ${duration}ms`);

      // Return chapter with additional manga context, proxied images, and navigation
      return {
        ...chapter,
        images,
        chapters: mangaDetails.chapters,
        manga: {
          id: mangaDetails.id,
          title: mangaDetails.title,
          author: mangaDetails.author,
          coverImage: proxyImageUrl(mangaDetails.coverImage || ''), // Proxy cover image too
          url: mangaDetails.url,
        },
        previousChapter: previousChapter
          ? {
              id: previousChapter.id,
              title: previousChapter.title,
              url: previousChapter.url,
              chapterNumber: previousChapter.chapterNumber,
            }
          : undefined,
        nextChapter: nextChapter
          ? {
              id: nextChapter.id,
              title: nextChapter.title,
              url: nextChapter.url,
              chapterNumber: nextChapter.chapterNumber,
            }
          : undefined,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metricsService.recordScrape(adapter.websiteKey, duration, false);
      this.logger.error(`Failed to fetch chapter details for ${chapterId} from ${adapter.websiteName}:`, error.message);
      throw error;
    }
  }
}
