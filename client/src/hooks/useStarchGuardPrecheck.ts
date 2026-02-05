import { useState, useCallback } from "react";
import { useNutritionBudget, NutrientStatus } from "@/hooks/useNutritionBudget";
import { detectStarchyIngredients } from "@/utils/ingredientClassifier";

export interface StarchGuardAlertState {
  show: boolean;
  matchedTerms: string[];
  starchyStatus: NutrientStatus;
  message: string;
}

export const EMPTY_STARCH_ALERT: StarchGuardAlertState = {
  show: false,
  matchedTerms: [],
  starchyStatus: 'good',
  message: '',
};

export type StarchGuardDecision = 'pending' | 'order_something_else' | 'let_chef_pick';

interface UseStarchGuardPrecheckResult {
  checking: boolean;
  alert: StarchGuardAlertState;
  decision: StarchGuardDecision;
  checkStarch: (input: string | string[]) => boolean;
  clearAlert: () => void;
  setDecision: (decision: StarchGuardDecision) => void;
  isBlocked: boolean;
  canProceed: boolean;
}

export function useStarchGuardPrecheck(): UseStarchGuardPrecheckResult {
  const [checking, setChecking] = useState(false);
  const [alert, setAlert] = useState<StarchGuardAlertState>(EMPTY_STARCH_ALERT);
  const [decision, setDecisionState] = useState<StarchGuardDecision>('pending');
  
  const budget = useNutritionBudget();

  const checkStarch = useCallback((input: string | string[]): boolean => {
    setChecking(true);
    
    try {
      if (!budget.hasStarchyFibrousTargets) {
        setAlert(EMPTY_STARCH_ALERT);
        return true;
      }

      const starchyStatus = budget.status.starchyCarbs;
      
      if (starchyStatus !== 'exhausted' && starchyStatus !== 'over') {
        setAlert(EMPTY_STARCH_ALERT);
        return true;
      }

      const detection = detectStarchyIngredients(input);
      
      if (!detection.hasStarchy) {
        setAlert(EMPTY_STARCH_ALERT);
        return true;
      }

      const termsList = detection.matchedTerms.slice(0, 3).join(', ');
      const message = `Your starchy carbs are covered for today. You requested ${termsList}, but you've reached your limit.`;
      
      setAlert({
        show: true,
        matchedTerms: detection.matchedTerms,
        starchyStatus,
        message,
      });
      
      setDecisionState('pending');
      return false;
    } finally {
      setChecking(false);
    }
  }, [budget.hasStarchyFibrousTargets, budget.status.starchyCarbs]);

  const clearAlert = useCallback(() => {
    setAlert(EMPTY_STARCH_ALERT);
    setDecisionState('pending');
  }, []);

  const setDecision = useCallback((newDecision: StarchGuardDecision) => {
    setDecisionState(newDecision);
    if (newDecision !== 'pending') {
      setAlert(prev => ({ ...prev, show: false }));
    }
  }, []);

  const isBlocked = alert.show && decision === 'pending';
  const canProceed = !alert.show || decision === 'let_chef_pick';

  return {
    checking,
    alert,
    decision,
    checkStarch,
    clearAlert,
    setDecision,
    isBlocked,
    canProceed,
  };
}
