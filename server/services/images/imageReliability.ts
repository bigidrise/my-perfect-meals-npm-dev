import { isPlaceholderImage, placeholderResult, type ImageResult } from "../../../shared/imageResult";
import { APPROVED_IMAGE_MODEL, IMAGE_LIMITS, isRetiredModel, type ImageModelPolicy } from "./imageModelRegistry";

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
type ProviderResponse = { data?: Array<{ url?: string; b64_json?: string }>; _request_id?: string | null };
export type ImageProviderCall = (prompt: string, signal: AbortSignal) => Promise<ProviderResponse>;

function requestId(error: any): string | undefined {
  const id = error?.request_id;
  return typeof id === "string" && /^req_[a-zA-Z0-9_-]{1,128}$/.test(id) ? id : undefined;
}

export function classifyImageError(error: any): string {
  const message = String(error?.error?.message ?? error?.message ?? "");
  if (/model/i.test(message) && /does not exist|retired|deprecat|not found/i.test(message)) return "model_unavailable";
  if (error?.status === 401 || error?.status === 403) return "provider_access_denied";
  if (error?.status === 429) return "provider_rate_limited";
  return "provider_failed";
}

export class ImageOperation {
  private attempts = 0;
  private reserved = 0;
  private uncertain = false;
  private terminalReason: string | null = null;
  result: ImageResult;
  constructor(
    readonly fallback: string,
    private readonly policy: ImageModelPolicy = APPROVED_IMAGE_MODEL,
    private readonly ledger = processLedger,
    private readonly timeoutMs: number = IMAGE_LIMITS.timeoutMs,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.result = { ...placeholderResult(fallback, "not_started"), provider: policy.provider, model: policy.model };
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
    if (isRetiredModel(this.policy, this.now())) return this.fail("model_retired");
    if (this.attempts >= IMAGE_LIMITS.maxAttempts) return this.fail("attempt_limit");
    const reservation = this.policy.reservationUSD;
    if (reservation === null || !Number.isFinite(reservation) || reservation <= 0) return this.fail("cost_bound_unapproved");
    if (this.reserved + reservation > IMAGE_LIMITS.operationUSD + 1e-9 || !this.ledger.reserve(reservation)) return this.fail("budget_exhausted");
    this.reserved += reservation;
    this.attempts++;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    this.result = { ...this.result, generation: "pending", reason: null, attempts: this.attempts };
    // Promise handlers remain attached after a timeout: late results never publish,
    // upload, cache, refund reservations, or start another request.
    const pending = Promise.resolve().then(() => call(prompt, controller.signal));
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        this.uncertain = true;
        this.result.cancellation = "requested_unconfirmed";
        controller.abort();
        resolve(null);
      }, this.timeoutMs);
    });
    try {
      const response = await Promise.race([pending, timeout]);
      if (this.uncertain || response === null) return this.fail("timeout_uncertain");
      this.result.requestId = requestId({ request_id: response._request_id });
      const item = response.data?.[0];
      const url = item?.b64_json ? `data:image/png;base64,${item.b64_json}` : item?.url;
      if (!url || isPlaceholderImage(url) || !(url.startsWith("data:image/png;base64,") || /^https:\/\//.test(url))) return this.fail("invalid_provider_response");
      this.result = {
        ...this.result, generation: "succeeded", verification: "pending",
        persistence: "not_started", display: "placeholder", url: this.fallback, reason: null,
      };
      return url;
    } catch (error) {
      if (this.uncertain) return this.fail("timeout_uncertain");
      this.result.requestId = requestId(error);
      this.terminalReason = classifyImageError(error);
      return this.fail(this.terminalReason);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
