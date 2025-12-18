// server/services/costGuard.ts
// Tracks model calls and enforces per-user and global budgets.
const WINDOW_MS = Number(process.env.COST_WINDOW_MS || 60_000);
const MAX_CALLS_PER_USER = Number(process.env.COST_MAX_CALLS_PER_USER || 60);
const MAX_CALLS_GLOBAL = Number(process.env.COST_MAX_CALLS_GLOBAL || 1000);

const userBuckets = new Map<string, { count: number; resetAt: number }>();
let globalBucket = { count: 0, resetAt: Date.now() + WINDOW_MS };

export function costGuardCheck(userId: string) {
  const now = Date.now();
  if (globalBucket.resetAt < now) { 
    globalBucket = { count: 0, resetAt: now + WINDOW_MS }; 
  }
  
  let u = userBuckets.get(userId);
  if (!u || u.resetAt < now) { 
    u = { count: 0, resetAt: now + WINDOW_MS }; 
    userBuckets.set(userId, u); 
  }
  
  if (u.count >= MAX_CALLS_PER_USER) throw new Error("budget:user");
  if (globalBucket.count >= MAX_CALLS_GLOBAL) throw new Error("budget:global");
  
  u.count++; 
  globalBucket.count++;
}