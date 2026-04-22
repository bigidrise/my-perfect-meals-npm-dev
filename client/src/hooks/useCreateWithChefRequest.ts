import { useState, useRef, useCallback } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import type { DiversityContext } from "@/lib/diversityContext";

export type DietType = 
  | 'anti-inflammatory'
  | 'liver-support'
  | 'diabetic'
  | 'glp1'
  | 'beachbody'
  | 'performance'
  | 'general-nutrition'
  | 'procare'
  | null;

export type BeachBodyPhase = 'lean' | 'carb-control' | 'maintenance' | 'sculpt';

export type BuilderMode = 'lifestyle' | 'targeted' | 'hybrid';

export interface StarchContext {
  strategy: 'one' | 'flex';
  existingMeals?: Array<{
    slot: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    hasStarch: boolean;
  }>;
  forceStarch?: boolean;
  forceFiberBased?: boolean;
}

interface Meal {
  id: string;
  name: string;
  title?: string;
  description?: string;
  ingredients: Array<{ name: string; quantity: string; unit: string }>;
  instructions?: string | string[];
  imageUrl?: string | null;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  starchyCarbs?: number;
  fibrousCarbs?: number;
  nutrition?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    starchyCarbs?: number;
    fibrousCarbs?: number;
  };
  medicalBadges?: string[];
  substitutionNotes?: string[];
}

interface SafetyOptions {
  safetyMode?: 'STRICT' | 'CUSTOM' | 'CUSTOM_AUTHENTICATED';
  overrideToken?: string;
}

export interface ExplicitOverride {
  item: string;
  confirmed: boolean;
}

export interface RemainingMacros {
  protein?: number;
  carbs?: number;
  fat?: number;
  calories?: number;
}

interface UseCreateWithChefRequestResult {
  generating: boolean;
  progress: number;
  error: string | null;
  generateMeal: (description: string, mealType: "breakfast" | "lunch" | "dinner" | "meal4" | "meal5" | "meal6", dietType?: DietType, dietPhase?: BeachBodyPhase, starchContext?: StarchContext, safetyOptions?: SafetyOptions, strictMode?: boolean, explicitOverride?: ExplicitOverride, userDietOverride?: boolean, diversityContext?: DiversityContext, remainingMacros?: RemainingMacros, builderMode?: BuilderMode) => Promise<Meal | null>;
  cancel: () => void;
}

export function useCreateWithChefRequest(userId?: string): UseCreateWithChefRequestResult {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const tickerRef = useRef<number | null>(null);

  const startProgressTicker = () => {
    setProgress(0);
    tickerRef.current = window.setInterval(() => {
      setProgress((prev) => Math.min(prev + Math.random() * 8, 90));
    }, 500);
  };

  const stopProgressTicker = () => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    setProgress(100);
  };

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    setProgress(100);
    setGenerating(false);
  }, []);

  const generateMeal = async (
    description: string,
    mealType: "breakfast" | "lunch" | "dinner" | "meal4" | "meal5" | "meal6",
    dietType?: DietType,
    dietPhase?: BeachBodyPhase,
    starchContext?: StarchContext,
    safetyOptions?: SafetyOptions,
    strictMode?: boolean,
    explicitOverride?: ExplicitOverride,
    userDietOverride?: boolean,
    diversityContext?: DiversityContext,
    remainingMacros?: RemainingMacros,
    builderMode?: BuilderMode
  ): Promise<Meal | null> => {
    setGenerating(true);
    setError(null);
    startProgressTicker();

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(apiUrl("/api/meals/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          type: "create-with-chef",
          mealType,
          input: description,
          userId,
          count: 1,
          dietType: dietType || null,
          dietPhase: dietPhase || null,
          remainingMacros: remainingMacros || null,
          builderMode: builderMode || null,
          starchContext: starchContext || null,
          diversityContext: diversityContext || null,
          safetyMode: safetyOptions?.safetyMode || "STRICT",
          overrideToken: safetyOptions?.overrideToken,
          strictMode: strictMode === true,
          skipImage: true,
          explicitOverride: explicitOverride || null,
          userDietOverride: userDietOverride === true,
        }),
        signal: abortControllerRef.current.signal,
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        if (data.safetyBlocked && data.error) {
          throw new Error(data.error);
        }
        throw new Error(data.error || data.message || "Failed to generate meal");
      }

      if (!data.meals?.[0]) {
        throw new Error("No meal found in response");
      }

      const generatedMeal = data.meals[0];
      const mealId = generatedMeal.id || `chef-${Date.now()}`;

      const meal: Meal = {
        id: mealId,
        name: generatedMeal.name,
        title: generatedMeal.name,
        description: generatedMeal.description,
        ingredients: generatedMeal.ingredients || [],
        instructions: generatedMeal.instructions,
        imageUrl: null,
        calories: generatedMeal.calories,
        protein: generatedMeal.protein,
        carbs: generatedMeal.carbs,
        fat: generatedMeal.fat,
        starchyCarbs: generatedMeal.starchyCarbs || 0,
        fibrousCarbs: generatedMeal.fibrousCarbs || 0,
        nutrition: {
          calories: generatedMeal.calories || 0,
          protein: generatedMeal.protein || 0,
          carbs: generatedMeal.carbs || 0,
          fat: generatedMeal.fat || 0,
          starchyCarbs: generatedMeal.starchyCarbs || 0,
          fibrousCarbs: generatedMeal.fibrousCarbs || 0,
        },
        medicalBadges: generatedMeal.medicalBadges || [],
        substitutionNotes: generatedMeal.substitutionNotes || undefined,
        dietClassification: generatedMeal.dietClassification || null,
      };

      stopProgressTicker();
      setGenerating(false);

      return meal;
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Create With Chef request cancelled");
        return null;
      }
      console.error("Create With Chef error:", err);
      setError(err.message || "Failed to generate meal");
      stopProgressTicker();
      setGenerating(false);
      return null;
    }
  };

  return {
    generating,
    progress,
    error,
    generateMeal,
    cancel,
  };
}
