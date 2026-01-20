import { Injectable, Logger } from '@nestjs/common';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  hitRate: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private cache = new Map<string, CacheEntry<any>>();
  private stats = { hits: 0, misses: 0 };
  private readonly defaultTtl = 5 * 60 * 1000; // 5 minutes
  private readonly maxEntries = 1000;
  
  /**
   * Set cache entry with TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    // Cleanup expired entries if cache is getting full
    if (this.cache.size >= this.maxEntries) {
      this.cleanup();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTtl,
    };

    this.cache.set(key, entry);
    this.logger.debug(`Cache SET: ${key} (TTL: ${entry.ttl}ms)`);
  }

  /**
   * Get cache entry if not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.logger.debug(`Cache MISS: ${key}`);
      return null;
    }

    const now = Date.now();
    const age = now - entry.timestamp;

    if (age > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      this.logger.debug(`Cache EXPIRED: ${key} (age: ${age}ms)`);
      return null;
    }

    this.stats.hits++;
    this.logger.debug(`Cache HIT: ${key} (age: ${age}ms)`);
    return entry.data as T;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete specific cache entry
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.logger.debug(`Cache DELETE: ${key}`);
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
    this.logger.log(`Cache cleared. Removed ${size} entries`);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      entries: this.cache.size,
      hitRate: totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0,
    };
  }

  /**
   * Get or set cache entry (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    try {
      const data = await factory();
      this.set(key, data, ttl);
      return data;
    } catch (error) {
      this.logger.error(`Cache factory failed for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Remove expired entries
   */
  cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.logger.debug(`Cache cleanup: removed ${removed} expired entries`);
    }
  }

  /**
   * Get cache keys matching pattern
   */
  getKeys(pattern?: string): string[] {
    const keys = Array.from(this.cache.keys());
    
    if (!pattern) {
      return keys;
    }

    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return keys.filter(key => regex.test(key));
  }

  /**
   * Get cache size in approximate bytes
   */
  getSize(): { entries: number; approximateBytes: number } {
    let bytes = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      bytes += key.length * 2; // String characters are 2 bytes
      bytes += JSON.stringify(entry.data).length * 2;
      bytes += 24; // Approximate overhead per entry
    }

    return {
      entries: this.cache.size,
      approximateBytes: bytes,
    };
  }

  /**
   * Create cache key for manga scraping
   */
  static createMangaKey(websiteKey: string, operation: string, ...params: string[]): string {
    return `manga:${websiteKey}:${operation}:${params.join(':')}`;
  }

  /**
   * Create cache key for search operations
   */
  static createSearchKey(websiteKey: string, query: string, limit?: number): string {
    return `search:${websiteKey}:${encodeURIComponent(query)}:${limit || 'default'}`;
  }
}