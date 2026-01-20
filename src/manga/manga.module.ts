import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { MangaController } from '@/manga/manga.controller';
import { MangaService } from '@/manga/manga.service';
import { MangaAdapterService } from '@/manga/services/manga-adapter.service';
import { MangaPuppeteerService } from '@/manga/services/manga-puppeteer.service';
import { AdapterRegistry } from '@/manga/adapters/adapter-registry';
import { NiceoppaiAdapter } from '@/manga/adapters/niceoppai-adapter';
import { DokimoriAdapter } from '@/manga/adapters/dokimori-adapter';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10, // Limit manga requests
      },
    ]),
  ],
  controllers: [MangaController],
  providers: [MangaService, MangaAdapterService, MangaPuppeteerService, AdapterRegistry, NiceoppaiAdapter, DokimoriAdapter],
  exports: [MangaService],
})
export class MangaModule {}
