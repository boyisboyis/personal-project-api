# Personal Project API - Manga Web Scraping

A NestJS-based API application specialized for manga web scraping operations with authentication and multi-website support. Built with **Bun** for faster performance and utilizes **Adapter Pattern** for scalable website integration.

## Features

- ⚡ **Bun Runtime** - Fast JavaScript runtime and package manager
- 🔐 **JWT Authentication** - User registration and login (in-memory storage)
- 🕷️ **Manga Scraping** - Multi-website manga data aggregation with adapter pattern
- 🌐 **Adapter Pattern** - Scalable architecture for adding new manga websites
- 📊 **Task Management** - Async scraping tasks with status tracking (in-memory)
- 🛡️ **Rate Limiting** - Built-in protection against abuse
- 📚 **API Documentation** - Swagger/OpenAPI integration
- 📝 **Logging** - Structured logging with Winston
- ✅ **Validation** - Request/response validation with class-validator
- ⚡ **Concurrent Processing** - Parallel data fetching from multiple websites
- 🔄 **Auto-Retry & Fallback** - Resilient error handling and availability checking

## Architecture

```
src/
├── app.module.ts          # Root application module
├── main.ts               # Application entry point
├── auth/                 # Authentication module
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.module.ts
│   ├── dto/             # Data transfer objects
│   ├── guards/          # Auth guards
│   └── strategies/      # JWT strategy
├── manga/               # Manga scraping module (NEW)
│   ├── manga.controller.ts
│   ├── manga.service.ts
│   ├── manga.module.ts
│   ├── dto/             # Manga DTOs
│   ├── adapters/        # Website adapters (Adapter Pattern)
│   │   ├── base/
│   │   │   ├── manga-scraper.interface.ts
│   │   │   └── base-manga-adapter.ts
│   │   ├── niceoppai-adapter.ts
│   │   ├── dokimori-adapter.ts
│   │   └── adapter-registry.ts
│   └── services/
│       └── manga-adapter.service.ts
├── scraper/             # Generic web scraping module
│   ├── scraper.controller.ts
│   ├── scraper.service.ts
│   ├── scraper.module.ts
│   ├── dto/             # Scraping DTOs
│   └── services/        # Puppeteer & Cheerio services
└── logs/               # Application logs
```

## Supported Manga Websites

- 🔵 **Niceoppai** - https://www.niceoppai.net
- 🟢 **Dokimori** - https://dokimori.com

*Adding new websites is easy with the adapter pattern!*

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   bun install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration

4. Run the application:
   ```bash
   bun run start:dev
   ```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/profile` - Get user profile (requires auth)

### Manga Data
- `GET /api/v1/manga/webs` - Get supported manga websites
- `GET /api/v1/manga/last-updated` - Get latest updated manga from all websites (5 per site)

### Generic Web Scraping
- `POST /api/v1/scraper/tasks` - Create scraping task (requires auth)
- `GET /api/v1/scraper/tasks` - Get user's tasks (requires auth)
- `GET /api/v1/scraper/tasks/:taskId` - Get specific task (requires auth)

## Example API Responses

### Get Latest Updated Manga
```bash
GET /api/v1/manga/last-updated
```

Response:
```json
{
  "websites": [
    {
      "websiteKey": "niceoppai",
      "websiteName": "Niceoppai", 
      "mangas": [
        {
          "id": "1",
          "title": "Chainsaw Man",
          "author": "Tatsuki Fujimoto",
          "coverImage": "https://example.com/chainsaw-man.jpg",
          "latestChapter": 145,
          "lastUpdated": "2026-01-20T09:00:00.000Z",
          "url": "https://www.niceoppai.net/manga/chainsaw-man"
        }
        // ... 4 more items
      ],
      "fetchedAt": "2026-01-20T10:00:00.000Z"
    },
    {
      "websiteKey": "dokimori",
      "websiteName": "Dokimori",
      "mangas": [
        {
          "id": "6",
          "title": "Attack on Titan", 
          "author": "Hajime Isayama",
          "coverImage": "https://example.com/attack-on-titan.jpg",
          "latestChapter": 139,
          "lastUpdated": "2026-01-20T09:15:00.000Z",
          "url": "https://dokimori.com/manga/attack-on-titan"
        }
        // ... 4 more items
      ],
      "fetchedAt": "2026-01-20T10:00:00.000Z"
    }
  ],
  "timestamp": "2026-01-20T10:00:00.000Z"
}
```

### Get Supported Websites
```bash
GET /api/v1/manga/webs
```

Response:
```json
[
  {
    "key": "niceoppai",
    "name": "Niceoppai",
    "url": "https://www.niceoppai.net"
  },
  {
    "key": "dokimori", 
    "name": "Dokimori",
    "url": "https://dokimori.com"
  }
]
```

## Generic Scraping Configuration

The API also supports generic web scraping with flexible configuration:

```json
{
  "url": "https://example.com",
  "config": {
    "selectors": ["h1", "p", ".content"],
    "useHeadless": true,
    "waitForSelector": ".dynamic-content",
    "screenshot": false,
    "timeout": 30000,
    "userAgent": "Custom User Agent"
  }
}
```

## Adding New Manga Websites

Thanks to the **Adapter Pattern**, adding new manga websites is straightforward:

### Step 1: Create New Adapter
```typescript
// src/manga/adapters/new-site-adapter.ts
import { Injectable } from '@nestjs/common';
import { BaseMangaAdapter } from './base/base-manga-adapter';
import { MangaItemDto } from '../dto/last-updated.dto';

@Injectable()
export class NewSiteAdapter extends BaseMangaAdapter {
  readonly websiteKey = 'newsite';
  readonly websiteName = 'New Manga Site';
  readonly websiteUrl = 'https://newsite.com';

  async getLatestUpdated(limit: number = 5): Promise<MangaItemDto[]> {
    try {
      this.logOperation(`Fetching latest ${limit} manga`);
      
      // Implement your scraping logic here
      const mangaData = await this.scrapeWebsite(limit);
      
      this.logOperation(`Successfully fetched ${mangaData.length} manga`);
      return mangaData;
    } catch (error) {
      this.handleError('getLatestUpdated', error);
    }
  }

  // Implement other required methods...
}
```

### Step 2: Register Adapter
```typescript
// src/manga/adapters/adapter-registry.ts
import { NewSiteAdapter } from './new-site-adapter';

constructor(
  // ... existing adapters
  private readonly newSiteAdapter: NewSiteAdapter,
) {
  this.registerAdapters();
}

private registerAdapters(): void {
  // ... existing registrations
  this.registerAdapter(this.newSiteAdapter);
}
```

### Step 3: Update Module
```typescript
// src/manga/manga.module.ts
import { NewSiteAdapter } from './adapters/new-site-adapter';

@Module({
  providers: [
    // ... existing providers
    NewSiteAdapter,
  ],
})
export class MangaModule {}
```

That's it! Your new website will automatically appear in the API responses.

## Development

- `bun run start:dev` - Start in development mode with hot reload
- `bun run build` - Build for production
- `bun test` - Run tests
- `bun run lint` - Lint code

## Testing the API

### Quick Test Commands

```bash
# Test supported websites
curl "http://localhost:3000/api/v1/manga/webs"

# Test latest manga updates
curl "http://localhost:3000/api/v1/manga/last-updated"

# Register user for authenticated endpoints
curl -X POST "http://localhost:3000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Login
curl -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## Performance Features

- **Concurrent Processing** - All website adapters run in parallel
- **Error Isolation** - Failed adapters don't affect others  
- **Availability Checking** - Automatic health checks for websites
- **Request Throttling** - Rate limiting (10 requests/minute for manga endpoints)
- **Efficient Caching** - In-memory storage for faster responses
- **Timing Metrics** - Performance logging for monitoring

## API Documentation

Access Swagger documentation at: `http://localhost:3000/api/docs`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment | development |
| PORT | Server port | 3000 |
| JWT_SECRET | JWT secret key | - |
| JWT_EXPIRES_IN | JWT expiration | 24h |
| CORS_ORIGIN | CORS origin | * |

## Tech Stack

- **Runtime**: Bun (JavaScript runtime)
- **Framework**: NestJS (Node.js framework)
- **Language**: TypeScript
- **Authentication**: JWT
- **Documentation**: Swagger/OpenAPI
- **Logging**: Winston
- **Validation**: class-validator & class-transformer
- **Rate Limiting**: @nestjs/throttler
- **Web Scraping**: Puppeteer + Cheerio
- **Architecture**: Adapter Pattern, Dependency Injection

## Project Structure Benefits

✅ **Scalable** - Easy to add new manga websites  
✅ **Maintainable** - Clear separation of concerns  
✅ **Testable** - Mockable adapters and services  
✅ **Resilient** - Error isolation and graceful degradation  
✅ **Performant** - Concurrent processing and caching  
✅ **Extensible** - Plugin-like adapter system  

**Note:** This application uses in-memory storage. All data (users, tasks) will be lost when the application restarts. Perfect for development and testing!