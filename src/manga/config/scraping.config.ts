/**
 * Example configuration file for real website scraping
 * 
 * To enable real web scraping instead of mock data:
 * 
 * 1. Uncomment the scraping code in your adapters:
 *    - niceoppai-adapter.ts
 *    - dokimori-adapter.ts
 * 
 * 2. Configure the selectors and delays for each website
 * 
 * 3. Adjust timeouts and retry logic in manga-puppeteer.service.ts
 * 
 * IMPORTANT WARNINGS:
 * - Always respect robots.txt and rate limits
 * - Add proper error handling for network failures
 * - Consider using proxies for production
 * - Monitor memory usage with multiple browser instances
 * - Test thoroughly before deploying to production
 */

export const SCRAPING_CONFIG = {
  // Browser configuration
  browser: {
    headless: true,
    defaultTimeout: 30000,
    maxConcurrentPages: 5,
    userAgent: 'Mozilla/5.0 (compatible; MangaBot/1.0)',
  },

  // Website-specific configurations
  websites: {
    niceoppai: {
      baseUrl: 'https://www.niceoppai.net',
      paths: {
        latest: '/latest-updates',
        search: '/search',
      },
      selectors: {
        mangaList: '.manga-list .manga-item, .series-list .series-item',
        title: 'h3, .title, .series-title',
        author: '.author, .creator',
        coverImage: 'img',
        chapter: '.chapter, .latest-chapter',
        lastUpdated: '.date, .updated',
        link: 'a',
      },
      delays: {
        min: 800,
        max: 1500,
      },
    },

    dokimori: {
      baseUrl: 'https://dokimori.com',
      paths: {
        latest: '/latest',
        search: '/search',
      },
      selectors: {
        mangaList: '.manga-item, .series-container',
        title: '.manga-title, .series-name',
        author: '.author-name',
        coverImage: '.cover-image img, .thumbnail img',
        chapter: '.chapter-number',
        lastUpdated: '.update-date',
        link: 'a.manga-link',
      },
      delays: {
        min: 600,
        max: 1200,
      },
    },
  },

  // Rate limiting
  rateLimiting: {
    requestsPerMinute: 30,
    concurrentRequests: 3,
    retryAttempts: 3,
    retryDelay: 2000,
  },

  // Caching
  cache: {
    enabled: true,
    duration: 300000, // 5 minutes
    maxEntries: 1000,
  },
};

/**
 * Production deployment checklist:
 * 
 * □ Review and test all selectors
 * □ Implement proper error handling
 * □ Set up monitoring and logging
 * □ Configure rate limiting
 * □ Test with real websites
 * □ Consider legal implications
 * □ Set up cache invalidation
 * □ Monitor resource usage
 * □ Implement graceful degradation
 * □ Add health checks
 */