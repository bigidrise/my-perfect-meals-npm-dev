import { useState, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getResolvedTargets } from "@/lib/macroResolver";
import { detectStarchyIngredients } from "@/utils/ingredientClassifier";
import { getDayStarchStatus } from "@/utils/starchMealClassifier";

export type NutrientStatus = 'good' | 'low' | 'exhausted' | 'over';

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

function getTodayMealsFromDraft(): any[] {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('mpm_board_draft_'));
    if (keys.length === 0) return [];
    
    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];
    
    for (const key of keys) {
      if (key.endsWith('_meta')) continue;
      
      const draft = localStorage.getItem(key);
      if (!draft) continue;
      
      const board = JSON.parse(draft);
      if (!board.days) continue;
      
      const dayData = board.days[todayISO];
      if (!dayData) continue;
      
      const meals = [
        ...(dayData.breakfast || []),
        ...(dayData.lunch || []),
        ...(dayData.dinner || []),
        ...(dayData.snacks || []),
      ];
      
      if (meals.length > 0) {
        console.log('🥔 [StarchGuard] Found', meals.length, 'meals for today from draft');
        return meals;
      }
    }
    
    return [];
  } catch (e) {
    console.warn('🥔 [StarchGuard] Error reading draft:', e);
    return [];
  }
}

export function useStarchGuardPrecheck(): UseStarchGuardPrecheckResult {
  const [checking, setChecking] = useState(false);
  const [alert, setAlert] = useState<StarchGuardAlertState>(EMPTY_STARCH_ALERT);
  const [decision, setDecisionState] = useState<StarchGuardDecision>('pending');
  
  const { user } = useAuth();
  
  const starchConfig = useMemo(() => {
    const resolved = getResolvedTargets(user?.id);
    const strategy = resolved.starchStrategy || 'one';
    const maxSlots = strategy === 'flex' ? 2 : 1;
    return { strategy, maxSlots };
  }, [user?.id]);

  const checkStarch = useCallback((input: string | string[]): boolean => {
    setChecking(true);
    
    console.log('🥔 [StarchGuard] checkStarch called with:', input);
    
    try {
      const todayMeals = getTodayMealsFromDraft();
      const slotStatus = getDayStarchStatus(todayMeals, starchConfig.maxSlots);
      
      console.log('🥔 [StarchGuard] Slot status:', {
        isUsed: slotStatus.isUsed,
        starchMealCount: slotStatus.starchMealCount,
        slotsRemaining: slotStatus.slotsRemaining,
        maxSlots: slotStatus.maxSlots,
      });
      
      if (!slotStatus.isUsed) {
        console.log('🥔 [StarchGuard] ALLOW: Starch slots still available');
        setAlert(EMPTY_STARCH_ALERT);
        return true;
      }

      const detection = detectStarchyIngredients(input);
      console.log('🥔 [StarchGuard] Detection:', detection);
      
      if (!detection.hasStarchy) {
        console.log('🥔 [StarchGuard] ALLOW: No starchy ingredients detected');
        setAlert(EMPTY_STARCH_ALERT);
        return true;
      }

      const termsList = detection.matchedTerms.slice(0, 3).join(', ');
      const message = `Your starch meal${starchConfig.maxSlots > 1 ? 's are' : ' is'} covered for today. You requested ${termsList}, but you've already used your allocation.`;
      
      console.log('🥔 [StarchGuard] BLOCK: Starch slots exhausted and starchy request detected');
      
      setAlert({
        show: true,
        matchedTerms: detection.matchedTerms,
        starchyStatus: 'exhausted',
        message,
      });
      
      setDecisionState('pending');
      return false;
    } finally {
      setChecking(false);
    }
  }, [starchConfig.maxSlots]);

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
