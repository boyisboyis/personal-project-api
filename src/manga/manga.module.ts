import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { MangaController } from './manga.controller';
import { MangaService } from './manga.service';

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
  providers: [MangaService],
  exports: [MangaService],
})
export class MangaModule {}