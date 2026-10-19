export type LimitLease =
  | { accepted: true; release: () => void }
  | { accepted: false; reason: "RATE_LIMITED" | "IN_FLIGHT"; retryAfterSeconds: number };

/** Account-scoped, sliding-minute, process-local limits for undeployed Development only. */
export function createAdvisorRequestLimits(now: () => number = Date.now) {
  const accounts = new Map<string, { timestamps: number[]; inFlight: number }>();
  return {
    acquire(accountId: string): LimitLease {
      const time = now();
      for (const [key, entry] of accounts) {
        entry.timestamps = entry.timestamps.filter(timestamp => timestamp > time - 60000);
        if (!entry.inFlight && !entry.timestamps.length) accounts.delete(key);
      }
      const entry = accounts.get(accountId) ?? { timestamps: [], inFlight: 0 };
      if (entry.inFlight) return { accepted: false, reason: "IN_FLIGHT", retryAfterSeconds: 1 };
      if (entry.timestamps.length >= 5) {
        return {
          accepted: false, reason: "RATE_LIMITED",
          retryAfterSeconds: Math.max(1, Math.ceil((entry.timestamps[0] + 60000 - time) / 1000)),
        };
      }
      entry.timestamps.push(time);
      entry.inFlight++;
      accounts.set(accountId, entry);
      let released = false;
      return {
        accepted: true,
        release() {
          if (!released) entry.inFlight--;
          released = true;
        },
      };
    },
  };
}
