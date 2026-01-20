# Puppeteer Web Scraping Integration

## Overview
เพิ่ม Puppeteer service สำหรับ web scraping ใหม่แล้ว! ตอนนี้ระบบ adapter ของเราสามารถใช้ real web scraping แทน mock data ได้

## Features Added
✅ **MangaPuppeteerService** - Core web scraping service  
✅ **Browser Management** - Auto launch/close puppeteer browsers  
✅ **Data Extraction** - Generic methods for scraping manga data  
✅ **Error Handling** - Comprehensive error handling and logging  
✅ **Memory Management** - Proper browser instance cleanup  
✅ **Rate Limiting** - Built-in delays and request throttling  

## Architecture Integration
```
BaseMangaAdapter
├── setPuppeteerService() - Inject Puppeteer service
├── scrapeMangaListWithPuppeteer() - Scrape manga lists
└── scrapeMangaDetailsWithPuppeteer() - Scrape manga details

Concrete Adapters (NiceoppaiAdapter, DokimoriAdapter)
├── Constructor injection of MangaPuppeteerService
├── Real scraping methods (commented out for safety)
└── Fallback to mock data
```

## How to Enable Real Scraping

### 1. Uncomment Scraping Code
ใน `niceoppai-adapter.ts` และ `dokimori-adapter.ts`:

```typescript
// UNCOMMENT THESE LINES TO ENABLE REAL SCRAPING:
// const scrapedData = await this.scrapeMangaListWithPuppeteer(latestUrl, limit, {
//   waitForSelector: '.manga-list, .series-list',
//   delay: { min: 800, max: 1500 },
// });
```

### 2. Configure Website Selectors
อัปเดต selectors ใน `scraping.config.ts` ให้ตรงกับเว็บไซต์จริง:

```typescript
selectors: {
  mangaList: '.manga-list .manga-item',  // CSS selector สำหรับ list
  title: 'h3, .title',                   // CSS selector สำหรับ title
  author: '.author',                     // CSS selector สำหรับ author
  // ... อื่นๆ
}
```

### 3. Test Carefully
```bash
# Test with development server
bun run start:dev

# Monitor logs for scraping activities
tail -f logs/combined.log | grep 'PUPPETEER'
```

## Safety Features

### Mock Data Fallback
- Real scraping อยู่ใน comment state ป้องกันการใช้งานโดยอุบัติเหตุ
- ถ้า scraping fail จะ fallback ไป mock data อัตโนมัติ
- Graceful degradation ไม่ทำให้ API crash

### Error Handling
```typescript
try {
  // Real scraping attempt
  const scrapedData = await this.scrapeMangaListWithPuppeteer(...);
  if (scrapedData.length > 0) {
    return scrapedData;  // Use scraped data if successful
  }
} catch (error) {
  this.logger.warn('Scraping failed, falling back to mock data');
}

// Fallback to mock data
return this.mockMangaData;
```

### Browser Resource Management
- Auto-launch browsers when needed
- Proper cleanup and browser.close()
- Memory leak prevention
- Page timeout handling

## Production Considerations

### ⚠️ Important Warnings
1. **Legal Compliance** - Always check robots.txt and terms of service
2. **Rate Limiting** - Don't overwhelm target websites
3. **User Agent** - Use appropriate user agent strings
4. **Monitoring** - Watch for memory usage and performance
5. **Proxies** - Consider using proxy rotation for production

### Performance Tips
- Keep browser instances alive for multiple requests
- Use connection pooling
- Implement proper caching
- Monitor memory usage with `process.memoryUsage()`

## API Endpoints That Benefit
- `GET /manga/last-updated` - Real latest manga updates
- `GET /manga/search?q=naruto` - Real search results  
- `GET /manga/:id/details` - Real manga details

## Development Workflow
1. **Development**: Use mock data (current state)
2. **Testing**: Enable scraping for specific adapters
3. **Staging**: Test with real websites
4. **Production**: Full scraping with monitoring

## Monitoring & Debugging
```typescript
// Enable verbose Puppeteer logging
this.logger.debug(`[PUPPETEER] Browser launched: ${browser.version()}`);
this.logger.debug(`[PUPPETEER] Navigating to: ${url}`);
this.logger.debug(`[PUPPETEER] Found ${results.length} items`);
```

## Next Steps
1. Test selectors with real websites
2. Fine-tune delays and timeouts
3. Implement caching layer
4. Add health checks
5. Set up monitoring alerts

---

*Note: ระบบยังใช้ mock data เป็น default เพื่อความปลอดภัย การเปิดใช้ real scraping ต้องทำด้วยความระมัดระวังและทดสอบให้ดีก่อน*