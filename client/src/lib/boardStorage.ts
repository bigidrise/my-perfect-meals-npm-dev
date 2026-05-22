const BOARD_CACHE_NS = 'mpm.weeklyBoard';
const DRAFT_NS = 'mpm_board_draft_';
const STALE_AFTER_DAYS = 21;

export function evictStaleBoardCacheKeys(): void {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - STALE_AFTER_DAYS);
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    const dateRx = /(\d{4}-\d{2}-\d{2})/;

    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (!k.startsWith(BOARD_CACHE_NS) && !k.startsWith(DRAFT_NS)) continue;
      const m = k.match(dateRx);
      if (m && m[1] < cutoffISO) toRemove.push(k);
    }

    for (const k of toRemove) localStorage.removeItem(k);
    if (toRemove.length > 0) {
      console.log(`[MPM Board] Evicted ${toRemove.length} stale storage keys (older than ${cutoffISO})`);
    }
  } catch {}
}

export function safeBoardCacheWrite(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    evictStaleBoardCacheKeys();
    try {
      localStorage.setItem(key, value);
    } catch {
      console.warn('[MPM Board] Storage write failed even after eviction — continuing without cache');
    }
  }
}
