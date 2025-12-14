// server/services/mealgenCache.ts
// Intelligent in-memory cache with TTL for meal generation results
export type CacheEntry<T> = { value: T; expiresAt: number };

export class MealgenCache<T = any> {
  private store = new Map<string, CacheEntry<T>>();
  
  constructor(private ttlMs = 5 * 60 * 1000, private max = 200) {}

  get(key: string): T | null {
    const hit = this.store.get(key);
    if (!hit) return null;
    
    if (hit.expiresAt < Date.now()) { 
      this.store.delete(key); 
      return null; 
    }
    
    return hit.value;
  }

  set(key: string, value: T) {
    if (this.store.size >= this.max) {
      // Simple eviction: delete oldest entry
      const first = this.store.keys().next().value;
      if (first) this.store.delete(first);
    }
    
    this.store.set(key, { 
      value, 
      expiresAt: Date.now() + this.ttlMs 
    });
  }

  clear() {
    this.store.clear();
  }

  size() {
    return this.store.size;
  }
}