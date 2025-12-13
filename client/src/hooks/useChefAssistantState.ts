// client/src/hooks/useChefAssistantState.ts
// Optional: simple session-based visibility control so the bubble doesn't keep popping up repeatedly.
import { useEffect, useState } from "react";

const KEY = "chefAssistantDismissedAt";

export function useChefAssistantState(autoShowDelayMs = 0) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem(KEY);
    if (!dismissed) {
      const t = setTimeout(() => setShow(true), autoShowDelayMs);
      return () => clearTimeout(t);
    }
  }, [autoShowDelayMs]);

  function dismiss() {
    sessionStorage.setItem(KEY, String(Date.now()));
    setShow(false);
  }

  function reopen() {
    sessionStorage.removeItem(KEY);
    setShow(true);
  }

  return { show, dismiss, reopen, setShow };
}