import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { MealCard, Meal } from "@/components/MealCard";
import { getWeekBoard, saveWeekBoard, removeMealFromCurrentWeek, getCurrentWeekBoard, getWeekBoardByDate, putWeekBoard, type WeekBoard, weekDates, getDayLists, setDayLists, cloneDayLists } from "@/lib/boardApi";
import { MealPickerDrawer } from "@/components/pickers/MealPickerDrawer";
import { ManualMealModal } from "@/components/pickers/ManualMealModal";
import { AddSnackModal } from "@/components/AddSnackModal";
import { MacroBridgeFooter } from "@/components/biometrics/MacroBridgeFooter";
import WeeklyOverviewModal from "@/components/WeeklyOverviewModal";
import ShoppingAggregateBar from "@/components/ShoppingAggregateBar";
import { normalizeIngredients } from "@/utils/ingredientParser";
import { useOnboardingProfile } from "@/hooks/useOnboardingProfile";
import { useShoppingListStore } from "@/stores/shoppingListStore";
import { computeTargetsFromOnboarding, sumBoard } from "@/lib/targets";
import { useTodayMacros } from "@/hooks/useTodayMacros";
import { useMidnightReset } from "@/hooks/useMidnightReset";
import { todayISOInTZ } from "@/utils/midnight";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Check, Sparkles, BarChart3, ShoppingCart, X, Home, ArrowLeft, Info } from "lucide-react";
import { FEATURES } from "@/utils/features";
import { DayWeekToggle } from "@/components/DayWeekToggle";
import { DayChips } from "@/components/DayChips";
import { DuplicateDayModal } from "@/components/DuplicateDayModal";
import { DuplicateWeekModal } from "@/components/DuplicateWeekModal";
import { WhyChip } from "@/components/WhyChip";
import { WhyDrawer } from "@/components/WhyDrawer";
import { getWeeklyPlanningWhy } from "@/utils/reasons";
import { useToast } from "@/hooks/use-toast";
import ShoppingListPreviewModal from "@/components/ShoppingListPreviewModal";
import { useWeeklyBoard } from "@/hooks/useWeeklyBoard";
import { getMondayISO } from "@/../../shared/schema/weeklyBoard";
import { v4 as uuidv4 } from "uuid";
import MealIngredientPicker from "@/components/MealIngredientPicker";
import DailyMealProgressBar from "@/components/guided/DailyMealProgressBar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Helper function to create new snacks
function makeNewSnack(nextIndex: number): Meal {
  return {
    id: `snk-${Date.now()}`,
    title: 'Snack',
    servings: 1,
    ingredients: [],
    instructions: [],
    nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  };
}

// Week navigation utilities
function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function nextWeekISO(weekStartISO: string) { 
  return addDaysISO(weekStartISO, 7); 
}

function prevWeekISO(weekStartISO: string) { 
  return addDaysISO(weekStartISO, -7); 
}

function formatWeekLabel(weekStartISO: string): string {
  // Lightweight formatter: "Sep 8–14"
  const start = new Date(weekStartISO + 'T00:00:00Z');
  const end = new Date(start); 
  end.setUTCDate(start.getUTCDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(start)}–${fmt(end)}`;
}

export default function DiabeticMenuBuilder() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 🎯 BULLETPROOF BOARD LOADING: Cache-first, guaranteed to render
  const [weekStartISO, setWeekStartISO] = React.useState<string>(getMondayISO());
  const { board: hookBoard, loading: hookLoading, error, save: saveToHook, source } = useWeeklyBoard("1", weekStartISO);

  // Local mutable board state for optimistic updates
  const [board, setBoard] = React.useState<WeekBoard | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);

  // Sync hook board to local state
  React.useEffect(() => {
    if (hookBoard) {
      setBoard(hookBoard);
      setLoading(hookLoading);
    }
  }, [hookBoard, hookLoading]);

  // Wrapper to save with idempotent IDs
  const saveBoard = React.useCallback(async (updatedBoard: WeekBoard) => {
    setSaving(true);
    try {
      // Type assertion needed because ExtendedMeal has optional title, but schema requires it
      await saveToHook(updatedBoard as any, uuidv4());
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save board:", err);
      toast({ title: "Save failed", description: "Changes will retry when you're online", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [saveToHook, toast]);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerList, setPickerList] = React.useState<"breakfast"|"lunch"|"dinner"|"snacks"|null>(null);
  const [manualModalOpen, setManualModalOpen] = React.useState(false);
  const [manualModalList, setManualModalList] = React.useState<"breakfast"|"lunch"|"dinner"|"snacks"|null>(null);
  const [showSnackModal, setShowSnackModal] = React.useState(false);
  const [showOverview, setShowOverview] = React.useState(false);

  // NEW: Day/Week planning state
  const [planningMode, setPlanningMode] = React.useState<'day' | 'week'>('day');
  const [activeDayISO, setActiveDayISO] = React.useState<string>('');

  // Why drawer state
  const [boardWhyOpen, setBoardWhyOpen] = React.useState(false);
  const [showDuplicateDayModal, setShowDuplicateDayModal] = React.useState(false);
  const [showDuplicateWeekModal, setShowDuplicateWeekModal] = React.useState(false);

  // Shopping list v2 modal state
  const [shoppingListModal, setShoppingListModal] = useState<{ isOpen: boolean; meal: any | null }>({ isOpen: false, meal: null });

  // AI Meal Creator modal state (for all meal slots)
  const [aiMealModalOpen, setAiMealModalOpen] = useState(false);
  const [aiMealSlot, setAiMealSlot] = useState<"breakfast" | "lunch" | "dinner" | "snacks">("breakfast");

  // Guided Tour state
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [hasSeenInfo, setHasSeenInfo] = useState(false);
  const [tourStep, setTourStep] = useState<"breakfast" | "lunch" | "dinner" | "snacks" | "complete">("breakfast");

  // Daily Totals Info state (appears after first meal is created)
  const [showDailyTotalsInfo, setShowDailyTotalsInfo] = useState(false);
  const [hasSeenDailyTotalsInfo, setHasSeenDailyTotalsInfo] = useState(false);

  // 🔋 AI Meal Creator localStorage persistence (copy Fridge Rescue pattern)
  const AI_MEALS_CACHE_KEY = "diabetic-ai-meal-creator-cached-meals";

  interface CachedAIMeals {
    meals: Meal[];
    dayISO: string;
    slot: "breakfast" | "lunch" | "dinner" | "snacks";
    generatedAtISO: string;
  }

  // Save AI meals to localStorage
  function saveAIMealsCache(meals: Meal[], dayISO: string, slot: "breakfast" | "lunch" | "dinner" | "snacks") {
    try {
      const state: CachedAIMeals = {
        meals,
        dayISO,
        slot,
        generatedAtISO: new Date().toISOString(),
      };
      localStorage.setItem(AI_MEALS_CACHE_KEY, JSON.stringify(state));
    } catch {}
  }

  // Load AI meals from localStorage
  function loadAIMealsCache(): CachedAIMeals | null {
    try {
      const raw = localStorage.getItem(AI_MEALS_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.meals?.length) return null;
      return parsed as CachedAIMeals;
    } catch {
      return null;
    }
  }

  // Clear AI meals cache
  function clearAIMealsCache() {
    try {
      localStorage.removeItem(AI_MEALS_CACHE_KEY);
    } catch {}
  }

  // Generate week dates for day planning
  const weekDatesList = useMemo(() => {
    return weekStartISO ? weekDates(weekStartISO) : [];
  }, [weekStartISO]);

  // Set initial active day when week loads
  useEffect(() => {
    if (weekDatesList.length > 0 && !activeDayISO) {
      setActiveDayISO(weekDatesList[0]); // Default to Monday
    }
  }, [weekDatesList, activeDayISO]);

  // 🔋 Load AI meals from localStorage on mount or day change (Fridge Rescue pattern)
  useEffect(() => {
    if (!board || !activeDayISO) return;

    const cached = loadAIMealsCache();
    if (cached && cached.dayISO === activeDayISO && cached.meals.length > 0) {
      console.log("🔋 Loading AI meals from localStorage:", cached.meals.length, "meals for", activeDayISO, "into slot:", cached.slot);

      // Merge cached AI meals into the correct slot (not hardcoded to breakfast!)
      const dayLists = getDayLists(board, activeDayISO);
      const targetSlot = cached.slot || "breakfast"; // Fallback to breakfast for old cached data
      const existingSlotMeals = dayLists[targetSlot].filter(m => !m.id.startsWith('ai-meal-'));
      const updatedSlotMeals = [...existingSlotMeals, ...cached.meals];
      const updatedDayLists = { ...dayLists, [targetSlot]: updatedSlotMeals };
      const updatedBoard = setDayLists(board, activeDayISO, updatedDayLists);

      setBoard(updatedBoard);
    }
  }, [board, activeDayISO]); // Run when board loads OR day changes

  // Load/save tour progress from localStorage
  useEffect(() => {
    const infoSeen = localStorage.getItem("diabetic-menu-builder-info-seen");
    if (infoSeen === "true") {
      setHasSeenInfo(true);
    }
    
    const dailyTotalsInfoSeen = localStorage.getItem("diabetic-menu-builder-daily-totals-info-seen");
    if (dailyTotalsInfoSeen === "true") {
      setHasSeenDailyTotalsInfo(true);
    }

    const savedStep = localStorage.getItem("diabetic-menu-builder-tour-step");
    if (savedStep === "breakfast" || savedStep === "lunch" || savedStep === "dinner" || savedStep === "snacks" || savedStep === "complete") {
      setTourStep(savedStep);
    }
  }, []);

  // Handle info modal close - start the guided tour
  const handleInfoModalClose = () => {
    setShowInfoModal(false);
    setHasSeenInfo(true);
    localStorage.setItem("diabetic-menu-builder-info-seen", "true");
  };

  // Update tour step when meals are created
  useEffect(() => {
    if (!board) return;

    const lists = FEATURES.dayPlanning === 'alpha' && planningMode === 'day' && activeDayISO
      ? getDayLists(board, activeDayISO)
      : board.lists;

    // Check meal completion and advance tour
    if (tourStep === "breakfast" && lists.breakfast.length > 0) {
      setTourStep("lunch");
      localStorage.setItem("diabetic-menu-builder-tour-step", "lunch");
      
      // Show Daily Totals info after first meal
      if (!hasSeenDailyTotalsInfo) {
        setShowDailyTotalsInfo(true);
      }
    } else if (tourStep === "lunch" && lists.lunch.length > 0) {
      setTourStep("dinner");
      localStorage.setItem("diabetic-menu-builder-tour-step", "dinner");
    } else if (tourStep === "dinner" && lists.dinner.length > 0) {
      setTourStep("snacks");
      localStorage.setItem("diabetic-menu-builder-tour-step", "snacks");
    } else if (tourStep === "snacks" && lists.snacks.length > 0) {
      setTourStep("complete");
      localStorage.setItem("diabetic-menu-builder-tour-step", "complete");
    }
  }, [board, tourStep, planningMode, activeDayISO, hasSeenDailyTotalsInfo]);

  // Duplicate day handler
  const handleDuplicateDay = useCallback(async (targetDates: string[]) => {
    if (!board || !activeDayISO) return;

    const sourceLists = getDayLists(board, activeDayISO);
    const clonedLists = cloneDayLists(sourceLists);

    let updatedBoard = board;
    targetDates.forEach(dateISO => {
      updatedBoard = setDayLists(updatedBoard, dateISO, clonedLists);
    });

    try {
      await saveBoard(updatedBoard);
      toast({ title: "Day duplicated", description: `Copied to ${targetDates.length} day(s)` });
    } catch (error) {
      console.error('Failed to duplicate day:', error);
      toast({ title: "Failed to duplicate", description: "Please try again", variant: "destructive" });
    }
  }, [board, activeDayISO, saveBoard, toast]);

  // Duplicate week handler  
  const handleDuplicateWeek = useCallback(async (targetWeekStartISO: string) => {
    if (!board) return;

    // Deep clone the entire week
    const clonedBoard = {
      ...board,
      id: `week-${targetWeekStartISO}`,
      days: board.days ? Object.fromEntries(
        Object.entries(board.days).map(([oldDateISO, lists]) => {
          // Calculate offset between weeks
          const sourceDate = new Date(weekDatesList[0] + 'T00:00:00Z');
          const targetWeekDates = weekDates(targetWeekStartISO);
          const dayIndex = weekDatesList.indexOf(oldDateISO);
          const newDateISO = targetWeekDates[dayIndex] || oldDateISO;

          return [newDateISO, cloneDayLists(lists)];
        })
      ) : undefined
    };

    try {
      // Save to the target week (this will use a separate hook instance when we navigate)
      await putWeekBoard(targetWeekStartISO, clonedBoard);
      // Navigate to the new week
      setWeekStartISO(targetWeekStartISO);
      toast({ title: "Week duplicated", description: `Copied to week of ${targetWeekStartISO}` });
    } catch (error) {
      console.error('Failed to duplicate week:', error);
      toast({ title: "Failed to duplicate", description: "Please try again", variant: "destructive" });
    }
  }, [board, weekDatesList, toast]);

  // Shopping list v2 handler - Single day
  const handleAddToShoppingList = useCallback(() => {
    if (!board) {
      toast({
        title: "No meals found",
        description: "Add meals to your board before creating a shopping list.",
        variant: "destructive",
      });
      return;
    }

    // Collect all meals from current view (day or week mode)
    let allMeals: Meal[] = [];
    if (FEATURES.dayPlanning === 'alpha' && planningMode === 'day' && activeDayISO) {
      const dayLists = getDayLists(board, activeDayISO);
      allMeals = [...dayLists.breakfast, ...dayLists.lunch, ...dayLists.dinner, ...dayLists.snacks];
    } else {
      allMeals = [...board.lists.breakfast, ...board.lists.lunch, ...board.lists.dinner, ...board.lists.snacks];
    }

    if (allMeals.length === 0) {
      toast({
        title: "No meals found",
        description: "Add meals to your board before creating a shopping list.",
        variant: "destructive",
      });
      return;
    }

    // Normalize ingredients and add to shopping list store
    const ingredients = allMeals.flatMap(meal => 
      normalizeIngredients(meal.ingredients || [])
    );

    const items = ingredients.map(i => ({
      name: i.name,
      qty: typeof i.qty === 'number' ? i.qty : (i.qty ? parseFloat(String(i.qty)) : undefined),
      unit: i.unit,
      note: planningMode === 'day' && activeDayISO 
        ? `${new Date(activeDayISO + 'T00:00:00Z').toLocaleDateString(undefined, { weekday: 'long' })} Meal Plan`
        : `Weekly Meal Plan (${formatWeekLabel(weekStartISO)})`
    }));

    useShoppingListStore.getState().addItems(items);

    toast({
      title: "Added to Shopping List",
      description: `${ingredients.length} items added to your master list`
    });
  }, [board, planningMode, activeDayISO, weekStartISO, toast]);

  // NEW: Shopping list handler - Entire week (all 7 days)
  const handleAddEntireWeekToShoppingList = useCallback(() => {
    if (!board) {
      toast({
        title: "No meals found",
        description: "Add meals to your board before creating a shopping list.",
        variant: "destructive",
      });
      return;
    }

    // Collect ALL meals from ALL 7 days of the week
    let allMeals: Meal[] = [];

    // Loop through all days in the week
    weekDatesList.forEach(dateISO => {
      const dayLists = getDayLists(board, dateISO);
      allMeals.push(
        ...dayLists.breakfast,
        ...dayLists.lunch,
        ...dayLists.dinner,
        ...dayLists.snacks
      );
    });

    if (allMeals.length === 0) {
      toast({
        title: "No meals found",
        description: "Add meals to your week before creating a shopping list.",
        variant: "destructive",
      });
      return;
    }

    // Normalize ingredients and add to shopping list store
    const ingredients = allMeals.flatMap(meal => 
      normalizeIngredients(meal.ingredients || [])
    );

    const items = ingredients.map(i => ({
      name: i.name,
      qty: typeof i.qty === 'number' ? i.qty : (i.qty ? parseFloat(String(i.qty)) : undefined),
      unit: i.unit,
      note: `Weekly Meal Plan (${formatWeekLabel(weekStartISO)}) - All 7 Days`
    }));

    useShoppingListStore.getState().addItems(items);

    toast({
      title: "Added to Shopping List",
      description: `${ingredients.length} items from entire week added to your master list`
    });
  }, [board, weekStartISO, weekDatesList, toast]);

  // AI Meal Creator handler - Save to localStorage (Fridge Rescue pattern)
  const handleAIMealGenerated = useCallback(async (generatedMeal: any) => {
    if (!activeDayISO) return;

    console.log("🤖 AI Meal Generated - Replacing old meals with new one:", generatedMeal, "for slot:", aiMealSlot);

    // Transform API response to match Meal type structure (copy Fridge Rescue format)
    const transformedMeal: Meal = {
      id: `ai-meal-${Date.now()}`,
      name: generatedMeal.name,
      title: generatedMeal.name,
      description: generatedMeal.description,
      ingredients: generatedMeal.ingredients || [],
      instructions: generatedMeal.instructions || '',
      servings: 1,
      imageUrl: generatedMeal.imageUrl,
      cookingTime: generatedMeal.cookingTime,
      difficulty: generatedMeal.difficulty,
      medicalBadges: generatedMeal.medicalBadges || [],
      nutrition: {
        calories: generatedMeal.calories || 0,
        protein: generatedMeal.protein || 0,
        carbs: generatedMeal.carbs || 0,
        fat: generatedMeal.fat || 0,
      },
    };

    // 🔥 REPLACE old AI meals (don't append) - Like Fridge Rescue
    const newMeals = [transformedMeal];

    // Save to localStorage with slot info (persists until next generation)
    saveAIMealsCache(newMeals, activeDayISO, aiMealSlot);

    // Also update board optimistically - REMOVE old AI meals first from the correct slot
    if (board) {
      const dayLists = getDayLists(board, activeDayISO);
      // Filter out all old AI meals from the target slot
      const currentSlotMeals = dayLists[aiMealSlot];
      const nonAIMeals = currentSlotMeals.filter(m => !m.id.startsWith('ai-meal-'));
      // Add only the new AI meal
      const updatedSlotMeals = [...nonAIMeals, transformedMeal];
      const updatedDayLists = { ...dayLists, [aiMealSlot]: updatedSlotMeals };
      const updatedBoard = setDayLists(board, activeDayISO, updatedDayLists);
      setBoard(updatedBoard);
    }

    // Format slot name for display (capitalize first letter)
    const slotLabel = aiMealSlot.charAt(0).toUpperCase() + aiMealSlot.slice(1);

    toast({
      title: "AI Meal Created!",
      description: `${generatedMeal.name} saved to your ${slotLabel.toLowerCase()}`,
    });
  }, [board, activeDayISO, aiMealSlot, toast]);

  const profile = useOnboardingProfile();
  const targets = computeTargetsFromOnboarding(profile);

  // 🔧 FIX #1: Use real macro tracking instead of board state
  const macroData = useTodayMacros();
  const totals = {
    calories: macroData.kcal || 0,
    protein: macroData.protein || 0,
    carbs: macroData.carbs || 0,
    fat: macroData.fat || 0
  };

  // 🔧 FIX #2: Auto-reset macros at midnight in user's timezone
  const userTimezone = 'America/Chicago'; // Default timezone - could be enhanced with user preference

  useMidnightReset(userTimezone, () => {
    console.log('🌅 Midnight macro reset triggered');
    // Force refresh of today's macros at midnight
    queryClient.invalidateQueries({ 
      queryKey: ["/api/users", "00000000-0000-0000-0000-000000000001", "macros", "today"] 
    });
    // Also dispatch the global event for other components
    window.dispatchEvent(new Event("macros:updated"));
  });

  // Set initial last reset date on component mount
  useEffect(() => {
    localStorage.setItem('lastDailyResetISO', todayISOInTZ(userTimezone));
  }, [userTimezone]);

  function Chip({label,value,target}:{label:string;value:number;target:number}){
    const pct = target ? Math.round((value/target)*100) : 0;
    const ok = pct >= 90 && pct <= 110; // within ±10% looks "green"
    return (
      <span className={`text-xs px-2 py-1 rounded-xl border ${
        ok ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
           : "border-amber-500/40 text-amber-300 bg-amber-500/10"
      }`}>
        {label}: {value} / {target}
      </span>
    );
  }

  // 🎯 Show toast when loading from cache/offline
  React.useEffect(() => {
    if (!loading && source && source !== "db") {
      const msg = source === "cache" 
        ? "Viewing cached meal plan (offline)"
        : "Starting fresh meal plan for this week";
      toast({
        title: "Offline Mode",
        description: msg,
        duration: 3000,
      });
    }
  }, [loading, source, toast]);

  // 🎯 Show error toast if board load fails
  React.useEffect(() => {
    if (error) {
      toast({
        title: "Connection Issue",
        description: "Showing cached meal plan. Changes will sync when you're back online.",
        variant: "default",
        duration: 5000,
      });
    }
  }, [error, toast]);

  // Check for localStorage meal to add (after board loads)
  React.useEffect(() => {
    if (!board || loading) return;

    const pendingMealData = localStorage.getItem("weeklyPlanMealToAdd");
    if (pendingMealData) {
      try {
        const { meal, targetDay, targetSlot } = JSON.parse(pendingMealData);
        localStorage.removeItem("weeklyPlanMealToAdd");

        // If no specific target, show the add modal for user to choose
        if (!targetDay || !targetSlot) {
          setPickerList(targetSlot || "dinner");
          setPickerOpen(true);
          // Store the meal temporarily for the picker
          (window as any).pendingMeal = meal;
        } else {
          // Add directly to specified day/slot
          const slot = targetSlot as "breakfast"|"lunch"|"dinner"|"snacks";
          quickAdd(slot, meal);
        }
      } catch (error) {
        console.error("Failed to process pending meal:", error);
        localStorage.removeItem("weeklyPlanMealToAdd");
      }
    }
  }, [board, loading]);

  // Listen for board updates from external sources
  React.useEffect(() => {
    const handleBoardUpdate = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { weekStartISO: eventWeekISO } = customEvent.detail || {};

      console.log("🔄 Board update event received:", { 
        eventWeekISO, 
        currentWeekISO: weekStartISO,
        matches: eventWeekISO === weekStartISO 
      });

      // Refetch if it's for the current week OR if we don't have a week loaded yet
      if (!weekStartISO || (eventWeekISO && eventWeekISO === weekStartISO)) {
        try {
          console.log("✅ Refetching board data...");
          const { week, weekStartISO: newWeekStartISO } = await getCurrentWeekBoard();
          setBoard(week);
          if (newWeekStartISO !== weekStartISO) {
            setWeekStartISO(newWeekStartISO);
          }
          console.log("✅ Board data refetched successfully");
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
          console.error("Failed to refetch board after update:", errorMsg, error);
        }
      } else {
        console.log("❌ Skipping refetch - week mismatch");
      }
    };

    window.addEventListener("board:updated", handleBoardUpdate);
    return () => window.removeEventListener("board:updated", handleBoardUpdate);
  }, [weekStartISO]);

  // Add Snack handlers
  const onAddSnack = useCallback(() => setShowSnackModal(true), []);

  const onSaveSnack = useCallback(async (p: {
    title: string; brand?: string; servingDesc?: string;
    servings: number; calories: number; protein?: number; carbs?: number; fat?: number;
    includeInShoppingList: boolean;
  }) => {
    if (!board) return;

    // Figure out next orderIndex based on where we're saving (day vs week)
    const currentSnacks = (FEATURES.dayPlanning === 'alpha' && planningMode === 'day' && activeDayISO)
      ? (getDayLists(board, activeDayISO).snacks ?? [])
      : (board.lists.snacks ?? []);

    const nextIndex = currentSnacks.length > 0
      ? Math.max(...currentSnacks.map((s: any) => s?.orderIndex ?? 0)) + 1
      : 0;

    // Build the snack entry (keep your existing shape)
    const newSnack: Meal = {
      id: `snk-${Date.now()}`,
      title: p.title,
      name: `Snack ${nextIndex + 1}`,       // keep your original naming
      servings: p.servings,
      ingredients: [],                       // quick snacks: no ingredients
      instructions: [],                      // quick snacks: no instructions
      nutrition: {
        calories: p.calories,
        protein: p.protein ?? 0,
        carbs:   p.carbs ?? 0,
        fat:     p.fat ?? 0,
      },
      orderIndex: nextIndex,
      entryType: 'quick' as const,
      brand: p.brand,
      servingDesc: p.servingDesc,
      includeInShoppingList: p.includeInShoppingList === true,
    } as any;

    try {
      if (FEATURES.dayPlanning === 'alpha' && planningMode === 'day' && activeDayISO) {
        // ✅ DAY MODE: write into this day's lists
        const dayLists = getDayLists(board, activeDayISO);
        const updatedDay = { ...dayLists, snacks: [...(dayLists.snacks ?? []), newSnack] };
        const updatedBoard = setDayLists(board, activeDayISO, updatedDay);
        const { week } = await putWeekBoard(weekStartISO, updatedBoard);
        setBoard(week);
      } else {
        // ✅ WEEK (legacy) MODE: write into legacy week lists
        const snacks = board.lists.snacks ?? [];
        const updated: WeekBoard = {
          ...board,
          lists: { ...board.lists, snacks: [...snacks, newSnack] },
        };
        setBoard(updated);
        await putWeekBoard(weekStartISO, updated);
      }

      // Notify other widgets to refresh (macros/Header/etc.)
      try {
        window.dispatchEvent(new CustomEvent("board:updated", { detail: { weekStartISO } }));
        window.dispatchEvent(new Event("macros:updated"));
      } catch { /* no-op, safest on older browsers */ }

    } catch (e) {
      console.error("Failed to save snack:", e);
      // Best-effort rollback if we had optimistically set state in week mode
      try { 
        const { week } = await getWeekBoardByDate(weekStartISO);
        setBoard(week);
      } catch {}
    }
  }, [board, weekStartISO, planningMode, activeDayISO]);

  // Week navigation handlers
  const gotoWeek = useCallback(async (targetISO: string) => {
    setLoading(true);
    try {
      const { weekStartISO: ws, week } = await getWeekBoardByDate(targetISO);
      setWeekStartISO(ws);
      setBoard(week);
    } catch (error) {
      console.error("Failed to load week:", error);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setWeekStartISO, setBoard]);

  const onPrevWeek = useCallback(() => {
    if (!weekStartISO) return;
    const d = new Date(weekStartISO + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 7);
    const prevISO = d.toISOString().slice(0, 10);
    gotoWeek(prevISO);
  }, [weekStartISO, gotoWeek]);

  const onNextWeek = useCallback(() => {
    if (!weekStartISO) return;
    const d = new Date(weekStartISO + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 7);
    const nextISO = d.toISOString().slice(0, 10);
    gotoWeek(nextISO);
  }, [weekStartISO, gotoWeek]);

  function onItemUpdated(list: "breakfast"|"lunch"|"dinner"|"snacks", idx: number, m: Meal|null) {
    setBoard((prev:any) => {
      const next = structuredClone(prev);
      if (m === null) next.lists[list].splice(idx, 1);
      else next.lists[list][idx] = m;
      next.version++;
      return next;
    });
  }

  async function handleSave() {
    if (!board) return;
    setSaving(true);
    try { 
      const saved = await saveWeekBoard(board); 
      setBoard(saved);
      setJustSaved(true);
      // Reset success state after 2.5 seconds
      setTimeout(() => {
        setJustSaved(false);
        setSaving(false);
      }, 2500);
    } catch (error) {
      console.error("Failed to save board:", error);
      setSaving(false);
    }
  }

  async function quickAdd(list: "breakfast"|"lunch"|"dinner"|"snacks", meal: Meal) {
    if (!board) return;

    try {
      // In Day mode, add to the specific day. In Week mode, use legacy behavior
      if (FEATURES.dayPlanning === 'alpha' && planningMode === 'day' && activeDayISO) {
        // Add to specific day
        const dayLists = getDayLists(board, activeDayISO);
        const updatedDayLists = {
          ...dayLists,
          [list]: [...dayLists[list as keyof typeof dayLists], meal]
        };
        const updatedBoard = setDayLists(board, activeDayISO, updatedDayLists);
        await saveBoard(updatedBoard);
        console.log("✅ Successfully added meal to", list, "for", activeDayISO);
      } else {
        // Week mode: update local board and save
        const updatedBoard = {
          ...board,
          lists: {
            ...board.lists,
            [list]: [...board.lists[list], meal]
          },
          version: board.version + 1,
          meta: {
            ...board.meta,
            lastUpdatedAt: new Date().toISOString()
          }
        };
        setBoard(updatedBoard);
        await saveBoard(updatedBoard);
        console.log("✅ Successfully added meal to", list, "for", weekStartISO);
      }

      // Dispatch board update event for instant refresh
      try {
        window.dispatchEvent(new CustomEvent("board:updated", { detail: { weekStartISO } }));
        window.dispatchEvent(new Event("macros:updated"));
      } catch { /* no-op, safest on older browsers */ }

    } catch (error) {
      console.error("Failed to add meal:", error);
    }
  }

  function openPicker(list: "breakfast"|"lunch"|"dinner"|"snacks") {
    setPickerList(list);
    setPickerOpen(true);
  }

  function openManualModal(list: "breakfast"|"lunch"|"dinner"|"snacks") {
    setManualModalList(list);
    setManualModalOpen(true);
  }

  const lists: Array<["breakfast"|"lunch"|"dinner"|"snacks", string]> = [
    ["breakfast","Breakfast"], ["lunch","Lunch"], ["dinner","Dinner"], ["snacks","Snacks"]
  ];

  const handleLogAllMacros = useCallback(async () => {
    if (!board) return;

    try {
      const allMeals = [
        ...board.lists.breakfast,
        ...board.lists.lunch,
        ...board.lists.dinner,
        ...board.lists.snacks
      ];

      if (allMeals.length === 0) {
        toast({
          title: "No Meals",
          description: "Add some meals to your board first.",
          variant: "destructive",
        });
        return;
      }

      let successCount = 0;
      const { post } = await import("@/lib/api");

      for (const meal of allMeals) {
        const logEntry = {
          mealName: meal.title || meal.name || "Meal",
          calories: meal.nutrition?.calories ?? 0,
          protein: meal.nutrition?.protein ?? 0,
          carbs: meal.nutrition?.carbs ?? 0,
          fat: meal.nutrition?.fat ?? 0,
          servings: meal.servings || 1,
          source: "weekly-meal-board-bulk"
        };

        try {
          await post("/api/macros/log", logEntry);
          successCount++;
        } catch (error) {
          console.error("Failed to log meal:", error);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["macros"] });
      window.dispatchEvent(new Event("macros:updated"));

      toast({
        title: "All Meals Logged!",
        description: `Successfully logged ${successCount} meal(s) to your macros.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to log meals. Please try again.",
        variant: "destructive",
      });
    }
  }, [board, toast, queryClient]);

  if (loading || !board) return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pt-20">
      <div className="text-white/80 p-6 text-center">Loading meal board...</div>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pt-20 pb-32 overflow-x-hidden"
    >
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => setLocation("/diabetic-hub")}
        className="fixed top-2 left-2 sm:top-4 sm:left-4 z-50 bg-black/60 backdrop-blur-none rounded-2xl border border-white/20 text-white hover:bg-black/80 px-3 sm:px-4 py-2"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Home
      </Button>

      {/* Fixed Client Dashboard Button - Top Right (when accessed from ProCare) */}
      {(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const clientId = urlParams.get('clientId');
        if (clientId) {
          return (
            <Button
              size="sm"
              onClick={() => setLocation(`/pro/clients/${clientId}`)}
              className="fixed top-2 right-2 sm:top-4 sm:right-4 z-50 bg-black/60 backdrop-blur-none rounded-2xl border border-white/20 text-white hover:bg-black/80 px-3 sm:px-4 py-2"
              data-testid="button-client-dashboard"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Client Dashboard
            </Button>
          );
        }
        return null;
      })()}

      <div className="mb-6 border border-zinc-800 bg-zinc-900/60 backdrop-blur rounded-2xl mx-4">
        <div className="px-4 py-4 flex flex-col gap-3">
          
          {/* ROW 1: Week Dates (centered) + ? Button (absolute top-right) */}
          <div className="relative flex justify-center">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onPrevWeek}
                className="rounded-md px-2 py-1 border border-white/20 text-white/80 hover:bg-white/10 transition-colors"
                aria-label="Previous week"
              >
                ‹
              </button>

              <div className="text-sm font-medium text-white/90">
                {weekStartISO ? formatWeekLabel(weekStartISO) : 'Loading…'}
              </div>

              <button
                type="button"
                onClick={onNextWeek}
                className="rounded-md px-2 py-1 border border-white/20 text-white/80 hover:bg-white/10 transition-colors"
                aria-label="Next week"
              >
                ›
              </button>
            </div>

            <button
              onClick={() => setShowInfoModal(true)}
              className="absolute right-0 top-0 bg-lime-700 hover:bg-lime-800 border-2 border-lime-600 text-white rounded-2xl h-4 w-4 flex items-center justify-center text-xs font-bold"
              aria-label="How to use"
            >
              ?
            </button>
          </div>

          {/* ROW 2: Title (centered) */}
          <h1 className="text-center text-2xl font-semibold text-white">
            Diabetic Meal Board
          </h1>

          {/* ROW 3: Day/Week Toggle + Duplicate */}
          {FEATURES.dayPlanning === 'alpha' && (
            <div className="flex items-center justify-between gap-3">
              <DayWeekToggle mode={planningMode} onModeChange={setPlanningMode} />
              
              {planningMode === 'day' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDuplicateDayModal(true)}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs px-3 py-1 rounded-xl"
                >
                  Duplicate...
                </Button>
              )}

              {planningMode === 'week' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDuplicateWeekModal(true)}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs px-3 py-1 rounded-xl"
                >
                  Copy Week...
                </Button>
              )}
            </div>
          )}

          {/* ROW 4: Days of Week */}
          {FEATURES.dayPlanning === 'alpha' && planningMode === 'day' && weekDatesList.length > 0 && (
            <div className="flex justify-center">
              <DayChips 
                weekDates={weekDatesList}
                activeDayISO={activeDayISO}
                onDayChange={setActiveDayISO}
              />
            </div>
          )}

          {/* ROW 5: Bottom Actions (Delete All + Save) */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (confirm("Delete all meals from this board? This action cannot be undone.")) {
                  if (board) {
                    const clearedBoard = {
                      ...board,
                      lists: {
                        breakfast: [],
                        lunch: [],
                        dinner: [],
                        snacks: []
                      },
                      days: board.days ? Object.fromEntries(
                        Object.keys(board.days).map(dateISO => [
                          dateISO,
                          { breakfast: [], lunch: [], dinner: [], snacks: [] }
                        ])
                      ) : undefined
                    };
                    saveBoard(clearedBoard);
                    clearAIMealsCache();
                    toast({
                      title: "All Meals Deleted",
                      description: "Successfully cleared all meals from the board",
                    });
                  }
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded-xl"
            >
              Delete All
            </Button>

            <Button
              onClick={handleSave}
              disabled={saving || justSaved}
              size="sm"
              className={`${
                justSaved
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                  : "bg-emerald-600/80 hover:bg-emerald-600 text-white"
              } text-xs px-3 py-1 rounded-xl transition-all duration-200`}
            >
              {justSaved ? (
                <><Check className="h-3 w-3 mr-1" />Saved ✓</>
              ) : saving ? (
                "Saving…"
              ) : (
                "Save Plan"
              )}
            </Button>
          </div>

        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 pb-10 grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        {/* Render day view or week view based on mode */}
        {FEATURES.dayPlanning === 'alpha' && planningMode === 'day' && activeDayISO && board ? (
          // DAY MODE: Show only the active day's meals
          (() => {
            const dayLists = getDayLists(board, activeDayISO);
            return lists.map(([key, label]) => (
              <section key={key} data-meal-id={key === "snacks" ? "snack1" : key} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white/90 text-lg font-medium">{label}</h2>
                  <div className="flex gap-2">
                    {/* AI Meal Creator button for all meal sections */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white/80 hover:bg-black/50 border border-pink-400/30 text-xs font-medium flex items-center gap-1 flash-border"
                      onClick={() => {
                        setAiMealSlot(key as "breakfast" | "lunch" | "dinner" | "snacks");
                        setAiMealModalOpen(true);
                      }}
                    >
                      <Sparkles className="h-3 w-3" />
                      Create with AI
                    </Button>

                    {/* Plus button for manual entry */}
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-white/80 hover:bg-white/10"
                      onClick={() => openManualModal(key)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>

                    {/* Special Log Snack button for snacks section only - navigates to Biometrics photo log */}
                    {key === "snacks" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white/70 hover:bg-white/10 text-xs font-medium"
                        onClick={() => setLocation("/my-biometrics")}
                      >
                        📸 Log Snack
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {dayLists[key as keyof typeof dayLists].map((meal: Meal, idx: number) => (
                    <MealCard
                      key={meal.id}
                      date={activeDayISO} 
                      slot={key}
                      meal={meal}
                      onUpdated={(m) => {
                        if (m === null) {
                          // REMOVE MEAL in Day mode - use the new system

                          // 🗑️ If it's an AI meal, also clear from localStorage
                          if (meal.id.startsWith('ai-meal-')) {
                            console.log("🗑️ Deleting AI meal from localStorage:", meal.name);
                            clearAIMealsCache();
                          }

                          const updatedDayLists = {
                            ...dayLists,
                            [key]: dayLists[key as keyof typeof dayLists].filter((existingMeal) => 
                              existingMeal.id !== meal.id
                            )
                          };
                          const updatedBoard = setDayLists(board, activeDayISO, updatedDayLists);
                          putWeekBoard(weekStartISO, updatedBoard)
                            .then(({ week }) => setBoard(week))
                            .catch((err) => {
                              console.error("❌ Delete failed (Day mode):", err);
                              console.error("Error details:", JSON.stringify(err, null, 2));
                              alert("Failed to delete meal. Check console for details.");
                            });
                        } else {
                          // Update meal in day lists
                          const updatedDayLists = {
                            ...dayLists,
                            [key]: dayLists[key as keyof typeof dayLists].map((existingMeal, i) => 
                              i === idx ? m : existingMeal
                            )
                          };
                          const updatedBoard = setDayLists(board, activeDayISO, updatedDayLists);
                          putWeekBoard(weekStartISO, updatedBoard).then(({ week }) => setBoard(week));
                        }
                      }}
                    />
                  ))}
                  {dayLists[key as keyof typeof dayLists].length === 0 && (
                    <div className="rounded-2xl border border-dashed border-zinc-700 text-white/50 p-6 text-center text-sm">
                      <p className="mb-2">No {label.toLowerCase()} meals yet</p>
                      <p className="text-xs text-white/40">Use "Create with AI" or "+" to add meals</p>
                    </div>
                  )}
                </div>
              </section>
            ));
          })()
        ) : (
          // WEEK MODE: Show traditional week view (legacy lists)
          lists.map(([key, label]) => (
          <section key={key} data-meal-id={key === "snacks" ? "snack1" : key} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white/90 text-lg font-medium">{label}</h2>
              <div className="flex gap-2">
                {/* Plus button for manual entry */}
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-white/80 hover:bg-white/10"
                  onClick={() => openManualModal(key)}
                >
                  <Plus className="h-4 w-4" />
                </Button>

                {/* Special Add Snack button for snacks section only */}
                {key === "snacks" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-white/70 hover:bg-white/10 text-xs font-medium"
                    onClick={onAddSnack}
                  >
                    Add Snack
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {board.lists[key].map((meal: Meal, idx: number) => (
                <MealCard
                  key={meal.id}
                  date={"board"} 
                  slot={key}
                  meal={meal}
                  onUpdated={(m) => {
                    if (m === null) {
                      // Remove meal using new API
                      if (!board) return;
                      const updatedBoard = {
                        ...board,
                        lists: {
                          ...board.lists,
                          [key]: board.lists[key].filter((item: Meal) => item.id !== meal.id)
                        },
                        version: board.version + 1,
                        meta: {
                          ...board.meta,
                          lastUpdatedAt: new Date().toISOString()
                        }
                      };
                      setBoard(updatedBoard);
                      saveBoard(updatedBoard).catch((err) => {
                        console.error("❌ Delete failed (Board mode):", err);
                        console.error("Error details:", JSON.stringify(err, null, 2));
                        console.error("Error message:", err?.message || "No message");
                        console.error("Error stack:", err?.stack || "No stack");
                        alert("Failed to delete meal. Check console for details.");
                      });
                    } else {
                      onItemUpdated(key, idx, m);
                    }
                  }}
                />
              ))}
              {board.lists[key].length === 0 && (
                <div className="rounded-2xl border border-dashed border-zinc-700 text-white/50 p-6 text-center text-sm">
                  <p className="mb-2">No {label.toLowerCase()} meals yet</p>
                  <p className="text-xs text-white/40">Use "Create with AI" or "+" to add meals</p>
                </div>
              )}
            </div>
          </section>
          ))
        )}

        {/* Daily Totals Summary */}
        <div className="col-span-full">
          <div className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-lg p-6">
            <h3 className="text-white font-semibold text-lg mb-4 text-center flex items-center justify-center gap-2">
              Daily Totals
              {(() => {
                // Check if there are any meals
                const hasMeals = board && (
                  (FEATURES.dayPlanning === 'alpha' && planningMode === 'day' && activeDayISO
                    ? (() => {
                        const dayLists = getDayLists(board, activeDayISO);
                        return dayLists.breakfast.length > 0 || dayLists.lunch.length > 0 || dayLists.dinner.length > 0 || dayLists.snacks.length > 0;
                      })()
                    : board.lists.breakfast.length > 0 || board.lists.lunch.length > 0 || board.lists.dinner.length > 0 || board.lists.snacks.length > 0)
                );

                // Show button if there are meals, flash only if user hasn't seen the info
                if (hasMeals) {
                  return (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowDailyTotalsInfo(true)}
                      className={`h-5 w-5 p-0 text-white/90 hover:text-white hover:bg-white/10 rounded-full ${
                        !hasSeenDailyTotalsInfo ? 'flash-border' : ''
                      }`}
                      aria-label="Next Steps Info"
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  );
                }
                return null;
              })()}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-xl font-semi-bold text-white">
                  {Math.round((() => {
                    if (FEATURES.dayPlanning === 'alpha' && planningMode === 'day' && activeDayISO && board) {
                      const dayLists = getDayLists(board, activeDayISO);
                      return [...dayLists.breakfast, ...dayLists.lunch, ...dayLists.dinner, ...dayLists.snacks]
                        .reduce((sum, meal) => sum + (meal.nutrition?.calories ?? 0), 0);
                    }
                    return [...board.lists.breakfast, ...board.lists.lunch, ...board.lists.dinner, ...board.lists.snacks]
                      .reduce((sum, meal) => sum + (meal.nutrition?.calories ?? 0), 0);
                  })())}
                </div>
                <div className="text-xs uppercase tracking-wide text-white/70 mt-1">Calories</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-semi-bold text-white">
                  {Math.round((() => {
                    if (FEATURES.dayPlanning === 'alpha' && planningMode === 'day' && activeDayISO && board) {
                      const dayLists = getDayLists(board, activeDayISO);
                      return [...dayLists.breakfast, ...dayLists.lunch, ...dayLists.dinner, ...dayLists.snacks]
                        .reduce((sum, meal) => sum + (meal.nutrition?.protein ?? 0), 0);
                    }
                    return [...board.lists.breakfast, ...board.lists.lunch, ...board.lists.dinner, ...board.lists.snacks]
                      .reduce((sum, meal) => sum + (meal.nutrition?.protein ?? 0), 0);
                  })())}g
                </div>
                <div className="text-xs uppercase tracking-wide text-white/70 mt-1">Protein</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-semi-bold text-white">
                  {Math.round((() => {
                    if (FEATURES.dayPlanning === 'alpha' && planningMode === 'day' && activeDayISO && board) {
                      const dayLists = getDayLists(board, activeDayISO);
                      return [...dayLists.breakfast, ...dayLists.lunch, ...dayLists.dinner, ...dayLists.snacks]
                        .reduce((sum, meal) => sum + (meal.nutrition?.carbs ?? 0), 0);
                    }
                    return [...board.lists.breakfast, ...board.lists.lunch, ...board.lists.dinner, ...board.lists.snacks]
                      .reduce((sum, meal) => sum + (meal.nutrition?.carbs ?? 0), 0);
                  })())}g
                </div>
                <div className="text-xs uppercase tracking-wide text-white/70 mt-1">Carbs</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-semi-bold text-white">
                  {Math.round((() => {
                    if (FEATURES.dayPlanning === 'alpha' && planningMode === 'day' && activeDayISO && board) {
                      const dayLists = getDayLists(board, activeDayISO);
                      return [...dayLists.breakfast, ...dayLists.lunch, ...dayLists.dinner, ...dayLists.snacks]
                        .reduce((sum, meal) => sum + (meal.nutrition?.fat ?? 0), 0);
                    }
                    return [...board.lists.breakfast, ...board.lists.lunch, ...board.lists.dinner, ...board.lists.snacks]
                      .reduce((sum, meal) => sum + (meal.nutrition?.fat ?? 0), 0);
                  })())}g
                </div>
                <div className="text-xs uppercase tracking-wide text-white/70 mt-1">Fat</div>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Totals Footer - Day Mode Only */}
        {board && FEATURES.dayPlanning === 'alpha' && planningMode === 'day' && activeDayISO && (
          <div className="col-span-full">
            <MacroBridgeFooter
              items={(() => {
                const dayLists = getDayLists(board, activeDayISO);
                return [
                  ...dayLists.breakfast.map(m => ({ 
                    protein: m.nutrition?.protein || 0, 
                    carbs: m.nutrition?.carbs || 0, 
                    fat: m.nutrition?.fat || 0, 
                    calories: m.nutrition?.calories || 0 
                  })),
                  ...dayLists.lunch.map(m => ({ 
                    protein: m.nutrition?.protein || 0, 
                    carbs: m.nutrition?.carbs || 0, 
                    fat: m.nutrition?.fat || 0, 
                    calories: m.nutrition?.calories || 0 
                  })),
                  ...dayLists.dinner.map(m => ({ 
                    protein: m.nutrition?.protein || 0, 
                    carbs: m.nutrition?.carbs || 0, 
                    fat: m.nutrition?.fat || 0, 
                    calories: m.nutrition?.calories || 0 
                  })),
                  ...dayLists.snacks.map(m => ({ 
                    protein: m.nutrition?.protein || 0, 
                    carbs: m.nutrition?.carbs || 0, 
                    fat: m.nutrition?.fat || 0, 
                    calories: m.nutrition?.calories || 0 
                  }))
                ];
              })()}
              dateISO={activeDayISO}
              variant="day"
              source="weekly-meal-board"
            />
          </div>
        )}

      </div>

      <MealPickerDrawer
        open={pickerOpen}
        list={pickerList}
        onClose={() => {
          setPickerOpen(false);
          setPickerList(null);
          // Clear pending meal if user cancels
          if ((window as any).pendingMeal) {
            delete (window as any).pendingMeal;
          }
        }}
        onPick={(meal) => {
          if (pickerList) {
            // Use pending meal from localStorage if available, otherwise use picked meal
            const mealToAdd = (window as any).pendingMeal || meal;
            quickAdd(pickerList, mealToAdd);
            // Clear pending meal after adding
            if ((window as any).pendingMeal) {
              delete (window as any).pendingMeal;
            }
          }
          setPickerOpen(false);
          setPickerList(null);
        }}
      />

      <ManualMealModal
        open={manualModalOpen}
        onClose={() => {
          setManualModalOpen(false);
          setManualModalList(null);
        }}
        onSave={(meal) => {
          if (manualModalList) {
            quickAdd(manualModalList, meal);
          }
          setManualModalOpen(false);
          setManualModalList(null);
        }}
      />

      <AddSnackModal
        open={showSnackModal}
        onClose={() => setShowSnackModal(false)}
        onSave={onSaveSnack}
      />

      <WeeklyOverviewModal
        open={showOverview}
        onClose={() => setShowOverview(false)}
        weekStartISO={weekStartISO}
        board={board}
        onJumpToDay={undefined} // wire later if/when day-level boards are added
      />

      {/* NEW: Duplicate Day Modal */}
      {FEATURES.dayPlanning === 'alpha' && (
        <DuplicateDayModal
          isOpen={showDuplicateDayModal}
          onClose={() => setShowDuplicateDayModal(false)}
          onConfirm={handleDuplicateDay}
          sourceDateISO={activeDayISO}
          availableDates={weekDatesList.filter(date => date !== activeDayISO)}
        />
      )}

      {/* NEW: Duplicate Week Modal */}
      {FEATURES.dayPlanning === 'alpha' && (
        <DuplicateWeekModal
          isOpen={showDuplicateWeekModal}
          onClose={() => setShowDuplicateWeekModal(false)}
          onConfirm={handleDuplicateWeek}
          sourceWeekStartISO={weekStartISO}
        />
      )}

      {/* Why Drawer */}
      {FEATURES.explainMode === 'alpha' && (
        <WhyDrawer 
          open={boardWhyOpen} 
          onClose={() => setBoardWhyOpen(false)}
          title="Why weekly planning?"
          reasons={getWeeklyPlanningWhy()}
        />
      )}

      {/* Shopping List Preview Modal */}
      <ShoppingListPreviewModal
        isOpen={shoppingListModal.isOpen}
        onClose={() => setShoppingListModal({ isOpen: false, meal: null })}
        meal={shoppingListModal.meal}
      />

      {/* AI Meal Creator with Ingredient Picker - All Meal Slots */}
      <MealIngredientPicker
        open={aiMealModalOpen}
        onOpenChange={setAiMealModalOpen}
        onMealGenerated={handleAIMealGenerated}
        mealSlot={aiMealSlot}
      />

      {/* Shopping List Buttons - Dual buttons in Day Mode, single in Week Mode */}
      {board && (() => {
        const allMeals = planningMode === 'day' && activeDayISO
          ? (() => {
              const dayLists = getDayLists(board, activeDayISO);
              return [...dayLists.breakfast, ...dayLists.lunch, ...dayLists.dinner, ...dayLists.snacks];
            })()
          : [...board.lists.breakfast, ...board.lists.lunch, ...board.lists.dinner, ...board.lists.snacks];

        const ingredients = allMeals.flatMap(meal => 
          normalizeIngredients(meal.ingredients || [])
        );

        // If no ingredients, don't show the bar
        if (ingredients.length === 0) return null;

        // DAY MODE: Show dual buttons (Send Day + Send Entire Week)
        if (FEATURES.dayPlanning === 'alpha' && planningMode === 'day' && activeDayISO) {
          const dayName = new Date(activeDayISO + 'T00:00:00Z').toLocaleDateString(undefined, { weekday: 'long' });

          return (
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-r from-zinc-900/95 via-zinc-800/95 to-black/95 backdrop-blur-xl border-t border-white/20 shadow-2xl safe-area-inset-bottom">
              <div className="container mx-auto px-4 py-3">
                <div className="flex flex-col gap-2">
                  <div className="text-white text-sm font-semibold">
                    Shopping List Ready - {ingredients.length} ingredients
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        handleAddToShoppingList();
                        setTimeout(() => setLocation('/shopping-list-v2?from=weekly-meal-board'), 100);
                      }}
                      className="flex-1 min-h-[44px] bg-orange-600 hover:bg-orange-700 text-white border border-white/30"
                      data-testid="button-send-day-shopping"
                    >
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      Send {dayName}
                    </Button>
                    <Button
                      onClick={() => {
                        handleAddEntireWeekToShoppingList();
                        setTimeout(() => setLocation('/shopping-list-v2?from=weekly-meal-board'), 100);
                      }}
                      className="flex-1 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white border border-white/30"
                      data-testid="button-send-week-shopping"
                    >
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      Send Entire Week
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // WEEK MODE: Use existing ShoppingAggregateBar component
        return (
          <ShoppingAggregateBar
            ingredients={ingredients}
            source={`Diabetic Meal Plan (${formatWeekLabel(weekStartISO)})`}
            sourceSlug="diabetic-meal-board"
          />
        );
      })()}

      {/* Info Modal - How to Use */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-black/30 backdrop-blur-lg border border-white/20 rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4">How to Use Diabetic Menu Builder</h3>
            
            <div className="space-y-4 text-white/90 text-sm">
              <p>Create your day or week by starting with breakfast.</p>
              <p className="text-white/80">
                Click the "Create with AI" button on each meal section to build your plan. 
                You can create one day and duplicate it across the week, or create each day individually.
              </p>
              <p className="text-white/80">
                If you change your mind about a meal, just hit the <span className="font-semibold text-white">trash can</span> to delete it and create a new one.
              </p>
            </div>

            <button
              onClick={() => {
                setShowInfoModal(false);
                handleInfoModalClose();
              }}
              className="mt-6 w-full bg-lime-700 hover:bg-lime-800 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Daily Totals Info Modal - Next Steps After First Meal */}
      <Dialog open={showDailyTotalsInfo} onOpenChange={(open) => {
        if (!open) {
          setShowDailyTotalsInfo(false);
          setHasSeenDailyTotalsInfo(true);
          localStorage.setItem("diabetic-menu-builder-daily-totals-info-seen", "true");
        }
      }}>
        <DialogContent className="bg-gradient-to-b from-orange-900/95 via-zinc-900/95 to-black/95 border-orange-500/30 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white text-xl flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-orange-400" />
              Next Steps - Track Your Progress!
            </DialogTitle>
          </DialogHeader>
          <div className="text-white/90 text-sm space-y-4">
            <p className="text-base font-semibold text-orange-300">
              Great job creating your meals! Here's what to do next:
            </p>

            <div className="space-y-3">
              <div className="bg-black/30 p-3 rounded-lg border border-orange-500/20">
                <p className="font-semibold text-white mb-1 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-orange-400" />
                  Option 1: Track Your Macros
                </p>
                <p className="text-white/70 text-xs">
                  Send your day to the Macro Calculator to ensure you're hitting your nutrition targets.
                  Look for the "Send to Macros" button below.
                </p>
              </div>

              <div className="bg-black/30 p-3 rounded-lg border border-orange-500/20">
                <p className="font-semibold text-white mb-1">
                  Option 2: Plan Your Week
                </p>
                <p className="text-white/70 text-xs">
                  Use the Day/Week toggle at the top to switch between planning a single day or your entire week.
                  You can duplicate days or create each day individually.
                </p>
              </div>

              <div className="bg-orange-900/30 p-3 rounded-lg border border-orange-400/30">
                <p className="font-semibold text-orange-200 mb-1">
                  💡 Pro Tip: Macro Tracking
                </p>
                <p className="text-orange-100/80 text-xs">
                  Send just ONE day to macros at a time (not the whole week). 
                  This way, if you change meals on other days, you won't have outdated data.
                </p>
              </div>

              <div className="bg-black/30 p-3 rounded-lg border border-emerald-500/20">
                <p className="font-semibold text-white mb-1 flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-emerald-400" />
                  Shopping List Ready
                </p>
                <p className="text-white/70 text-xs">
                  You CAN send your entire week to the shopping list! 
                  This consolidates all ingredients for easy grocery shopping.
                  Click "Send Entire Week" at the bottom.
                </p>
              </div>
            </div>

            <p className="text-xs text-white/60 text-center pt-2 border-t border-white/10">
              Next: Check out the Shopping List to learn how to use it effectively!
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}