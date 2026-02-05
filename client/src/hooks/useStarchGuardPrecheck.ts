import { useState, useCallback } from "react";
import { useNutritionBudget, NutrientStatus } from "@/hooks/useNutritionBudget";
import { detectStarchyIngredients } from "@/utils/ingredientClassifier";

export interface StarchGuardAlertState {
  show: boolean;
  matchedTerms: string[];
  starchyStatus: NutrientStatus;
  message: string;
  consumed: number;
  target: number;
}

export const EMPTY_STARCH_ALERT: StarchGuardAlertState = {
  show: false,
  matchedTerms: [],
  starchyStatus: 'good',
  message: '',
  consumed: 0,
  target: 0,
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
  starchStatus: NutrientStatus;
  starchyConsumed: number;
  starchyTarget: number;
  hasStarchyTargets: boolean;
}

export function useStarchGuardPrecheck(): UseStarchGuardPrecheckResult {
  const [checking, setChecking] = useState(false);
  const [alert, setAlert] = useState<StarchGuardAlertState>(EMPTY_STARCH_ALERT);
  const [decision, setDecisionState] = useState<StarchGuardDecision>('pending');
  
  const budget = useNutritionBudget();
  
  const starchyConsumed = budget.consumed.starchyCarbs;
  const starchyTarget = budget.targets.starchyCarbs_g;
  const starchStatus = budget.status.starchyCarbs;
  const hasStarchyTargets = budget.hasStarchyFibrousTargets && starchyTarget > 0;

  const checkStarch = useCallback((input: string | string[]): boolean => {
    setChecking(true);
    
    console.log('🥔 [StarchGuard] checkStarch called');
    console.log('🥔 [StarchGuard] Input:', input);
    console.log('🥔 [StarchGuard] Starchy consumed:', starchyConsumed, 'g');
    console.log('🥔 [StarchGuard] Starchy target:', starchyTarget, 'g');
    console.log('🥔 [StarchGuard] Starchy status:', starchStatus);
    console.log('🥔 [StarchGuard] Has starchy targets:', hasStarchyTargets);
    
    try {
      if (!hasStarchyTargets) {
        console.log('🥔 [StarchGuard] SKIP: No starchy carb targets set');
        setAlert(EMPTY_STARCH_ALERT);
        return true;
      }

      if (starchStatus !== 'exhausted' && starchStatus !== 'over') {
        console.log('🥔 [StarchGuard] ALLOW: Starchy status is', starchStatus, '(still have room)');
        setAlert(EMPTY_STARCH_ALERT);
        return true;
      }

      const detection = detectStarchyIngredients(input);
      console.log('🥔 [StarchGuard] Detection result:', detection);
      
      if (!detection.hasStarchy) {
        console.log('🥔 [StarchGuard] ALLOW: No starchy ingredients detected in request');
        setAlert(EMPTY_STARCH_ALERT);
        return true;
      }

      const termsList = detection.matchedTerms.slice(0, 3).join(', ');
      const message = `You've reached your daily starchy carb limit (${Math.round(starchyConsumed)}g of ${starchyTarget}g). You requested "${termsList}" which contains starchy carbs.`;
      
      console.log('🥔 [StarchGuard] BLOCK: Starchy carbs at limit and starchy food requested');
      
      setAlert({
        show: true,
        matchedTerms: detection.matchedTerms,
        starchyStatus: starchStatus,
        message,
        consumed: starchyConsumed,
        target: starchyTarget,
      });
      
      setDecisionState('pending');
      return false;
    } finally {
      setChecking(false);
    }
  }, [starchyConsumed, starchyTarget, starchStatus, hasStarchyTargets]);

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
    starchStatus,
    starchyConsumed,
    starchyTarget,
    hasStarchyTargets,
  };
}
