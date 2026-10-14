type ResumeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
interface ResumeFlow {
  flowVersion: string;
  totalSteps: number;
}

function resumeKey(accountId: string | null | undefined): string | null {
  return accountId ? `mpm.onboarding.resume:${encodeURIComponent(accountId)}` : null;
}

/**
 * Old browser-wide resumeStep/flowVersion keys have no provable owner.
 * Never read, migrate, or delete them on behalf of the current account.
 */
export function readOnboardingResumeStep(
  storage: ResumeStorage,
  accountId: string | null | undefined,
  flow: ResumeFlow,
): number {
  const key = resumeKey(accountId);
  if (!key) return 1;
  const raw = storage.getItem(key);
  if (!raw) return 1;
  let saved: unknown;
  try {
    saved = JSON.parse(raw);
  } catch {
    return 1;
  }
  if (!saved || typeof saved !== "object") return 1;
  const value = saved as { step?: unknown; flowVersion?: unknown };
  if (typeof value.step !== "number" || !Number.isInteger(value.step)
    || value.step < 1 || typeof value.flowVersion !== "string") return 1;
  // Preserve the existing nutrition-priorities step insertion migration,
  // but only for a position already owned by this account.
  const step = value.flowVersion !== flow.flowVersion && value.step >= 6
    ? value.step + 1 : value.step;
  return step <= flow.totalSteps ? step : 1;
}

export function writeOnboardingResumeStep(
  storage: ResumeStorage,
  accountId: string | null | undefined,
  step: number,
  flow: ResumeFlow,
): void {
  const key = resumeKey(accountId);
  if (!key) throw new Error("An account is required to save onboarding position");
  if (!Number.isInteger(step) || step < 1 || step > flow.totalSteps) {
    throw new Error("Invalid onboarding position");
  }
  // One atomic browser entry prevents a step/version pair being partially saved.
  storage.setItem(key, JSON.stringify({ step, flowVersion: flow.flowVersion }));
}

export function clearOnboardingResume(
  storage: ResumeStorage,
  accountId: string | null | undefined,
): void {
  const key = resumeKey(accountId);
  if (key) storage.removeItem(key);
}
