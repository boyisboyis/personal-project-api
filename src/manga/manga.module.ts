import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { MangaController } from './manga.controller';
import { MangaService } from './manga.service';
import { MangaAdapterService } from './services/manga-adapter.service';
import { AdapterRegistry } from './adapters/adapter-registry';
import { NiceoppaiAdapter } from './adapters/niceoppai-adapter';
import { DokimoriAdapter } from './adapters/dokimori-adapter';

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
  providers: [MangaService, MangaAdapterService, AdapterRegistry, NiceoppaiAdapter, DokimoriAdapter],
  exports: [MangaService],
})
export class MangaModule {}
