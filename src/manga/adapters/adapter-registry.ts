import { Injectable, Logger } from '@nestjs/common';
import { MangaScraperAdapter } from '@/manga/adapters/base/manga-scraper.interface';
import { NiceoppaiAdapter } from '@/manga/adapters/niceoppai-adapter';
import { DokimoriAdapter } from '@/manga/adapters/dokimori-adapter';
import { GodmangaAdapter } from '@/manga/adapters/godmanga-adapter';
import { TanukiAdapter } from '@/manga/adapters/tanuki-adapter';
import { NtrmangaAdapter } from '@/manga/adapters/ntrmanga-adapter';
import { MangaisekkaithaiAdapter } from '@/manga/adapters/mangaisekaithai-adapter';
import { MangaNekoAdapter } from '@/manga/adapters/manga-neko-adapter';

@Injectable()
export class AdapterRegistry {
  private readonly logger = new Logger(AdapterRegistry.name);
  private readonly adapters = new Map<string, MangaScraperAdapter>();

  constructor(
    private readonly niceoppaiAdapter: NiceoppaiAdapter,
    private readonly dokimoriAdapter: DokimoriAdapter,
    private readonly godmangaAdapter: GodmangaAdapter,
    private readonly tanukiAdapter: TanukiAdapter,
    private readonly ntrmangaAdapter: NtrmangaAdapter,
    private readonly mangaisekkaithaiAdapter: MangaisekkaithaiAdapter,
    private readonly mangaNekoAdapter: MangaNekoAdapter
  ) {
    this.registerAdapters();
  }

  private registerAdapters(): void {
    // Register all available adapters
    this.registerAdapter(this.niceoppaiAdapter);
    this.registerAdapter(this.dokimoriAdapter);
    this.registerAdapter(this.godmangaAdapter);
    this.registerAdapter(this.tanukiAdapter);
    this.registerAdapter(this.ntrmangaAdapter);
    this.registerAdapter(this.mangaisekkaithaiAdapter);
    this.registerAdapter(this.mangaNekoAdapter);

    this.logger.log(`Registered ${this.adapters.size} manga adapters: ${Array.from(this.adapters.keys()).join(', ')}`);
  }

  private registerAdapter(adapter: MangaScraperAdapter): void {
    this.adapters.set(adapter.websiteKey, adapter);
    this.logger.debug(`Registered adapter: ${adapter.websiteKey} (${adapter.websiteName})`);
  }

  /**
   * Get adapter by website key
   */
  getAdapter(websiteKey: string): MangaScraperAdapter | undefined {
    return this.adapters.get(websiteKey);
  }

  /**
   * Get all registered adapters
   */
  getAllAdapters(): MangaScraperAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Get all available (working) adapters
   */
  async getAvailableAdapters(): Promise<MangaScraperAdapter[]> {
    const availabilityChecks = await Promise.allSettled(
      Array.from(this.adapters.values()).map(async adapter => ({
        adapter,
        isAvailable: await adapter.isAvailable(),
      }))
    );

    const available = availabilityChecks
      .filter((result): result is PromiseFulfilledResult<{ adapter: MangaScraperAdapter; isAvailable: boolean }> => result.status === 'fulfilled' && result.value.isAvailable)
      .map(result => result.value.adapter);

    this.logger.log(`${available.length}/${this.adapters.size} adapters are currently available`);
    return available;
  }

  /**
   * Get adapter keys (website identifiers)
   */
  getAdapterKeys(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if adapter exists
   */
  hasAdapter(websiteKey: string): boolean {
    return this.adapters.has(websiteKey);
  }

  /**
   * Get adapter count
   */
  getAdapterCount(): number {
    return this.adapters.size;
  }

  /**
   * Get basic info about all adapters
   */
  getAdaptersInfo(): Array<{
    key: string;
    name: string;
    url: string;
  }> {
    return Array.from(this.adapters.values()).map(adapter => ({
      key: adapter.websiteKey,
      name: adapter.websiteName,
      url: adapter.websiteUrl,
    }));
  }
}
