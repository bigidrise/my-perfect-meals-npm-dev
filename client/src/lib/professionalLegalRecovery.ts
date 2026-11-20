export type ProfessionalLegalRecoveryAction =
  | "studio-creation"
  | "client-invite"
  | "professional-workspace";

const STORAGE_KEY = "mpm_professional_legal_recovery";

interface RecoveryContext {
  returnTo: string;
  action: ProfessionalLegalRecoveryAction;
  userId?: string;
}

export function safeProfessionalReturnTo(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (/[\\\u0000-\u0020\u007f]/.test(value)) return null;
  try {
    if (new URL(value, "https://professional-return.invalid").origin !== "https://professional-return.invalid") return null;
  } catch {
    return null;
  }
  if (value.startsWith("/auth") || value.startsWith("/procare-attestation")) return null;
  return value;
}

export function inferProfessionalLegalAction(
  requestUrl: string,
  method: string,
): ProfessionalLegalRecoveryAction {
  const normalizedMethod = method.toUpperCase();
  if (
    normalizedMethod === "POST" &&
    (
      requestUrl.includes("/invite") ||
      requestUrl.includes("/care-team/invite") ||
      requestUrl.includes("/coaching/send-invite")
    )
  ) {
    return "client-invite";
  }
  if (normalizedMethod === "POST" && /\/api\/studios\/?$/.test(requestUrl.split("?")[0])) {
    return "studio-creation";
  }
  return "professional-workspace";
}

export function createProfessionalLegalRecoveryUrl(
  returnTo: string | null | undefined,
  action: ProfessionalLegalRecoveryAction = "professional-workspace",
  userId?: string,
): string {
  const safeReturnTo = safeProfessionalReturnTo(returnTo) || "/professional-dashboard";
  const context: RecoveryContext = { returnTo: safeReturnTo, action, userId };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context));
  } catch {
    // Query parameters still preserve the recovery destination.
  }

  const params = new URLSearchParams({
    recovery: "true",
    legalOnly: "true",
    action,
    returnTo: safeReturnTo,
  });
  return `/procare-attestation?${params.toString()}`;
}

export function readProfessionalLegalRecovery(
  search: string,
  userId?: string,
): RecoveryContext | null {
  const params = new URLSearchParams(search);
  const queryReturnTo = safeProfessionalReturnTo(params.get("returnTo"));
  const queryAction = params.get("action");
  if (
    queryReturnTo &&
    (
      queryAction === "studio-creation" ||
      queryAction === "client-invite" ||
      queryAction === "professional-workspace"
    )
  ) {
    return { returnTo: queryReturnTo, action: queryAction };
  }

  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    const storedReturnTo = safeProfessionalReturnTo(stored?.returnTo);
    if (
      storedReturnTo &&
      (!userId || stored?.userId === userId) &&
      (
        stored?.action === "studio-creation" ||
        stored?.action === "client-invite" ||
        stored?.action === "professional-workspace"
      )
    ) {
      return { returnTo: storedReturnTo, action: stored.action };
    }
  } catch {
    // Invalid recovery state is ignored.
  }
  return null;
}

export function clearProfessionalLegalRecovery(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing else is required.
  }
}