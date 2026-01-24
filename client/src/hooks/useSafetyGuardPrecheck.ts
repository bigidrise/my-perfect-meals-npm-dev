import { useState, useCallback } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { SafetyAlertState, EMPTY_SAFETY_ALERT } from "@/components/SafetyGuardBanner";
import { isGuestMode } from "@/lib/guestMode";

interface PreflightResult {
  result: "SAFE" | "BLOCKED" | "AMBIGUOUS";
  blockedTerms: string[];
  blockedCategories: string[];
  ambiguousTerms: string[];
  message: string;
  suggestion?: string;
}

interface UseSafetyGuardPrecheckResult {
  checking: boolean;
  alert: SafetyAlertState;
  checkSafety: (input: string, builderId?: string, guestAllergies?: string[]) => Promise<boolean>;
  clearAlert: () => void;
  setAlert: (alert: SafetyAlertState) => void;
  setOverrideToken: (token: string) => void;
  overrideToken: string | undefined;
  hasActiveOverride: boolean;
}

export function useSafetyGuardPrecheck(): UseSafetyGuardPrecheckResult {
  const [checking, setChecking] = useState(false);
  const [alert, setAlert] = useState<SafetyAlertState>(EMPTY_SAFETY_ALERT);
  const [overrideToken, setOverrideTokenState] = useState<string | undefined>();

  const checkSafety = useCallback(async (input: string, builderId: string = "preflight", guestAllergies?: string[]): Promise<boolean> => {
    if (!input.trim()) {
      return true;
    }

    if (overrideToken) {
      return true;
    }

    setChecking(true);
    
    try {
      const isGuest = isGuestMode();
      
      const response = await fetch(apiUrl("/api/safety-check"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          input, 
          builderId,
          ...(isGuest && guestAllergies && guestAllergies.length > 0 ? { guestAllergies } : {})
        })
      });

      if (!response.ok) {
        console.warn("[SafetyGuard] Preflight check failed, allowing generation");
        return true;
      }

      const data: PreflightResult = await response.json();

      if (data.result === "SAFE") {
        setAlert(EMPTY_SAFETY_ALERT);
        return true;
      }

      setAlert({
        show: true,
        result: data.result,
        blockedTerms: data.blockedTerms,
        blockedCategories: data.blockedCategories,
        ambiguousTerms: data.ambiguousTerms,
        message: data.message,
        suggestion: data.suggestion
      });

      return false;
    } catch (error) {
      console.error("[SafetyGuard] Preflight check error:", error);
      return true;
    } finally {
      setChecking(false);
    }
  }, [overrideToken]);

  const clearAlert = useCallback(() => {
    setAlert(EMPTY_SAFETY_ALERT);
  }, []);

  const setOverrideToken = useCallback((token: string) => {
    setOverrideTokenState(token);
    setAlert(EMPTY_SAFETY_ALERT);
  }, []);

  return {
    checking,
    alert,
    checkSafety,
    clearAlert,
    setAlert,
    setOverrideToken,
    overrideToken,
    hasActiveOverride: !!overrideToken
  };
}
