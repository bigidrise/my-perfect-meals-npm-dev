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

interface Meal {
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

interface UseCreateWithChefRequestResult {
  generating: boolean;
  progress: number;
  error: string | null;
  generateMeal: (description: string, mealType: "breakfast" | "lunch" | "dinner", dietType?: DietType, dietPhase?: BeachBodyPhase) => Promise<Meal | null>;
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

  const cancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    stopProgressTicker();
    setGenerating(false);
  };

  const generateMeal = async (
    description: string,
    mealType: "breakfast" | "lunch" | "dinner",
    dietType?: DietType,
    dietPhase?: BeachBodyPhase
  ): Promise<Meal | null> => {
    setGenerating(true);
    setError(null);
    startProgressTicker();

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(apiUrl("/api/meals/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "create-with-chef",
          mealType,
          input: description,
          userId,
          count: 1,
          dietType: dietType || null, // Pass diet type for guardrails
          dietPhase: dietPhase || null, // Pass phase for BeachBody
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to generate meal");
      }

      const data = await response.json();

      if (!data.success || !data.meals?.[0]) {
        throw new Error(data.error || "No meal found in response");
      }

      const generatedMeal = data.meals[0];

      const meal: Meal = {
        id: generatedMeal.id || `chef-${Date.now()}`,
        name: generatedMeal.name,
        title: generatedMeal.name,
        description: generatedMeal.description,
        ingredients: generatedMeal.ingredients || [],
        instructions: generatedMeal.instructions,
        imageUrl: generatedMeal.imageUrl,
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
