import { useState, useCallback, useRef, MutableRefObject } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { SafetyAlertState, EMPTY_SAFETY_ALERT } from "@/components/SafetyGuardBanner";
import { isGuestMode } from "@/lib/guestMode";

export interface DietAdaptPayload {
  matchedTerms: string[];
  message: string;
  suggestion?: string;
  diet: string;
}

export interface AllergyConflictPayload {
  type: "conflict_adaptable" | "conflict_identity_collapse";
  allergens: string[];
  matchedTerms: string[];
  dishName: string;
}

interface PreflightResult {
  result: "SAFE" | "BLOCKED" | "AMBIGUOUS" | "DIET_ADAPT";
  blockedTerms: string[];
  blockedCategories: string[];
  ambiguousTerms: string[];
  message: string;
  suggestion?: string;
  allergyConflict?: AllergyConflictPayload | null;
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
  dietAdaptPayload: MutableRefObject<DietAdaptPayload | null>;
  /** Set when a BLOCKED result includes an allergyConflict payload.
   *  Cleared after the modal is handled (user picks an option or cancels). */
  allergyConflictPayload: MutableRefObject<AllergyConflictPayload | null>;
  /** Restores the SafetyGuardBanner BLOCKED state for "Make the original" flow. */
  restoreBlockedAlert: () => void;
}

export function useSafetyGuardPrecheck(): UseSafetyGuardPrecheckResult {
  const [checking, setChecking] = useState(false);
  const [alert, setAlert] = useState<SafetyAlertState>(EMPTY_SAFETY_ALERT);
  const [overrideToken, setOverrideTokenState] = useState<string | undefined>();

  // Ref so callers can read synchronously right after checkSafety() resolves
  const dietAdaptPayload = useRef<DietAdaptPayload | null>(null);

  // Allergen conflict payload — set when BLOCKED has an allergyConflict.
  // Lets the page show AllergyConflictModal instead of SafetyGuardBanner.
  const allergyConflictPayload = useRef<AllergyConflictPayload | null>(null);
  // Saved blocked alert so "Make the original" can restore the banner + PIN button.
  const blockedAlertRef = useRef<SafetyAlertState | null>(null);

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
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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
        dietAdaptPayload.current = null;
        allergyConflictPayload.current = null;
        return true;
      }

      // DIET_ADAPT: diet conflict — do NOT block here.
      // SafetyGuard hands this off to DietGuard to show the proper
      // action modal ("Let Chef Adapt It" / "Continue Anyway").
      // The caller reads dietAdaptPayload.current synchronously after checkSafety resolves.
      if (data.result === "DIET_ADAPT") {
        setAlert(EMPTY_SAFETY_ALERT);
        allergyConflictPayload.current = null;
        // Extract diet name from message ("Your request conflicts with your keto diet")
        const dietMatch = data.message.match(/your (\S+) diet/);
        const diet = dietMatch?.[1] ?? "your";
        dietAdaptPayload.current = {
          matchedTerms: data.blockedTerms ?? [],
          message: data.message,
          suggestion: data.suggestion,
          diet,
        };
        return true;
      }

      // BLOCKED with allergyConflict — intercept for AllergyConflictModal.
      // Store the conflict payload and the blocked banner state so the caller
      // can show the modal and optionally restore the banner for "Make original".
      if (data.result === "BLOCKED" && data.allergyConflict) {
        dietAdaptPayload.current = null;
        allergyConflictPayload.current = data.allergyConflict;
        blockedAlertRef.current = {
          show: true,
          result: "BLOCKED",
          blockedTerms: data.blockedTerms,
          blockedCategories: data.blockedCategories,
          ambiguousTerms: data.ambiguousTerms,
          message: data.message,
          suggestion: data.suggestion,
        };
        // Do NOT set the banner alert — AllergyConflictModal will appear instead
        return false;
      }

      // BLOCKED or AMBIGUOUS — show SafetyGuardBanner, stop generation
      dietAdaptPayload.current = null;
      allergyConflictPayload.current = null;
      setAlert({
        show: true,
        result: data.result as "SAFE" | "BLOCKED" | "AMBIGUOUS",
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
    allergyConflictPayload.current = null;
  }, []);

  /** Restores the SafetyGuardBanner in BLOCKED state so the user can enter the Safety PIN.
   *  Call this when the user chooses "Make the original" from AllergyConflictModal. */
  const restoreBlockedAlert = useCallback(() => {
    if (blockedAlertRef.current) {
      setAlert(blockedAlertRef.current);
      allergyConflictPayload.current = null;
      blockedAlertRef.current = null;
    }
  }, []);

  return {
    checking,
    alert,
    checkSafety,
    clearAlert,
    setAlert,
    setOverrideToken,
    overrideToken,
    hasActiveOverride: !!overrideToken,
    dietAdaptPayload,
    allergyConflictPayload,
    restoreBlockedAlert,
  };
}
