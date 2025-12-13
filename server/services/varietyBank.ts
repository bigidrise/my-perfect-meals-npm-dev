// server/services/varietyBank.ts
// Prevent repeats across sessions by tracking meal signatures per user with TTL.
// Replace with Redis in prod; this is an in-memory starter.
export class VarietyBank {
  private store = new Map<string, Map<string, number>>(); // userId -> sig -> expiresAt
  
  constructor(private ttlMs = 14 * 24 * 60 * 60 * 1000, private maxPerUser = 500) {}

  add(userId: string, sig: string) {
    const now = Date.now();
    let user = this.store.get(userId);
    if (!user) { 
      user = new Map(); 
      this.store.set(userId, user); 
    }
    
    // evict expired
    user.forEach((v, k) => {
      if (v < now) user.delete(k);
    });
    
    // cap size
    if (user.size >= this.maxPerUser) {
      const entries = Array.from(user.entries());
      const oldest = entries.sort((a, b) => a[1] - b[1])[0]?.[0];
      if (oldest) user.delete(oldest);
    }
    
    user.set(sig, now + this.ttlMs);
  }

  has(userId: string, sig: string): boolean {
    const now = Date.now();
    const user = this.store.get(userId);
    if (!user) return false;
    
    const exp = user.get(sig);
    if (!exp) return false;
    
    if (exp < now) { 
      user.delete(sig); 
      return false; 
    }
    
    return true;
  }
}

export const varietyBank = new VarietyBank();