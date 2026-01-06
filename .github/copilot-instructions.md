<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## NestJS API Project with Web Scraping

This is a NestJS API project focused on web scraping capabilities.

### Project Architecture
- **Framework**: NestJS with TypeScript
- **Runtime**: Bun for faster performance
- **Web Scraping**: Puppeteer, Cheerio, Axios
- **Storage**: In-memory (no database persistence)
- **Authentication**: JWT
- **Validation**: class-validator, class-transformer
- **Documentation**: Swagger/OpenAPI

### Code Style Guidelines
- Use TypeScript strict mode
- Follow NestJS conventions and best practices
- Use decorators for validation and transformation
- Implement proper error handling and logging
- Use DTOs for request/response validation
- Follow clean architecture principles

### File Structure
```
src/
├── app.module.ts
├── main.ts
├── auth/                 # Authentication module (in-memory)
├── scraper/             # Web scraping module
└── common/              # Shared utilities
```

### Development Rules
- Always validate input data using class-validator
- Use environment variables for configuration
- Implement proper logging with structured logs
- Add Swagger documentation for all endpoints
- Use interceptors for response transformation
- Implement rate limiting for scraping endpoints
- Data stored in-memory (no persistence between restarts)