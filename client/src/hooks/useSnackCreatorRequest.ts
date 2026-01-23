import { useState, useRef } from "react";
import { apiUrl } from "@/lib/resolveApiBase";

export type DietType = 
  | 'anti-inflammatory'
  | 'diabetic'
  | 'glp1'
  | 'beachbody'
  | 'performance'
  | 'general-nutrition'
  | 'procare'
  | null;

export type BeachBodyPhase = 'lean' | 'carb-control' | 'maintenance' | 'sculpt';

interface Snack {
  id: string;
  name: string;
  title?: string;
  description?: string;
  ingredients: Array<{ name: string; quantity: string; unit: string }>;
  instructions?: string | string[];
  imageUrl?: string;
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
}

interface UseSnackCreatorRequestResult {
  generating: boolean;
  progress: number;
  error: string | null;
  generateSnack: (description: string, dietType?: DietType, dietPhase?: BeachBodyPhase, overrideToken?: string) => Promise<Snack | null>;
  cancel: () => void;
}

export function useSnackCreatorRequest(userId?: string): UseSnackCreatorRequestResult {
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

  const cancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    stopProgressTicker();
    setGenerating(false);
  };

  const generateSnack = async (
    description: string,
    dietType?: DietType,
    dietPhase?: BeachBodyPhase,
    overrideToken?: string
  ): Promise<Snack | null> => {
    setGenerating(true);
    setError(null);
    startProgressTicker();

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(apiUrl("/api/meals/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "snack-creator",
          mealType: "snack",
          input: description,
          userId,
          count: 1,
          dietType: dietType || null, // Pass diet type for guardrails
          dietPhase: dietPhase || null, // Pass phase for BeachBody
          overrideToken: overrideToken || null, // SafetyGuard override token
          safetyMode: overrideToken ? "CUSTOM_AUTHENTICATED" : "STRICT", // Required for override token to work
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to generate snack");
      }

      const data = await response.json();

      if (!data.success || !data.meals?.[0]) {
        throw new Error(data.error || "No snack found in response");
      }

      const generatedSnack = data.meals[0];

      const snack: Snack = {
        id: generatedSnack.id || `snack-${Date.now()}`,
        name: generatedSnack.name,
        title: generatedSnack.name,
        description: generatedSnack.description,
        ingredients: generatedSnack.ingredients || [],
        instructions: generatedSnack.instructions,
        imageUrl: generatedSnack.imageUrl,
        calories: generatedSnack.calories,
        protein: generatedSnack.protein,
        carbs: generatedSnack.carbs,
        fat: generatedSnack.fat,
        starchyCarbs: generatedSnack.starchyCarbs || 0,
        fibrousCarbs: generatedSnack.fibrousCarbs || 0,
        nutrition: {
          calories: generatedSnack.calories || 0,
          protein: generatedSnack.protein || 0,
          carbs: generatedSnack.carbs || 0,
          fat: generatedSnack.fat || 0,
          starchyCarbs: generatedSnack.starchyCarbs || 0,
          fibrousCarbs: generatedSnack.fibrousCarbs || 0,
        },
        medicalBadges: generatedSnack.medicalBadges || [],
      };

      stopProgressTicker();
      setGenerating(false);
      return snack;
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Snack Creator request cancelled");
        return null;
      }
      console.error("Snack Creator error:", err);
      setError(err.message || "Failed to generate snack");
      stopProgressTicker();
      setGenerating(false);
      return null;
    }
  };

  return {
    generating,
    progress,
    error,
    generateSnack,
    cancel,
  };
}
