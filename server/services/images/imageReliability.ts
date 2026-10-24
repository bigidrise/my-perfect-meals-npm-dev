import { isPlaceholderImage, placeholderResult, type ImageResult } from "../../../shared/imageResult";
import { APPROVED_IMAGE_MODEL, IMAGE_LIMITS, isRetiredModel, developmentImageActivationAllowed, type ImageModelPolicy } from "./imageModelRegistry";
import { imageUsage, imageRequestId } from "./imageUsage";
import { claimDevelopmentImageTestRequest, DevelopmentImageTestError, developmentImageTestScope, rememberDevelopmentImageTestImage } from "./developmentImageTestScope";

/** Process-local reservation ledger, NOT a provider billing cap or a distributed quota.
 * Dispatched reservations stay held, including failures and uncertain timeouts.
 * No refund is inferred from an error, abort request, or missing usage.
 */
export class ImageSpendingLedger {
  private reserved = 0;
  constructor(readonly limitUSD: number) {
    if (!Number.isFinite(limitUSD) || limitUSD < 0) throw new Error("Invalid image budget");
  }
  reserve(amount: number): boolean {
    if (!Number.isFinite(amount) || amount <= 0 || this.reserved + amount > this.limitUSD + 1e-9) return false;
    this.reserved += amount;
    return true;
  }
  get reservedUSD(): number { return this.reserved; }
}

const processLedger = new ImageSpendingLedger(IMAGE_LIMITS.processUSD);
type ProviderResponse = { data?: Array<{ url?: string; b64_json?: string }>; _request_id?: string | null; usage?: unknown };
export type ImageProviderCall = (prompt: string, signal: AbortSignal) => Promise<ProviderResponse>;

function requestId(error: any): string | undefined {
  return imageRequestId(error?.request_id ?? error?._request_id);
}

export function classifyImageError(error: any): string {
  if (error instanceof DevelopmentImageTestError) return error.code;
  const message = String(error?.error?.message ?? error?.message ?? "");
  if (error?.code === "model_not_found" || error?.error?.code === "model_not_found" ||
    (/model/i.test(message) && /does not exist|retired|deprecat|not found|no longer available|shut.?down/i.test(message))) return "model_unavailable";
  if (error?.status === 401 || error?.status === 403) return "provider_access_denied";
  if (error?.status === 429) return "provider_rate_limited";
  return "provider_failed";
}

export class ImageOperation {
  private attempts = 0;
  private reserved = 0;
  private uncertain = false;
  private terminalReason: string | null = null;
  private deadline = 0;
  private controllers = new Set<AbortController>();
  result: ImageResult;
  constructor(
    readonly fallback: string,
    private readonly policy: ImageModelPolicy = APPROVED_IMAGE_MODEL,
    private readonly ledger = processLedger,
    private readonly timeoutMs: number = IMAGE_LIMITS.timeoutMs,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.result = { ...placeholderResult(fallback, "not_started"), provider: policy.provider, model: policy.model };
    this.deadline = this.now().getTime() + IMAGE_LIMITS.operationMs;
  }
  get remainingMs() { return Math.max(0, this.deadline - this.now().getTime()); }
  get stopped() { return this.uncertain || !!this.terminalReason || !this.remainingMs; }
  expire(stage = "operation") {
    this.uncertain = true;
    this.terminalReason = `${stage}_timeout_uncertain`;
    for (const c of this.controllers) c.abort();
    this.result = { ...this.result, display: "placeholder", url: this.fallback,
      reason: this.terminalReason, cancellation: "requested_unconfirmed",
      spending: { reservedUSD: this.reserved, estimatedKnownCostUSD: this.result.spending?.estimatedKnownCostUSD ?? 0, accountingUncertain: true } };
  }
  async bounded<T>(stage: string, call: (signal: AbortSignal) => Promise<T>, cap = this.remainingMs): Promise<T> {
    if (this.stopped) throw new Error("operation_stopped");
    const c = new AbortController(); this.controllers.add(c);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.resolve().then(() => call(c.signal)),
        new Promise<never>((_, reject) => { timer = setTimeout(() => {
          this.expire(stage); c.abort(); reject(new Error("operation_deadline"));
        }, Math.min(cap, this.remainingMs)); }),
      ]);
    } finally { if (timer) clearTimeout(timer); this.controllers.delete(c); }
  }
  account(stage: "generation" | "verification", usage: unknown, id?: unknown): boolean {
    try {
      const evidence = { stage, ...imageUsage(stage, usage), requestId: imageRequestId(id) };
      const total = (this.result.spending?.estimatedKnownCostUSD ?? 0) + evidence.estimatedCostUSD;
      this.result = { ...this.result, evidence: [...(this.result.evidence ?? []), evidence],
        spending: { reservedUSD: this.reserved, estimatedKnownCostUSD: total, accountingUncertain: false } };
      if (total > this.reserved) throw new Error("reservation_exceeded");
      return true;
    } catch {
      this.terminalReason = `${stage}_accounting_uncertain`;
      this.result = { ...this.result, reason: this.terminalReason,
        spending: { reservedUSD: this.reserved, estimatedKnownCostUSD: this.result.spending?.estimatedKnownCostUSD ?? 0, accountingUncertain: true } };
      return false;
    }
  }
  private fail(reason: string): null {
    this.result = {
      ...this.result, generation: this.uncertain ? "pending" : "failed",
      display: "placeholder", url: this.fallback, reason, attempts: this.attempts,
    };
    return null;
  }
  async generate(prompt: string, call: ImageProviderCall): Promise<string | null> {
    if (this.uncertain) return this.fail("timeout_uncertain");
    if (this.terminalReason) return this.fail(this.terminalReason);
    if (!this.remainingMs) return this.fail("overall_deadline");
    if (isRetiredModel(this.policy, this.now())) return this.fail("model_retired");
    if (this.policy.requiresDevelopmentActivation && !developmentImageActivationAllowed(process.env)) return this.fail("activation_pending");
    if (this.attempts >= (developmentImageTestScope() ? 1 : IMAGE_LIMITS.maxAttempts)) return this.fail("attempt_limit");
    const reservation = this.policy.reservationUSD;
    if (reservation === null || !Number.isFinite(reservation) || reservation <= 0) return this.fail("cost_bound_unapproved");
    if (this.reserved + reservation > IMAGE_LIMITS.operationUSD + 1e-9 || !this.ledger.reserve(reservation)) return this.fail("budget_exhausted");
    this.reserved += reservation;
    this.result.spending = { reservedUSD: this.reserved,
      estimatedKnownCostUSD: this.result.spending?.estimatedKnownCostUSD ?? 0, accountingUncertain: false };
    this.attempts++;
    const controller = new AbortController();
    this.controllers.add(controller);
    let timer: ReturnType<typeof setTimeout> | undefined;
    this.result = { ...this.result, generation: "pending", reason: null, attempts: this.attempts };
    // Promise handlers remain attached after a timeout: late results never publish,
    // upload, cache, refund reservations, or start another request.
    const pending = Promise.resolve().then(() => {
      claimDevelopmentImageTestRequest("generation");
      return call(prompt, controller.signal);
    });
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        this.expire("generation");
        controller.abort();
        resolve(null);
      }, Math.min(this.timeoutMs, this.remainingMs));
    });
    try {
      const response = await Promise.race([pending, timeout]);
      if (this.uncertain || response === null) return this.fail("timeout_uncertain");
      this.result.requestId = imageRequestId(response._request_id);
      if (!this.account("generation", response.usage, response._request_id)) return this.fail("generation_accounting_uncertain");
      const item = response.data?.[0];
      const url = item?.b64_json ? `data:image/png;base64,${item.b64_json}` : item?.url;
      if (response.data?.length !== 1 || !url || isPlaceholderImage(url) || !(url.startsWith("data:image/png;base64,") || /^https:\/\//.test(url))) return this.fail("invalid_provider_response");
      rememberDevelopmentImageTestImage(url);
      this.result = {
        ...this.result, generation: "succeeded", verification: "pending",
        persistence: "not_started", display: "placeholder", url: this.fallback, reason: null,
      };
      return url;
    } catch (error) {
      if (this.uncertain) return this.fail("timeout_uncertain");
      this.result.requestId = requestId(error);
      this.terminalReason = classifyImageError(error);
      this.result.spending = { reservedUSD: this.reserved,
        estimatedKnownCostUSD: this.result.spending?.estimatedKnownCostUSD ?? 0, accountingUncertain: true };
      return this.fail(this.terminalReason);
    } finally {
      if (timer) clearTimeout(timer);
      this.controllers.delete(controller);
    }
  }
}
