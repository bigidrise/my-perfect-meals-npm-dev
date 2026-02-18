import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTodayMacros } from "@/hooks/useTodayMacros";
import { getResolvedTargets } from "@/lib/macroResolver";

export type NutrientStatus = 'good' | 'low' | 'exhausted' | 'over';

export interface NutritionBudget {
  targets: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    starchyCarbs_g: number;
    fibrousCarbs_g: number;
  };
  consumed: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    starchyCarbs: number;
    fibrousCarbs: number;
  };
  remaining: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    starchyCarbs: number;
    fibrousCarbs: number;
  };
  status: {
    protein: NutrientStatus;
    starchyCarbs: NutrientStatus;
    fibrousCarbs: NutrientStatus;
  };
  hasTargets: boolean;
  hasStarchyFibrousTargets: boolean;
  isOverBudget: {
    calories: boolean;
    protein: boolean;
    carbs: boolean;
    fat: boolean;
    starchyCarbs: boolean;
    fibrousCarbs: boolean;
  };
  needsCoaching: boolean;
}

export function useNutritionBudget(): NutritionBudget {
  const { user } = useAuth();
  const todayMacros = useTodayMacros();

  return useMemo(() => {
    const resolved = getResolvedTargets(user?.id);

    const starchyTarget = resolved.starchyCarbs_g ?? resolved.carbDirective?.starchyCapG ?? 0;
    const fibrousTarget = resolved.fibrousCarbs_g ?? resolved.carbDirective?.fibrousFloorG ?? 0;

    const targets = {
      calories: resolved.calories ?? 0,
      protein_g: resolved.protein_g ?? 0,
      carbs_g: resolved.carbs_g ?? 0,
      fat_g: resolved.fat_g ?? 0,
      starchyCarbs_g: starchyTarget,
      fibrousCarbs_g: fibrousTarget,
    };

    const consumed = {
      calories: todayMacros.kcal ?? 0,
      protein: todayMacros.protein ?? 0,
      carbs: todayMacros.carbs ?? ((todayMacros.starchyCarbs ?? 0) + (todayMacros.fibrousCarbs ?? 0)),
      fat: todayMacros.fat ?? 0,
      starchyCarbs: todayMacros.starchyCarbs ?? 0,
      fibrousCarbs: todayMacros.fibrousCarbs ?? 0,
    };

    const remaining = {
      calories: Math.max(0, targets.calories - consumed.calories),
      protein: Math.max(0, targets.protein_g - consumed.protein),
      carbs: Math.max(0, targets.carbs_g - consumed.carbs),
      fat: Math.max(0, targets.fat_g - consumed.fat),
      starchyCarbs: Math.max(0, targets.starchyCarbs_g - consumed.starchyCarbs),
      fibrousCarbs: Math.max(0, targets.fibrousCarbs_g - consumed.fibrousCarbs),
    };

    const hasTargets = targets.protein_g > 0 || targets.carbs_g > 0 || targets.fat_g > 0;
    const hasStarchyFibrousTargets = targets.starchyCarbs_g > 0 || targets.fibrousCarbs_g > 0;

    const isOverBudget = {
      calories: consumed.calories > targets.calories && targets.calories > 0,
      protein: consumed.protein > targets.protein_g && targets.protein_g > 0,
      carbs: consumed.carbs > targets.carbs_g && targets.carbs_g > 0,
      fat: consumed.fat > targets.fat_g && targets.fat_g > 0,
      starchyCarbs: consumed.starchyCarbs > targets.starchyCarbs_g && targets.starchyCarbs_g > 0,
      fibrousCarbs: consumed.fibrousCarbs > targets.fibrousCarbs_g && targets.fibrousCarbs_g > 0,
    };

    const getStatus = (consumed: number, target: number): NutrientStatus => {
      if (target === 0) return 'good';
      const percentUsed = (consumed / target) * 100;
      if (consumed > target) return 'over';
      if (percentUsed >= 100) return 'exhausted';
      if (percentUsed >= 80) return 'low';
      return 'good';
    };

    const status = {
      protein: getStatus(consumed.protein, targets.protein_g),
      starchyCarbs: getStatus(consumed.starchyCarbs, targets.starchyCarbs_g),
      fibrousCarbs: getStatus(consumed.fibrousCarbs, targets.fibrousCarbs_g),
    };

    const needsCoaching = status.protein !== 'good' || 
                          status.starchyCarbs !== 'good' || 
                          status.fibrousCarbs !== 'good';

    return {
      targets,
      consumed,
      remaining,
      status,
      hasTargets,
      hasStarchyFibrousTargets,
      isOverBudget,
      needsCoaching,
    };
  }, [user?.id, todayMacros]);
}
