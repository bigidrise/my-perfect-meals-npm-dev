/**
 * 🔒 LOCKED COMPONENT - DO NOT MODIFY UI STRUCTURE
 *
 * This file is PROTECTED under the Meal Picker Lockdown Protocol (November 24, 2025)
 * See LOCKDOWN.md for complete guidelines before making ANY changes.
 *
 * ❌ PROHIBITED CHANGES:
 * - Adding new UI sections (banners, displays, input fields)
 * - Modifying modal layout or structure
 * - Changing meal grid rendering
 * - Adding extra state or complexity
 *
 * ✅ ALLOWED (with approval):
 * - Bug fixes that don't alter UI structure
 * - Performance optimizations
 * - Backend API updates
 *
 * REASON FOR LOCK: This picker has the CORRECT clean structure that AI Meal Creator
 * should match. Any changes here risk breaking the proven working layout.
 *
 * LAST LOCKED: November 24, 2025
 * LOCKED BY: User explicit request
 */

import React, { useState, useRef, useEffect } from "react";
import { apiUrl } from '@/lib/resolveApiBase';
import { X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import PreparationModal, {
  normalizeIngredientName,
} from "@/components/PreparationModal";
import { useMacroTargeting } from "@/hooks/useMacroTargeting";
import { MacroTargetingControls } from "@/components/macro-targeting/MacroTargetingControls";
import {
  AI_PREMADE_BREAKFAST_MEALS,
  getBreakfastMealsByCategory,
  type BreakfastCategory,
} from "@/data/aiPremadeBreakfast";
import {
  AI_PREMADE_LUNCH_MEALS,
  getLunchMealsByCategory,
  LUNCH_CATEGORY_DISPLAY_NAMES,
  type LunchCategory,
} from "@/data/aiPremadeLunch";
import {
  AI_PREMADE_DINNER_MEALS,
  getDinnerMealsByCategory,
  DINNER_CATEGORY_DISPLAY_NAMES,
  type DinnerCategory,
} from "@/data/aiPremadeDinner";
import { DIABETIC_BREAKFAST_MEALS } from "@/data/diabeticPremadeBreakfast";
import { DIABETIC_LUNCH_MEALS } from "@/data/diabeticPremadeLunch";
import { DIABETIC_DINNER_MEALS } from "@/data/diabeticPremadeDinner";
import { DIABETIC_SNACK_CATEGORIES } from "@/data/diabeticPremadeSnacks";
import {
  proteinOnlyOptions,
  proteinFibrousOptions,
  proteinFibrousStarchyOptions,
} from "@/data/competitionMealCatalog";

interface MealPremadePickerProps {
  open: boolean;
  onClose: () => void;
  onMealSelect?: (meal: any) => void;
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
  dietType?:
    | "weekly"
    | "diabetic"
    | "glp1"
    | "anti-inflammatory"
    | "competition";
  showMacroTargeting?: boolean;
}

// Map category names to display names
const categoryDisplayNames: Record<BreakfastCategory, string> = {
  "all-protein": "All Protein",
  "protein-carb": "Protein + Carb",
  "egg-based": "Egg-Based Meals",
};

// Build diabetic breakfast premades (simple title-only format)
const diabeticBreakfastPremades = {
  "All Protein": DIABETIC_BREAKFAST_MEALS["all-protein"].map((meal, idx) => ({
    id: `diabetic-bp-${idx}`,
    name: meal.title,
    ingredients: [],
  })),
  "Protein + Carb": DIABETIC_BREAKFAST_MEALS["protein-carb"].map(
    (meal, idx) => ({
      id: `diabetic-pc-${idx}`,
      name: meal.title,
      ingredients: [],
    }),
  ),
  "Egg-Based Meals": DIABETIC_BREAKFAST_MEALS["egg-based"].map((meal, idx) => ({
    id: `diabetic-eb-${idx}`,
    name: meal.title,
    ingredients: [],
  })),
};

// Build diabetic lunch premades (simple title-only format)
const diabeticLunchPremades = {
  "Lean Plates": DIABETIC_LUNCH_MEALS["lean-plates"].map((meal, idx) => ({
    id: `diabetic-l1-${idx}`,
    name: meal.title,
    ingredients: [],
  })),
  "Protein + Carb Bowls": DIABETIC_LUNCH_MEALS[
    "satisfying-protein-carb-bowls"
  ].map((meal, idx) => ({
    id: `diabetic-l2-${idx}`,
    name: meal.title,
    ingredients: [],
  })),
  "High Protein Plates": DIABETIC_LUNCH_MEALS["high-protein-plates"].map(
    (meal, idx) => ({
      id: `diabetic-l3-${idx}`,
      name: meal.title,
      ingredients: [],
    }),
  ),
  "Protein + Veggie Plates": DIABETIC_LUNCH_MEALS[
    "simple-protein-veggie-plates"
  ].map((meal, idx) => ({
    id: `diabetic-l4-${idx}`,
    name: meal.title,
    ingredients: [],
  })),
  "One-Pan Meals": DIABETIC_LUNCH_MEALS["one-pan-meals"].map((meal, idx) => ({
    id: `diabetic-l5-${idx}`,
    name: meal.title,
    ingredients: [],
  })),
  "Smart Plate Dinners": DIABETIC_LUNCH_MEALS["smart-plate-dinners"].map(
    (meal, idx) => ({
      id: `diabetic-l6-${idx}`,
      name: meal.title,
      ingredients: [],
    }),
  ),
};

// Build diabetic snack premades (simple title-only format)
const diabeticSnackPremades = {
  "Sweet Treats": DIABETIC_SNACK_CATEGORIES[0].items.map((snack, idx) => ({
    id: `diabetic-snack-sweet-${idx}`,
    name: snack,
    ingredients: [],
  })),
  "Savory & Crunchy": DIABETIC_SNACK_CATEGORIES[1].items.map((snack, idx) => ({
    id: `diabetic-snack-savory-${idx}`,
    name: snack,
    ingredients: [],
  })),
  "Light & Gentle": DIABETIC_SNACK_CATEGORIES[2].items.map((snack, idx) => ({
    id: `diabetic-snack-light-${idx}`,
    name: snack,
    ingredients: [],
  })),
  "Protein & Energy": DIABETIC_SNACK_CATEGORIES[3].items.map((snack, idx) => ({
    id: `diabetic-snack-protein-${idx}`,
    name: snack,
    ingredients: [],
  })),
  Drinkables: DIABETIC_SNACK_CATEGORIES[4].items.map((snack, idx) => ({
    id: `diabetic-snack-drink-${idx}`,
    name: snack,
    ingredients: [],
  })),
  "Dessert Bites": DIABETIC_SNACK_CATEGORIES[5].items.map((snack, idx) => ({
    id: `diabetic-snack-dessert-${idx}`,
    name: snack,
    ingredients: [],
  })),
};

// Build diabetic dinner premades (simple title-only format)
const diabeticDinnerPremades = {
  "Lean Protein Plates": DIABETIC_DINNER_MEALS["lean-protein-plates"].map(
    (meal, idx) => ({
      id: `diabetic-d1-${idx}`,
      name: meal.title,
      ingredients: [],
    }),
  ),
  "Protein + Carb Bowls": DIABETIC_DINNER_MEALS["protein-carb-bowls"].map(
    (meal, idx) => ({
      id: `diabetic-d2-${idx}`,
      name: meal.title,
      ingredients: [],
    }),
  ),
  "High Protein Plates": DIABETIC_DINNER_MEALS["high-protein-plates"].map(
    (meal, idx) => ({
      id: `diabetic-d3-${idx}`,
      name: meal.title,
      ingredients: [],
    }),
  ),
  "Protein + Veggie": DIABETIC_DINNER_MEALS["simple-protein-veggie"].map(
    (meal, idx) => ({
      id: `diabetic-d4-${idx}`,
      name: meal.title,
      ingredients: [],
    }),
  ),
  "One-Pan Meals": DIABETIC_DINNER_MEALS["one-pan-meals"].map((meal, idx) => ({
    id: `diabetic-d5-${idx}`,
    name: meal.title,
    ingredients: [],
  })),
  "Smart Plate Dinners": DIABETIC_DINNER_MEALS["smart-plate-dinners"].map(
    (meal, idx) => ({
      id: `diabetic-d6-${idx}`,
      name: meal.title,
      ingredients: [],
    }),
  ),
};

// Build competition premades (macro-based categories, not meal times)
const competitionPremades = {
  "Protein Only (30g)": proteinOnlyOptions.map((meal) => ({
    id: meal.id,
    name: meal.title,
    ingredients: [{ name: meal.ingredient, qty: 1, unit: "serving" }],
  })),
  "Protein + Fibrous (30g + 100g)": proteinFibrousOptions.map((meal) => ({
    id: meal.id,
    name: meal.title,
    ingredients: [{ name: meal.ingredient, qty: 1, unit: "serving" }],
  })),
  "Protein + Fibrous + Starchy (30g + 100g + 25g)":
    proteinFibrousStarchyOptions.map((meal) => ({
      id: meal.id,
      name: meal.title,
      ingredients: [{ name: meal.ingredient, qty: 1, unit: "serving" }],
    })),
};

// Build breakfast premades from AI data with actual ingredients
const breakfastPremades = {
  "All Protein": getBreakfastMealsByCategory("all-protein").map((meal) => ({
    id: meal.id,
    name: meal.name,
    defaultCookingMethod: meal.defaultCookingMethod,
    actualIngredients: meal.ingredients,
    ingredients: meal.ingredients.map((ing) => ({
      item: ing.item,
      amount: `${ing.quantity} ${ing.unit}`,
      preparation: meal.defaultCookingMethod || "as preferred",
    })),
  })),
  "Protein + Carb": getBreakfastMealsByCategory("protein-carb").map((meal) => ({
    id: meal.id,
    name: meal.name,
    defaultCookingMethod: meal.defaultCookingMethod,
    actualIngredients: meal.ingredients,
    ingredients: meal.ingredients.map((ing) => ({
      item: ing.item,
      amount: `${ing.quantity} ${ing.unit}`,
      preparation: meal.defaultCookingMethod || "as preferred",
    })),
  })),
  "Egg-Based Meals": getBreakfastMealsByCategory("egg-based").map((meal) => ({
    id: meal.id,
    name: meal.name,
    defaultCookingMethod: meal.defaultCookingMethod,
    actualIngredients: meal.ingredients,
    ingredients: meal.ingredients.map((ing) => ({
      item: ing.item,
      amount: `${ing.quantity} ${ing.unit}`,
      preparation: meal.defaultCookingMethod || "as preferred",
    })),
  })),
};

// Lunch premade meals organized by category
const lunchPremades = {
  "Lean Plates": getLunchMealsByCategory("lean-plates").map((meal) => ({
    id: meal.id,
    name: meal.name,
    defaultCookingMethod: meal.defaultCookingMethod,
    actualIngredients: meal.ingredients,
    ingredients: meal.ingredients.map((ing) => ({
      item: ing.item,
      amount: `${ing.quantity} ${ing.unit}`,
      preparation: meal.defaultCookingMethod || "as preferred",
    })),
  })),
  "Protein + Carb Bowls": getLunchMealsByCategory(
    "satisfying-protein-carb-bowls",
  ).map((meal) => ({
    id: meal.id,
    name: meal.name,
    defaultCookingMethod: meal.defaultCookingMethod,
    actualIngredients: meal.ingredients,
    ingredients: meal.ingredients.map((ing) => ({
      item: ing.item,
      amount: `${ing.quantity} ${ing.unit}`,
      preparation: meal.defaultCookingMethod || "as preferred",
    })),
  })),
  "High Protein Plates": getLunchMealsByCategory("high-protein-plates").map(
    (meal) => ({
      id: meal.id,
      name: meal.name,
      defaultCookingMethod: meal.defaultCookingMethod,
      actualIngredients: meal.ingredients,
      ingredients: meal.ingredients.map((ing) => ({
        item: ing.item,
        amount: `${ing.quantity} ${ing.unit}`,
        preparation: meal.defaultCookingMethod || "as preferred",
      })),
    }),
  ),
  "Protein + Veggie Plates": getLunchMealsByCategory(
    "simple-protein-veggie-plates",
  ).map((meal) => ({
    id: meal.id,
    name: meal.name,
    defaultCookingMethod: meal.defaultCookingMethod,
    actualIngredients: meal.ingredients,
    ingredients: meal.ingredients.map((ing) => ({
      item: ing.item,
      amount: `${ing.quantity} ${ing.unit}`,
      preparation: meal.defaultCookingMethod || "as preferred",
    })),
  })),
  "One-Pan Meals": getLunchMealsByCategory("one-pan-meals").map((meal) => ({
    id: meal.id,
    name: meal.name,
    defaultCookingMethod: meal.defaultCookingMethod,
    actualIngredients: meal.ingredients,
    ingredients: meal.ingredients.map((ing) => ({
      item: ing.item,
      amount: `${ing.quantity} ${ing.unit}`,
      preparation: meal.defaultCookingMethod || "as preferred",
    })),
  })),
  "Smart Plate Lunches": getLunchMealsByCategory("smart-plate-dinners").map(
    (meal) => ({
      id: meal.id,
      name: meal.name,
      defaultCookingMethod: meal.defaultCookingMethod,
      actualIngredients: meal.ingredients,
      ingredients: meal.ingredients.map((ing) => ({
        item: ing.item,
        amount: `${ing.quantity} ${ing.unit}`,
        preparation: meal.defaultCookingMethod || "as preferred",
      })),
    }),
  ),
};

// Dinner premade meals organized by category
const dinnerPremades = {
  "Lean Protein Plates": getDinnerMealsByCategory("lean-protein-plates").map(
    (meal) => ({
      id: meal.id,
      name: meal.name,
      defaultCookingMethod: meal.defaultCookingMethod,
      actualIngredients: meal.ingredients,
      ingredients: meal.ingredients.map((ing) => ({
        item: ing.item,
        amount: `${ing.quantity} ${ing.unit}`,
        preparation: meal.defaultCookingMethod || "as preferred",
      })),
    }),
  ),
  "Protein + Carb Bowls": getDinnerMealsByCategory("protein-carb-bowls").map(
    (meal) => ({
      id: meal.id,
      name: meal.name,
      defaultCookingMethod: meal.defaultCookingMethod,
      actualIngredients: meal.ingredients,
      ingredients: meal.ingredients.map((ing) => ({
        item: ing.item,
        amount: `${ing.quantity} ${ing.unit}`,
        preparation: meal.defaultCookingMethod || "as preferred",
      })),
    }),
  ),
  "High Protein Plates": getDinnerMealsByCategory("high-protein-plates").map(
    (meal) => ({
      id: meal.id,
      name: meal.name,
      defaultCookingMethod: meal.defaultCookingMethod,
      actualIngredients: meal.ingredients,
      ingredients: meal.ingredients.map((ing) => ({
        item: ing.item,
        amount: `${ing.quantity} ${ing.unit}`,
        preparation: meal.defaultCookingMethod || "as preferred",
      })),
    }),
  ),
  "Protein + Veggie Plates": getDinnerMealsByCategory(
    "simple-protein-veggie",
  ).map((meal) => ({
    id: meal.id,
    name: meal.name,
    defaultCookingMethod: meal.defaultCookingMethod,
    actualIngredients: meal.ingredients,
    ingredients: meal.ingredients.map((ing) => ({
      item: ing.item,
      amount: `${ing.quantity} ${ing.unit}`,
      preparation: meal.defaultCookingMethod || "as preferred",
    })),
  })),
  "One-Pan Meals": getDinnerMealsByCategory("one-pan-meals").map((meal) => ({
    id: meal.id,
    name: meal.name,
    defaultCookingMethod: meal.defaultCookingMethod,
    actualIngredients: meal.ingredients,
    ingredients: meal.ingredients.map((ing) => ({
      item: ing.item,
      amount: `${ing.quantity} ${ing.unit}`,
      preparation: meal.defaultCookingMethod || "as preferred",
    })),
  })),
  "Smart Plate Dinners": getDinnerMealsByCategory("smart-plate-dinners").map(
    (meal) => ({
      id: meal.id,
      name: meal.name,
      defaultCookingMethod: meal.defaultCookingMethod,
      actualIngredients: meal.ingredients,
      ingredients: meal.ingredients.map((ing) => ({
        item: ing.item,
        amount: `${ing.quantity} ${ing.unit}`,
        preparation: meal.defaultCookingMethod || "as preferred",
      })),
    }),
  ),
};

export default function MealPremadePicker({
  open,
  onClose,
  onMealSelect,
  mealType = "breakfast",
  dietType = "weekly",
  showMacroTargeting = false,
}: MealPremadePickerProps) {
  const { user } = useAuth();
  const userId = user?.id?.toString() || "";
  
  // Determine which premade set to use based on meal type and diet type
  // Competition mode uses macro-based categories (same data for all meal slots)
  const premadeData =
    dietType === "competition"
      ? competitionPremades
      : mealType === "breakfast"
        ? dietType === "diabetic"
          ? diabeticBreakfastPremades
          : breakfastPremades
        : mealType === "lunch"
          ? dietType === "diabetic"
            ? diabeticLunchPremades
            : lunchPremades
          : mealType === "snack"
            ? diabeticSnackPremades
            : dietType === "diabetic"
              ? diabeticDinnerPremades
              : dinnerPremades;

  const [activeCategory, setActiveCategory] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [prepModalOpen, setPrepModalOpen] = useState(false);
  const [currentIngredient, setCurrentIngredient] = useState("");
  const [pendingMeal, setPendingMeal] = useState<any>(null);
  const [pendingCategory, setPendingCategory] = useState<string>("");
  const [cookingStyles, setCookingStyles] = useState<Record<string, string>>(
    {},
  );
  const [progress, setProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const tickerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  // Macro targeting for trainer features
  const macroTargetingState = useMacroTargeting(
    "macroTargets::trainer::premadePicker",
  );

  const startProgressTicker = () => {
    if (tickerRef.current) return;
    setProgress(0);
    tickerRef.current = window.setInterval(() => {
      setProgress((p) => {
        if (p < 90) {
          const next = p + Math.max(1, Math.floor((90 - p) * 0.07));
          return Math.min(next, 90);
        }
        return p;
      });
    }, 150);
  };

  // Shared cleanup routine for all cancellation paths
  const cleanupGeneration = () => {
    // Abort ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Stop and reset progress ticker
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }

    // Reset all state
    setGenerating(false);
    setProgress(0);
    setPendingMeal(null);
    setPendingCategory("");
    setCookingStyles({});
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupGeneration();
    };
  }, []);

  // List of ingredients that need cooking style selection (FULL LIST from MealIngredientPicker)
  const NEEDS_PREP = [
    // Eggs
    "Eggs",
    "Egg Whites",
    "Whole Eggs",

    // Steaks
    "Steak",
    "Ribeye",
    "Ribeye Steak",
    "Sirloin Steak",
    "Top Sirloin",
    "Filet Mignon",
    "New York Strip",
    "NY Strip",
    "Strip Steak",
    "Porterhouse",
    "Porterhouse Steak",
    "T-Bone",
    "T-Bone Steak",
    "TBone Steak",
    "Skirt Steak",
    "Flank Steak",
    "Flat Iron Steak",
    "Tri-Tip",
    "Tri-Tip Steak",
    "Hanger Steak",
    "Kobe Steak",
    "Kobe Beef",
    "Wagyu Steak",
    "Wagyu Beef",

    // Chicken (base + variations)
    "Chicken",
    "Chicken Breast",
    "Chicken Thighs",
    "Chicken Sausage",
    "Ground Chicken",

    // Turkey (base + variations)
    "Turkey",
    "Turkey Breast",
    "Ground Turkey",
    "Turkey Sausage",

    // Fish
    "Salmon",
    "Tilapia",
    "Cod",
    "Tuna",
    "Tuna Steak",
    "Halibut",
    "Mahi Mahi",
    "Trout",
    "Sardines",
    "Anchovies",
    "Catfish",
    "Sea Bass",
    "Red Snapper",
    "Flounder",
    "Orange Roughy",
    "Sole",

    // Potatoes (ALL PLURAL)
    "Potatoes",
    "Red Potatoes",
    "Sweet Potatoes",
    "Yams",

    // Rice
    "Rice",
    "White Rice",
    "Brown Rice",
    "Jasmine Rice",
    "Basmati Rice",
    "Wild Rice",

    // Vegetables
    "Broccoli",
    "Asparagus",
    "Green Beans",
    "Mixed Vegetables",
    "Cauliflower",
    "Brussels Sprouts",
    "Kale",
    "Spinach",
    "Carrots",
    "Celery",
    "Cucumber",

    // Salads
    "Lettuce",
    "Romaine Lettuce",
    "Spring Mix",
  ];

  // Set initial category when modal opens or meal type changes
  React.useEffect(() => {
    if (open) {
      const firstCategory = Object.keys(premadeData)[0];
      if (firstCategory) {
        setActiveCategory(firstCategory);
      }
    }
  }, [open, mealType]);

  const handleSelectPremade = (meal: any, category: string) => {
    // 🔥 DIABETIC/GLP-1/ANTI-INFLAMMATORY/COMPETITION: Title-only meals ALWAYS need prep modal
    const isMedicalDiet =
      dietType === "diabetic" ||
      dietType === "glp1" ||
      dietType === "anti-inflammatory" ||
      dietType === "competition";
    const hasMealIngredients =
      meal.actualIngredients &&
      Array.isArray(meal.actualIngredients) &&
      meal.actualIngredients.length > 0;

    // Check meal ingredients for items that need prep selection
    let needsPrepIngredient: string | undefined;

    // First check the actual ingredients array if it exists
    if (hasMealIngredients) {
      for (const ing of meal.actualIngredients) {
        const ingredientName = ing.item || "";
        // 🔥 Use normalization to match ingredient
        const normalizedName = normalizeIngredientName(ingredientName);
        const match = NEEDS_PREP.find(
          (prep) => normalizeIngredientName(prep) === normalizedName,
        );
        if (match) {
          needsPrepIngredient = ingredientName;
          break;
        }
      }
    }

    // For medical diets OR fallback: check meal name to detect main ingredient
    if (!needsPrepIngredient || isMedicalDiet) {
      const mealNameLower = meal.name.toLowerCase();
      const foundInName = NEEDS_PREP.find((ing) => {
        const normalizedPrep = normalizeIngredientName(ing);
        return mealNameLower.includes(normalizedPrep.toLowerCase());
      });

      // For medical diets, prefer the name-based ingredient
      if (isMedicalDiet && foundInName) {
        needsPrepIngredient = foundInName;
      } else if (!needsPrepIngredient) {
        needsPrepIngredient = foundInName;
      }
    }

    if (needsPrepIngredient) {
      // Show prep modal first
      setPendingMeal(meal);
      setPendingCategory(category);
      setCurrentIngredient(needsPrepIngredient);
      setPrepModalOpen(true);
    } else {
      // No prep needed, generate immediately
      generateMealImage(meal, category, {});
    }
  };

  const handlePrepSelect = (ingredient: string, style: string) => {
    const updatedStyles = { ...cookingStyles, [ingredient]: style };
    setCookingStyles(updatedStyles);

    // Generate meal with selected style
    if (pendingMeal) {
      generateMealImage(pendingMeal, pendingCategory, updatedStyles);
      setPendingMeal(null);
      setPendingCategory("");
    }
  };

  const generateMealImage = async (
    meal: any,
    category: string,
    styles: Record<string, string>,
  ) => {
    console.log("🎨 Starting meal generation for:", meal.name);
    console.log("📋 Meal data:", meal);
    console.log("🎯 Category:", category);
    console.log("👨‍🍳 Cooking styles:", styles);

    setGenerating(true);
    startProgressTicker();

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    try {
      // Build ingredient list with cooking methods applied
      let ingredientsList: string[] = [];

      if (meal.actualIngredients && meal.actualIngredients.length > 0) {
        ingredientsList = meal.actualIngredients.map((ing: any) => {
          const styleForIng = styles[ing.item] || meal.defaultCookingMethod;
          const fullName = styleForIng
            ? `${styleForIng} ${ing.item}`
            : ing.item;
          return `${ing.quantity} ${ing.unit} ${fullName}`;
        });
      } else {
        ingredientsList = [meal.name];
      }

      console.log(
        `🎨 Generating ${mealType} meal with ingredients:`,
        ingredientsList,
      );
      console.log("📡 Calling unified API endpoint: /api/meals/generate");

      // Get custom macro targets if enabled
      const customMacroTargets = macroTargetingState.serializeForRequest();

      // Use unified meal generation endpoint
      const response = await fetch(apiUrl("/api/meals/generate"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "fridge-rescue",
          mealType: mealType,
          input: ingredientsList,
          userId,
          ...(customMacroTargets && { macroTargets: customMacroTargets }),
          count: 1,
        }),
        signal: abortControllerRef.current.signal,
      });

      console.log("📥 Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ API Error Response:", errorText);
        throw new Error(
          `Failed to generate premade meal: ${response.status} - ${errorText}`,
        );
      }

      const data = await response.json();
      console.log("📦 API Response data:", data);

      // Unified pipeline returns { success, meals, source } - use meals[0] like Fridge Rescue
      if (!data.success || !data.meals?.[0]) {
        console.error(
          "❌ No meal found in response. Data structure:",
          Object.keys(data),
        );
        throw new Error(data.error || "No meal found in response");
      }

      const generatedMeal = data.meals[0];
      console.log("🍽️ Generated meal:", generatedMeal);

      // Unified pipeline guarantees imageUrl with fallback (stable ID)
      const stableId = `premade-${meal.id}-${(meal.name || '').replace(/\s+/g, '_').slice(0, 20)}`;
      const premadeMeal = {
        id: stableId,
        title: generatedMeal.name || meal.name,
        name: generatedMeal.name || meal.name,
        description: generatedMeal.description,
        servings: 1,
        ingredients: generatedMeal.ingredients || meal.ingredients,
        instructions: generatedMeal.instructions || [],
        imageUrl: generatedMeal.imageUrl || "/images/cravings/satisfy-cravings.jpg",
        nutrition: generatedMeal.nutrition || {
          calories: generatedMeal.calories || 350,
          protein: generatedMeal.protein || 30,
          carbs: generatedMeal.carbs || 20,
          fat: generatedMeal.fat || 15,
        },
        medicalBadges: generatedMeal.medicalBadges || [],
        source: "premade",
        category: category,
      };

      console.log(
        `✅ Generated ${mealType} meal with image:`,
        premadeMeal.imageUrl,
      );

      // Call the parent's onMealSelect handler
      if (onMealSelect) {
        onMealSelect(premadeMeal);
      }

      toast({
        title: "Meal Added!",
        description: `${meal.name} has been added to your ${mealType}`,
      });

      // Clean up and close on success
      cleanupGeneration();
      onClose();
    } catch (error: any) {
      // Don't show error if request was cancelled
      if (error.name === "AbortError") {
        console.log("Meal generation cancelled by user");
        return;
      }

      console.error("Error generating premade meal:", error);
      toast({
        title: "Error",
        description: "Failed to generate meal image. Please try again.",
        variant: "destructive",
      });

      // Clean up on error
      cleanupGeneration();
    }
  };

  const handleCancel = () => {
    // Use shared cleanup routine
    cleanupGeneration();

    // Close modal
    onClose();
  };

  const handleDialogChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Cancel generation if modal is being closed
      cleanupGeneration();
      onClose();
    }
  };

  const categories = Object.keys(premadeData);
  const allMeals = (premadeData[activeCategory as keyof typeof premadeData] ||
    []) as any[];

  // Filter meals by search query
  const currentMeals = searchQuery.trim()
    ? allMeals.filter((meal) =>
        meal.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : allMeals;

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] bg-gradient-to-br from-zinc-900 via-zinc-800 to-black border border-white/20 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-white text-xl font-semibold">
            {mealType.charAt(0).toUpperCase() + mealType.slice(1)} Premades
          </DialogTitle>
        </DialogHeader>

        {/* Macro Targeting Controls - Trainer Features Only */}
        {showMacroTargeting && (
          <MacroTargetingControls state={macroTargetingState} />
        )}

        {/* Category Tabs - Purple Style (Matching Meal Ingredient Picker) */}
        <div className="flex flex-nowrap gap-2 mb-3 overflow-x-auto w-full min-w-0 pb-2 overscroll-x-contain touch-pan-x">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-2xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                activeCategory === category
                  ? "bg-purple-600/40 border-2 border-purple-400 text-white shadow-md"
                  : "bg-black/40 border border-white/20 text-white/70 hover:bg-white/10"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="mb-3">
          <Input
            placeholder="Search meals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-black/40 text-white border-white/20 placeholder:text-white/50"
          />
        </div>

        {/* Meal Grid - Checkbox Style (Matching Meal Ingredient Picker) */}
        <div className="overflow-y-auto max-h-[50vh] mb-3 min-h-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-2 gap-y-1">
            {currentMeals.map((meal: any) => (
              <div
                key={meal.id}
                onClick={() => handleSelectPremade(meal, activeCategory)}
                className="flex flex-col items-center gap-0.5 text-white/90 hover:text-white group p-1 min-h-[44px] cursor-pointer"
              >
                <Checkbox
                  checked={false}
                  className="h-1.5 w-1.5 border-white/30 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-500 pointer-events-none"
                />
                <span className="text-[11px] group-hover:text-emerald-300 transition-colors text-center">
                  {meal.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Cancel Button */}
        <div className="flex justify-end gap-3 mb-3">
          <Button
            onClick={handleCancel}
            variant="outline"
            className="bg-black/40 border-white/20 text-white hover:bg-white/10"
          >
            Cancel
          </Button>
        </div>

        {generating && (
          <div className="w-full mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/80">
                AI Analysis Progress
              </span>
              <span className="text-sm text-white/80">
                {Math.round(progress)}%
              </span>
            </div>
            <Progress
              value={progress}
              className="h-3 bg-black/30 border border-white/20"
            />
          </div>
        )}
      </DialogContent>

      {/* Preparation Style Modal */}
      <PreparationModal
        open={prepModalOpen}
        ingredientName={currentIngredient}
        onClose={() => setPrepModalOpen(false)}
        onSelect={handlePrepSelect}
      />
    </Dialog>
  );
}
