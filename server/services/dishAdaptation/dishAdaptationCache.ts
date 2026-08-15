/**
 * LRU cache for dish adaptation decompositions.
 * Key: hash(normalized dish name + sorted guardrail IDs).
 * Max 500 entries, 24h TTL. True LRU: reads promote recency.
 *
 * MANDATORY per architecture — the gpt-4o-mini decomposition call must never
 * repeat for the same dish + guardrail combination within the TTL window.
 */

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export class LruTtlCache<V> {
  private map = new Map<string, CacheEntry<V>>();

  constructor(
    private readonly maxEntries: number = 500,
    private readonly ttlMs: number = 24 * 60 * 60 * 1000,
  ) {}

  get(key: string): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    // Promote recency (Map preserves insertion order)
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}
