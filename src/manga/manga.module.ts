import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { MangaController } from '@/manga/manga.controller';
import { MangaService } from '@/manga/manga.service';
import { MangaAdapterService } from '@/manga/services/manga-adapter.service';
import { MangaPuppeteerService } from '@/manga/services/manga-puppeteer-improved.service';
import { AdapterRegistry } from '@/manga/adapters/adapter-registry';
import { NiceoppaiAdapter } from '@/manga/adapters/niceoppai-adapter';
import { DokimoriAdapter } from '@/manga/adapters/dokimori-adapter';
import { HealthController } from '@/common/health/health.controller';
import { HealthService } from '@/common/health/health.service';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10, // Limit manga requests
      },
    ]),
  ],
  controllers: [MangaController, HealthController],
  providers: [MangaService, MangaAdapterService, MangaPuppeteerService, AdapterRegistry, NiceoppaiAdapter, DokimoriAdapter, HealthService],
  exports: [MangaService, AdapterRegistry, HealthService],
})
export class MangaModule {}
