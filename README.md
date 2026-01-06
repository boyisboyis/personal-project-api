# Personal Project API - Web Scraping

A NestJS-based API application for web scraping operations with authentication and task management. Built with **Bun** for faster performance and better developer experience.

## Features

- ⚡ **Bun Runtime** - Fast JavaScript runtime and package manager
- 🔐 **JWT Authentication** - User registration and login (in-memory storage)
- 🕷️ **Web Scraping** - Support for both Puppeteer (headless browser) and Cheerio (HTML parsing)
- 📊 **Task Management** - Async scraping tasks with status tracking (in-memory)
- 🛡️ **Rate Limiting** - Built-in protection against abuse
- 📚 **API Documentation** - Swagger/OpenAPI integration
- 📝 **Logging** - Structured logging with Winston
- ✅ **Validation** - Request/response validation with class-validator

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
├── scraper/             # Web scraping module
│   ├── scraper.controller.ts
│   ├── scraper.service.ts
│   ├── scraper.module.ts
│   ├── dto/             # Scraping DTOs
│   └── services/        # Puppeteer & Cheerio services
└── common/              # Shared utilities
```

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
- `GET /api/v1/auth/profile` - Get user profile

### Web Scraping
- `POST /api/v1/scraper/tasks` - Create scraping task
- `GET /api/v1/scraper/tasks` - Get user's tasks
- `GET /api/v1/scraper/tasks/:taskId` - Get specific task

## Scraping Configuration

The API supports flexible scraping configuration:

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

## Development

- `bun run start:dev` - Start in development mode
- `bun run build` - Build for production
- `bun test` - Run tests
- `bun run lint` - Lint code

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

**Note:** This application uses in-memory storage. All data (users, tasks) will be lost when the application restarts.