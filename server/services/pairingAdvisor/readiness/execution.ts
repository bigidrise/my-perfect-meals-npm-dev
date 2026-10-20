import type { TransportErrorCode } from "../../../../shared/pairingAdvisor/readiness/transport";

export class ReadinessFailure extends Error {
  constructor(readonly code: TransportErrorCode) { super(code); }
}
export type ModelStage = "interpretation" | "generation" | "review";
export type ExecutionLimits = { perAttemptMilliseconds: number; totalMilliseconds: number };
/** Offline harness settings only; not authority to configure or run a live provider. */
export const OFFLINE_EXECUTION_LIMITS: ExecutionLimits = Object.freeze({
  perAttemptMilliseconds: 15000, totalMilliseconds: 45000,
});

/** One executor per turn. No SDK, provider initialization, fallback, or retry loop. */
export class TurnExecution {
  private readonly controller = new AbortController();
  private readonly attempted = new Set<ModelStage>();
  private readonly pending = new Set<Promise<unknown>>();
  private readonly deadline: number;
  private readonly totalTimer: ReturnType<typeof setTimeout>;
  private stopCode: TransportErrorCode | null = null;
  private readonly onExternalAbort = () => this.stop("CANCELLED");
  constructor(
    private readonly limits: ExecutionLimits,
    private readonly now: () => number = Date.now,
    private readonly externalSignal?: AbortSignal,
  ) {
    if (![limits.perAttemptMilliseconds, limits.totalMilliseconds].every(n => Number.isFinite(n) && n > 0)
      || limits.perAttemptMilliseconds > 15000 || limits.totalMilliseconds > 45000) {
      throw new ReadinessFailure("INVALID_REQUEST");
    }
    this.deadline = now() + limits.totalMilliseconds;
    this.totalTimer = setTimeout(() => this.stop("DEADLINE_EXCEEDED"), limits.totalMilliseconds);
    externalSignal?.addEventListener("abort", this.onExternalAbort, { once: true });
    if (externalSignal?.aborted) this.stop("CANCELLED");
  }
  get signal(): AbortSignal { return this.controller.signal; }
  get physicalAttempts(): number { return this.attempted.size; }
  stop(code: "CANCELLED" | "DEADLINE_EXCEEDED"): void {
    if (!this.stopCode) { this.stopCode = code; this.controller.abort(); }
  }
  assertActive(): void {
    if (!this.stopCode && this.now() >= this.deadline) this.stop("DEADLINE_EXCEEDED");
    if (this.stopCode) throw new ReadinessFailure(this.stopCode);
  }
  async wait<T>(work: (signal: AbortSignal) => Promise<T>, perAttempt = false): Promise<T> {
    this.assertActive();
    const remaining = this.deadline - this.now();
    const milliseconds = perAttempt ? Math.min(remaining, this.limits.perAttemptMilliseconds) : remaining;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: () => void = () => undefined;
    const interrupted = new Promise<never>((_resolve, reject) => {
      onAbort = () => reject(new ReadinessFailure(this.stopCode ?? "CANCELLED"));
      this.signal.addEventListener("abort", onAbort, { once: true });
      timer = setTimeout(() => this.stop("DEADLINE_EXCEEDED"), milliseconds);
    });
    try {
      // Check again inside the microtask so a synchronous cancellation starts no work.
      const pending = Promise.resolve().then(() => { this.assertActive(); return work(this.signal); });
      this.pending.add(pending);
      void pending.then(() => this.pending.delete(pending), () => this.pending.delete(pending));
      const result = await Promise.race([pending, interrupted]);
      this.assertActive();
      return result;
    } finally {
      clearTimeout(timer);
      this.signal.removeEventListener("abort", onAbort);
    }
  }
  async model<T>(stage: ModelStage, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
    this.assertActive();
    if (this.attempted.has(stage) || this.attempted.size >= 3) throw new ReadinessFailure("ATTEMPT_LIMIT");
    this.attempted.add(stage); // Failed, timed-out and cancelled calls still consume the slot.
    return this.wait(work, true);
  }
  get hasPendingWork(): boolean { return this.pending.size > 0; }
  async whenDrained(): Promise<void> { await Promise.allSettled([...this.pending]); }
  close(): void {
    clearTimeout(this.totalTimer);
    this.externalSignal?.removeEventListener("abort", this.onExternalAbort);
  }
}
