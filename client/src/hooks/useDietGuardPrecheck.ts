import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  detectDietConflicts,
  normalizeDietPreference,
  SupportedDiet,
} from "@/utils/dietGuardClassifier";

export type SupportedDiet_ = SupportedDiet;

export interface DietGuardAlertState {
  show: boolean;
  matchedTerms: string[];
  message: string;
  diet: SupportedDiet | null;
}

export const EMPTY_DIET_ALERT: DietGuardAlertState = {
  show: false,
  matchedTerms: [],
  message: "",
  diet: null,
};

// Advisory decisions — DietGuard never blocks permanently
export type DietGuardDecision = "pending" | "pick_something_else" | "let_chef_adapt";

interface UseDietGuardPrecheckResult {
  checking: boolean;
  alert: DietGuardAlertState;
  decision: DietGuardDecision;
  checkDiet: (input: string | string[]) => boolean;
  clearAlert: () => void;
  setDecision: (decision: DietGuardDecision) => void;
  triggerAlert: (matchedTerms: string[], message: string) => void;
  activeDiet: SupportedDiet | null;
  shouldShowIntercept: boolean;
  canProceed: boolean;
}

export function useDietGuardPrecheck(): UseDietGuardPrecheckResult {
  const [checking, setChecking] = useState(false);
  const [alert, setAlert] = useState<DietGuardAlertState>(EMPTY_DIET_ALERT);
  const [decision, setDecisionState] = useState<DietGuardDecision>("pending");

  const { user } = useAuth();
  const activeDiet = normalizeDietPreference(user?.dietaryRestrictions);

  const checkDiet = useCallback(
    (input: string | string[]): boolean => {
      if (!activeDiet) {
        setAlert(EMPTY_DIET_ALERT);
        return true;
      }

      setChecking(true);
      try {
        const result = detectDietConflicts(input, activeDiet);

        if (!result.hasConflict) {
          setAlert(EMPTY_DIET_ALERT);
          return true;
        }

        const termsList = result.matchedTerms.slice(0, 3).join(", ");
        const message = `You requested "${termsList}" which isn't typically part of a ${activeDiet} diet.`;

        setAlert({
          show: true,
          matchedTerms: result.matchedTerms,
          message,
          diet: activeDiet,
        });

        setDecisionState("pending");
        return false;
      } finally {
        setChecking(false);
      }
    },
    [activeDiet],
  );

  // Manual trigger for post-generation Scenario B fallback
  const triggerAlert = useCallback(
    (matchedTerms: string[], message: string) => {
      if (!activeDiet) return;
      setAlert({ show: true, matchedTerms, message, diet: activeDiet });
      setDecisionState("pending");
    },
    [activeDiet],
  );

  const clearAlert = useCallback(() => {
    setAlert(EMPTY_DIET_ALERT);
    setDecisionState("pending");
  }, []);

  const setDecision = useCallback((newDecision: DietGuardDecision) => {
    setDecisionState(newDecision);
    if (newDecision !== "pending") {
      setAlert((prev) => ({ ...prev, show: false }));
    }
  }, []);

  // Advisory flags — DietGuard never hard-blocks the user
  const shouldShowIntercept = alert.show && decision === "pending";
  const canProceed = !alert.show || decision === "let_chef_adapt";

  return {
    checking,
    alert,
    decision,
    checkDiet,
    clearAlert,
    setDecision,
    triggerAlert,
    activeDiet,
    shouldShowIntercept,
    canProceed,
  };
}
