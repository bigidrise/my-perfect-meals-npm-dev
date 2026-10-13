import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/apiRequest";

/** Read-only completion evidence; calculator drafts and browser caches are not saves. */
export function savedMacroSetupComplete(value: unknown): boolean {
  if (!value || typeof value !== "object") throw new Error("Invalid saved nutrition response.");
  const record = value as Record<string, unknown>;
  if (record.hasTargets === false) return false;
  const fields = ["calories", "protein_g", "carbs_g", "fat_g"] as const;
  if (record.hasTargets !== true || !fields.every(key =>
    typeof record[key] === "number" && Number.isFinite(record[key]) && record[key] >= 0)
    || (record.calories as number) <= 0) {
    throw new Error("Saved nutrition targets could not be confirmed.");
  }
  return true;
}

export function useSavedMacroSetup(accountId: string | null) {
  const [evidence, setEvidence] = useState<{
    accountId: string | null;
    complete: boolean | null;
    error: string | null;
  }>({ accountId: null, complete: null, error: null });
  const requestVersion = useRef(0);
  const currentAccount = useRef(accountId);
  currentAccount.current = accountId;

  useEffect(() => {
    const version = ++requestVersion.current;
    if (!accountId) return;
    const controller = new AbortController();
    setEvidence({ accountId, complete: null, error: null });
    apiRequest(`/api/users/${encodeURIComponent(accountId)}/macro-targets`, {
      method: "GET", cache: "no-store", signal: controller.signal,
    }).then(value => {
      const complete = savedMacroSetupComplete(value);
      if (requestVersion.current === version && !controller.signal.aborted) {
        setEvidence({ accountId, complete, error: null });
      }
    }).catch(() => {
      if (requestVersion.current === version && !controller.signal.aborted) {
        setEvidence({
          accountId, complete: null,
          error: "Your saved nutrition targets couldn't be checked. You can still open Guide manually.",
        });
      }
    });
    return () => controller.abort();
  }, [accountId]);

  // Call only after the existing target write succeeds. A pending older read
  // must not replace this successful save with a pre-save incomplete response.
  const markSaved = useCallback(() => {
    if (!accountId || currentAccount.current !== accountId) return;
    ++requestVersion.current;
    setEvidence({ accountId, complete: true, error: null });
  }, [accountId]);

  return {
    complete: accountId && evidence.accountId === accountId ? evidence.complete : null,
    error: accountId && evidence.accountId === accountId ? evidence.error : null,
    markSaved,
  };
}
