import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLocation, useRoute } from "wouter";
import { proStore } from "@/lib/proData";
import { MealCard, Meal } from "@/components/MealCard";
import { getWeekBoard, saveWeekBoard, removeMealFromCurrentWeek, getCurrentWeekBoard, getWeekBoardByDate, putWeekBoard, type WeekBoard, getDayLists, setDayLists, cloneDayLists } from "@/lib/boardApi";
import { MealPickerDrawer } from "@/components/pickers/MealPickerDrawer";
import { ManualMealModal } from "@/components/pickers/ManualMealModal";
import { AddSnackModal } from "@/components/AddSnackModal";
import { MacroBridgeFooter } from "@/components/biometrics/MacroBridgeFooter";
import { RemainingMacrosFooter } from "@/components/biometrics/RemainingMacrosFooter";
import { DailyTargetsCard } from "@/components/biometrics/DailyTargetsCard";
import { ProTipCard } from "@/components/ProTipCard";
import { useAuth } from "@/contexts/AuthContext";
import { lockDay, isDayLocked } from "@/lib/lockedDays";
import { setQuickView } from "@/lib/macrosQuickView";
import { getMacroTargets } from "@/lib/dailyLimits";
import WeeklyOverviewModal from "@/components/WeeklyOverviewModal";
import ShoppingAggregateBar from "@/components/ShoppingAggregateBar";
import BottomNav from "@/components/BottomNav";
import { normalizeIngredients } from "@/utils/ingredientParser";
import { useOnboardingProfile } from "@/hooks/useOnboardingProfile";
import { useShoppingListStore } from "@/stores/shoppingListStore";
import { computeTargetsFromOnboarding, sumBoard } from "@/lib/targets";
import { useTodayMacros } from "@/hooks/useTodayMacros";
import { useMidnightReset } from "@/hooks/useMidnightReset";
import { 
  getWeekStartISOInTZ, 
  getTodayISOSafe, 
  weekDatesInTZ, 
  nextWeekISO, 
  prevWeekISO, 
  formatWeekLabel,
  formatDateDisplay,
  todayISOInTZ 
} from "@/utils/midnight";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Check, Sparkles, BarChart3, ShoppingCart, X, Home, ArrowLeft, Info, Calendar } from "lucide-react";
import { FEATURES } from "@/utils/features";
import { DayWeekToggle } from "@/components/DayWeekToggle";
import { DayChips } from "@/components/DayChips";
import { DailyStarchIndicator } from "@/components/DailyStarchIndicator";
import { DuplicateDayModal } from "@/components/DuplicateDayModal";
import { DuplicateWeekModal } from "@/components/DuplicateWeekModal";
import { WhyChip } from "@/components/WhyChip";
import { WhyDrawer } from "@/components/WhyDrawer";
import { getWeeklyPlanningWhy } from "@/utils/reasons";
import { useToast } from "@/hooks/use-toast";
import ShoppingListPreviewModal from "@/components/ShoppingListPreviewModal";
import { useWeeklyBoard } from "@/hooks/useWeeklyBoard";
// CHICAGO CALENDAR FIX v1.0: getMondayISO replaced with getWeekStartISOInTZ from midnight.ts
import { v4 as uuidv4 } from "uuid";
import { CreateWithChefModal } from "@/components/CreateWithChefModal";
import { getResolvedTargets } from "@/lib/macroResolver";
import { classifyMeal } from "@/utils/starchMealClassifier";
import type { StarchContext } from "@/hooks/useCreateWithChefRequest";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SnackPickerDrawer from "@/components/pickers/SnackPickerDrawer";
import { SnackCreatorModal } from "@/components/SnackCreatorModal";
import { SnackCreatorButton } from "@/components/SnackCreatorButton";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { MedicalSourcesInfo } from "@/components/MedicalSourcesInfo";
import { useMealBoardDraft } from "@/hooks/useMealBoardDraft";

const GENERAL_NUTRITION_TOUR_STEPS: TourStep[] = [
  { icon: "1", title: "Build Client Meals", description: "Tap the + button on any meal card to add personalized recipes for your client." },
  { icon: "2", title: "Set Coach Targets", description: "Macro targets are set from the Client Dashboard - view progress here." },
  { icon: "3", title: "Day-by-Day Planning", description: "Use day chips to plan specific meals for each day of the week." },
  { icon: "4", title: "Duplicate Days", description: "Copy a day's meals to other days for consistent eating patterns." },
  { icon: "5", title: "Shopping List", description: "Export all ingredients for the week to create a shopping list." },
  { icon: "6", title: "Track Progress & Save Day", description: "Review your color-coded progress at the bottom of the page, then tap Save Day to lock your plan into Biometrics." },
  { icon: "🥔", title: "Watch Your Starch Slots", description: "The starch indicator shows your daily starch meal status. Green = slots available, Orange = all used, Red = over limit. Fibrous carbs are unlimited!" },
  { icon: "*", title: "What the Asterisks Mean", description: "Protein and carbs are marked with asterisks (*) because they're the most important numbers to focus on when building your meals. Get those right first." }
];

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

// CHICAGO CALENDAR FIX v1.0: All date utilities now imported from midnight.ts
// Using noon UTC anchor pattern to prevent day-shift bugs

export default function WeeklyMealBoard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Hide bottom navigation on this page (conflicts with Shopping Aggregate Bar)
  React.useEffect(() => {
    document.body.classList.add('hide-bottom-nav');
    return () => document.body.classList.remove('hide-bottom-nav');
  }, []);
  
  const quickTour = useQuickTour("general-nutrition-builder");

  // Get clientId from route params for Pro context
  const [, params] = useRoute("/pro/clients/:id/general-nutrition-builder");
  const clientId = params?.id || "1"; // Default to "1" for standalone mode
  const isProCareMode = !!params?.id;

  // Coach Targets - READ ONLY (set from Client Dashboard)
  const coachTargetsDisplay = useMemo(() => {
    const targets = proStore.getTargets(clientId);
    return {
      protein: targets.protein || 0,
      starchy: targets.starchyCarbs || 0,
      fibrous: targets.fibrousCarbs || 0,
      fats: targets.fat || 0,
    };
  }, [clientId]);

  // 🎯 BULLETPROOF BOARD LOADING: Cache-first, guaranteed to render
  // CHICAGO CALENDAR FIX v1.0: Using noon UTC anchor pattern
  const [weekStartISO, setWeekStartISO] = React.useState<string>(getWeekStartISOInTZ("America/Chicago"));
  const { board: hookBoard, loading: hookLoading, error, save: saveToHook, source } = useWeeklyBoard("1", weekStartISO);

  // Local mutable board state for optimistic updates
  const [board, setBoard] = React.useState<WeekBoard | null>(null);
  const boardRef = React.useRef<WeekBoard | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);

  // Draft persistence for crash/reload recovery
  const { clearDraft, skipServerSync, markClean } = useMealBoardDraft(
    {
      userId: user?.id,
      builderId: 'general-nutrition-builder',
      weekStartISO,
    },
    board,
    setBoard,
    hookLoading,
    hookBoard
  );

  // Sync hook board to local state only after loading completes (skip if draft is active)
  React.useEffect(() => {
    if (skipServerSync()) {
      return;
    }
    if (!hookLoading && !Object.is(boardRef.current, hookBoard)) {
      setBoard(hookBoard);
      boardRef.current = hookBoard;
    }
  }, [hookBoard, hookLoading, skipServerSync]);

  // Use hook's loading state directly (no local copy needed)
  const loading = hookLoading;

  // Wrapper to save with idempotent IDs
  const saveBoard = React.useCallback(async (updatedBoard: WeekBoard) => {
    setSaving(true);
    try {
      // Type assertion needed because ExtendedMeal has optional title, but schema requires it
      await saveToHook(updatedBoard as any, uuidv4());
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
      clearDraft();
      markClean();
    } catch (err) {
      console.error("Failed to save board:", err);
      // Calm, non-alarming message - will retry automatically
      toast({ title: "Saving...", description: "We'll retry automatically.", duration: 3000 });
    } finally {
      setSaving(false);
    }
  }, [saveToHook, toast, clearDraft, markClean]);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerList, setPickerList] = React.useState<"breakfast"|"lunch"|"dinner"|"snacks"|null>(null);
  const [manualModalOpen, setManualModalOpen] = React.useState(false);
  const [manualModalList, setManualModalList] = React.useState<"breakfast"|"lunch"|"dinner"|"snacks"|null>(null);
  const [showSnackModal, setShowSnackModal] = React.useState(false);
  const [showOverview, setShowOverview] = React.useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = React.useState(false);

  // NEW: Day/Week planning state
  const [planningMode, setPlanningMode] = React.useState<'day' | 'week'>('day');
  const [activeDayISO, setActiveDayISO] = React.useState<string>('');

  // Why drawer state
  const [boardWhyOpen, setBoardWhyOpen] = React.useState(false);
  const [showDuplicateDayModal, setShowDuplicateDayModal] = React.useState(false);
  const [showDuplicateWeekModal, setShowDuplicateWeekModal] = React.useState(false);

  // Shopping list v2 modal state
  const [shoppingListModal, setShoppingListModal] = useState<{ isOpen: boolean; meal: any | null }>({ isOpen: false, meal: null });

  // Snack Picker state
  const [snackPickerOpen, setSnackPickerOpen] = useState(false);

  // Snack Creator modal state (Phase 2)
  const [snackCreatorOpen, setSnackCreatorOpen] = useState(false);

  // Create With Chef modal state
  const [createWithChefOpen, setCreateWithChefOpen] = useState(false);
  const [createWithChefSlot, setCreateWithChefSlot] = useState<"breakfast" | "lunch" | "dinner">("breakfast");

  // Build StarchContext for Create With Chef modal
  const starchContext: StarchContext | undefined = useMemo(() => {
    if (!board || !activeDayISO) return undefined;
    const resolved = user?.id ? getResolvedTargets(user.id) : null;
    const strategy = resolved?.starchStrategy || 'one';
    const dayLists = getDayLists(board, activeDayISO);
    const existingMeals: StarchContext['existingMeals'] = [];
    for (const slot of ['breakfast', 'lunch', 'dinner'] as const) {
      const meals = dayLists[slot] || [];
      for (const meal of meals) {
        existingMeals.push({ slot, hasStarch: classifyMeal(meal).isStarchMeal });
      }
    }
    return { strategy, existingMeals };
  }, [board, activeDayISO, user?.id]);

  // Handler for Create With Chef meal selection
  // NOTE: slot is passed from the modal to avoid stale state issues
  const handleCreateWithChefSelect = useCallback(async (meal: any, slot: "breakfast" | "lunch" | "dinner" | "snacks") => {
    if (!board) return;

    try {
      // Add to the appropriate slot based on slot parameter from modal
      if (FEATURES.dayPlanning === 'alpha' && planningMode === 'day' && activeDayISO) {
        // Add to specific day
        const dayLists = getDayLists(board, activeDayISO);
        const updatedDayLists = {
          ...dayLists,
          [slot]: [...dayLists[slot as keyof typeof dayLists], meal]
        };
        const updatedBoard = setDayLists(board, activeDayISO, updatedDayLists);
        setBoard(updatedBoard);
        await saveBoard(updatedBoard);
      } else {
        // Week mode: update local board and save
        const updatedBoard = {
          ...board,
          lists: {
            ...board.lists,
            [slot]: [...board.lists[slot], meal]
          },
          version: board.version + 1,
          meta: {
            ...board.meta,
            lastUpdatedAt: new Date().toISOString()
          }
        };
        setBoard(updatedBoard);
        await saveBoard(updatedBoard);
      }

      // Dispatch board update event
      window.dispatchEvent(new CustomEvent("board:updated", { detail: { weekStartISO } }));
      window.dispatchEvent(new Event("macros:updated"));
      
      toast({
        title: "Meal Added!",
        description: `${meal.title || meal.name} added successfully`,
      });
    } catch (error) {
      console.error("Failed to add Create With Chef meal:", error);
      toast({
        title: "Error",
        description: "Failed to add meal. Please try again.",
        variant: "destructive"
      });
    }
  }, [board, planningMode, activeDayISO, weekStartISO, saveBoard, toast]);

  // Handler for snack selection from SnackPickerDrawer
  const handleSnackSelect = useCallback(async (snack: any) => {
    if (!board) return;

    try {
      // Add to the snacks slot
      if (FEATURES.dayPlanning === 'alpha' && planningMode === 'day' && activeDayISO) {
        // Add to specific day
        const dayLists = getDayLists(board, activeDayISO);
        const updatedDayLists = {
          ...dayLists,
          snacks: [...dayLists.snacks, snack]
        };
        const updatedBoard = setDayLists(board, activeDayISO, updatedDayLists);
        setBoard(updatedBoard);
        await saveBoard(updatedBoard);
      } else {
        // Week mode: update local board and save
        const updatedBoard = {
          ...board,
          lists: {
            ...board.lists,
            snacks: [...board.lists.snacks, snack]
          },
          version: board.version + 1,
          meta: {
            ...board.meta,
            lastUpdatedAt: new Date().toISOString()
          }
        };
        setBoard(updatedBoard);
        await saveBoard(updatedBoard);
      }

      // Dispatch board update event
      window.dispatchEvent(new CustomEvent("board:updated", { detail: { weekStartISO } }));
      window.dispatchEvent(new Event("macros:updated"));
    } catch (error) {
      console.error("Failed to add snack:", error);
      toast({
        title: "Error",
        description: "Failed to add snack. Please try again.",
        variant: "destructive"
      });
    }
  }, [board, planningMode, activeDayISO, weekStartISO, saveBoard, toast]);

  // Guided Tour state
  const [hasSeenInfo, setHasSeenInfo] = useState(false);
  const [tourStep, setTourStep] = useState<"breakfast" | "lunch" | "dinner" | "snacks" | "complete">("breakfast");

  // Daily Totals Info state (appears after first meal is created)
  const [showDailyTotalsInfo, setShowDailyTotalsInfo] = useState(false);
  const [hasSeenDailyTotalsInfo, setHasSeenDailyTotalsInfo] = useState(false);

  // Load/save tour progress from localStorage
  useEffect(() => {
    const infoSeen = localStorage.getItem("weekly-meal-board-info-seen");
    if (infoSeen === "true") {
      setHasSeenInfo(true);
    } else {
      // Auto-mark as seen since Copilot provides guidance now
      setHasSeenInfo(true);
      localStorage.setItem("weekly-meal-board-info-seen", "true");
    }

    const saved = localStorage.getItem("weekly-meal-board-tour-step");
    if (saved && saved !== "complete") {
      setTourStep(saved as "breakfast" | "lunch" | "dinner" | "snacks" | "complete");
    }

    const dailyTotalsInfoSeen = localStorage.getItem("weekly-meal-board-daily-totals-info-seen");
    if (dailyTotalsInfoSeen === "true") {
      setHasSeenDailyTotalsInfo(true);
    }
  }, []);

  const advanceTourStep = useCallback(() => {
    const sequence: Array<"breakfast" | "lunch" | "dinner" | "snacks" | "complete"> = ["breakfast", "lunch", "dinner", "snacks", "complete"];
    const currentIndex = sequence.indexOf(tourStep);
    if (currentIndex < sequence.length - 1) {
      const nextStep = sequence[currentIndex + 1];
      setTourStep(nextStep);
      localStorage.setItem("weekly-meal-board-tour-step", nextStep);
    }
  }, [tourStep]);

  // 🔋 AI Meal Creator localStorage persistence (copy Fridge Rescue pattern)
  const AI_MEALS_CACHE_KEY = "ai-meal-creator-cached-meals";

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
  // CHICAGO CALENDAR FIX v1.0: Using safe weekDatesInTZ with noon UTC anchor
  const weekDatesList = useMemo(() => {
    return weekStartISO ? weekDatesInTZ(weekStartISO, "America/Chicago") : [];
  }, [weekStartISO]);

  // Set initial active day when week loads
  // CHICAGO CALENDAR FIX v1.0: Default to today if in current week, otherwise Monday
  useEffect(() => {
    if (weekDatesList.length > 0 && !activeDayISO) {
      const todayISO = getTodayISOSafe("America/Chicago");
      const todayInWeek = weekDatesList.find((d) => d === todayISO);
      setActiveDayISO(todayInWeek ?? weekDatesList[0]);
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
    // CHICAGO CALENDAR FIX v1.0: Use safe weekDatesInTZ for target week dates
    const clonedBoard = {
      ...board,
      id: `week-${targetWeekStartISO}`,
      days: board.days ? Object.fromEntries(
        Object.entries(board.days).map(([oldDateISO, lists]) => {
          const targetWeekDatesSafe = weekDatesInTZ(targetWeekStartISO, "America/Chicago");
          const dayIndex = weekDatesList.indexOf(oldDateISO);
          const newDateISO = targetWeekDatesSafe[dayIndex] || oldDateISO;

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
      quantity: typeof i.qty === 'number' ? i.qty : (i.qty ? parseFloat(String(i.qty)) : 1),
      unit: i.unit || '',
      notes: planningMode === 'day' && activeDayISO
        ? `${formatDateDisplay(activeDayISO, { weekday: 'long' })} Meal Plan`
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
      quantity: typeof i.qty === 'number' ? i.qty : (i.qty ? parseFloat(String(i.qty)) : 1),
      unit: i.unit || '',
      notes: `Weekly Meal Plan (${formatWeekLabel(weekStartISO)}) - All 7 Days`
    }));

    useShoppingListStore.getState().addItems(items);

    toast({
      title: "Added to Shopping List",
      description: `${ingredients.length} items from entire week added to your master list`
    });
  }, [board, weekStartISO, weekDatesList, toast]);

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
      queryKey: ["/api/users", user?.id || "", "macros", "today"]
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
      <span className={`text-xs px-2 py-1 rounded-2xl border ${
        ok ? "border-lime-500/40 text-lime-300 bg-lime-500/10"
           : "border-amber-500/40 text-amber-300 bg-amber-500/10"
      }`}>
        {label}: {value} / {target}
      </span>
    );
  }

  // 🎯 Show toast when loading from cache/offline
  // Silent source tracking - no toast needed for normal operation
  React.useEffect(() => {
    if (!loading && source) {
      console.log("[Board] Loaded from source:", source);
    }
  }, [loading, source]);

  // Silent error handling - Facebook-style: no UI for transient network events
  React.useEffect(() => {
    if (error) {
      console.log("[Network] Board load encountered an issue, using cached data if available");
    }
  }, [error]);

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

  // Week navigation handlers (hook manages loading state automatically)
  const gotoWeek = useCallback(async (targetISO: string) => {
    try {
      const { weekStartISO: ws, week } = await getWeekBoardByDate(targetISO);
      setWeekStartISO(ws);
      setBoard(week);
    } catch (error) {
      console.error("Failed to load week:", error);
    }
  }, []);

  const onPrevWeek = useCallback(() => {
    if (!weekStartISO) return;
    gotoWeek(prevWeekISO(weekStartISO, "America/Chicago"));
  }, [weekStartISO, gotoWeek]);

  const onNextWeek = useCallback(() => {
    if (!weekStartISO) return;
    gotoWeek(nextWeekISO(weekStartISO, "America/Chicago"));
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
          starchyCarbs: (meal as any).starchyCarbs ?? (meal.nutrition as any)?.starchyCarbs ?? 0,
          fibrousCarbs: (meal as any).fibrousCarbs ?? (meal.nutrition as any)?.fibrousCarbs ?? 0,
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
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-32"
    >
      {/* Universal Safe-Area Header */}
      <div
        className="fixed left-0 right-0 z-50 bg-gradient-to-r from-black/40 via-orange-600/40 to-black/40 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex flex-col gap-2">
          {/* Row 1: Main Navigation */}
          <div className="flex items-center gap-2 flex-nowrap overflow-hidden">
            {/* Back Button */}
            <button
              onClick={() => setLocation(isProCareMode ? `/pro/clients/${clientId}` : "/dashboard")}
              className="flex items-center justify-center text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg text-md font-medium flex-shrink-0"
              data-testid="button-back-dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Back</span>
            </button>

            {/* Title */}
            <h1 className="text-lg font-bold text-white flex-1 min-w-0 truncate">
              General Nutrition Builder
            </h1>

            <div className="flex items-center gap-2">
              <MedicalSourcesInfo asPillButton />
              {!isProCareMode && (
                <QuickTourButton onClick={quickTour.openTour} />
              )}
            </div>
          </div>

          {/* Row 2: Client Dashboard + Guide (ProCare mode only) */}
          {isProCareMode && (
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setLocation(`/pro/clients/${clientId}`)}
                className="flex items-center text-white/90 hover:bg-white/10 transition-all duration-200 px-3 py-1.5 rounded-lg text-sm font-medium"
                data-testid="button-client-dashboard-text"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Client Dashboard</span>
              </button>

              <QuickTourButton onClick={quickTour.openTour} />
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div
        className="max-w-[1600px] mx-auto px-4 space-y-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8rem)" }}
      >
      <div className="mb-6 border border-zinc-800 bg-zinc-900/60 backdrop-blur rounded-2xl">
        <div className="px-4 py-4 flex flex-col gap-3">

          {/* ROW 1: Week Navigation */}
          <div className="flex items-center justify-center">
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
          </div>

          {/* ROW 2: Title (Centered) */}
          <h1 className="text-center text-2xl font-semibold text-white">

          </h1>

          {/* ROW 3: Day/Week Toggle + Duplicate */}
          {FEATURES.dayPlanning === 'alpha' && (
            <div className="flex items-center justify-between gap-3">
              <DayWeekToggle mode={planningMode} onModeChange={setPlanningMode} />

              {planningMode === 'day' && (
              <button
                type="button"
                onClick={() => setShowDuplicateDayModal(true)}
                data-testid="duplicate-button"
                className="
                  flex-shrink-0 inline-flex flex-col items-center justify-center
                  rounded-full
                  px-4 py-2
                  text-sm font-semibold
                  text-white/90
                  bg-black/20
                  border border-white/15
                  backdrop-blur-lg
                  hover:bg-white/10 hover:border-white/25
                  transition-all
                "
                style={{ minHeight: 48 }}
              >
                <span className="leading-none">Duplicate</span>
                <span className="mt-1 text-base leading-none opacity-80">📅</span>
              </button>
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

          {/* Daily Starch Indicator - Shows starch meal slots */}
          {FEATURES.dayPlanning === 'alpha' &&
            planningMode === 'day' &&
            activeDayISO &&
            board && (
              <div className="flex justify-center">
                <DailyStarchIndicator 
                  meals={(() => {
                    const dayLists = getDayLists(board, activeDayISO);
                    return [
                      ...dayLists.breakfast,
                      ...dayLists.lunch,
                      ...dayLists.dinner,
                      ...dayLists.snacks,
                    ];
                  })()}
                />
              </div>
            )}

          {/* ROW 5: Bottom Actions (Delete All + Save) */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowDeleteAllConfirm(true)}
              className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded-xl"
            >
              Delete All
            </Button>
            
            <AlertDialog open={showDeleteAllConfirm} onOpenChange={setShowDeleteAllConfirm}>
              <AlertDialogContent className="bg-zinc-900 border-zinc-700">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">Delete All Meals</AlertDialogTitle>
                  <AlertDialogDescription className="text-zinc-400">
                    Delete all meals from this board? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-zinc-800 text-white border-zinc-600 hover:bg-zinc-700">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => {
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
                        toast({
                          title: "All Meals Deleted",
                          description: "Successfully cleared all meals from the board",
                        });
                      }
                    }}
                    className="bg-red-600 text-white hover:bg-red-700"
                  >
                    Delete All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              onClick={handleSave}
              disabled={saving || justSaved}
              size="sm"
              className={`${
                justSaved
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                  : "bg-emerald-600/80 hover:bg-emerald-600 text-white"
              } text-xs px-3 py-1 rounded-xl transition-all duration-200`}
              data-wt="wmb-save-week-button"
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

      <div className="pb-10 grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        {/* Render day view or week view based on mode */}
        {FEATURES.dayPlanning === 'alpha' && planningMode === 'day' && activeDayISO && board ? (
          // DAY MODE: Show only the active day's meals
          (() => {
            const dayLists = getDayLists(board, activeDayISO);
            // Map over the standard lists, but use dayLists for meal data
            return lists.map(([key, label]) => (
              <section key={key} data-meal-id={key === "snacks" ? "snack1" : key} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white/90 text-lg font-medium">{label}</h2>
                  <div className="flex gap-2">
                    {/* AI Meal Creator button - hidden by feature flag for launch */}
                    {FEATURES.showCreateWithAI && key !== "snacks" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white/80 hover:bg-black/50 border border-pink-400/30 text-xs font-medium flex items-center gap-1 flash-border"
                        onClick={() => {
                          setAiMealSlot(key as "breakfast" | "lunch" | "dinner" | "snacks");
                          setAiMealModalOpen(true);
                        }}
                        data-wt="wmb-create-ai-button"
                      >
                        <Sparkles className="h-3 w-3" />
                        Create with AI
                      </Button>
                    )}

                    {/* Create with Chef button - Only for Breakfast, Lunch, Dinner */}
                    {(key === "breakfast" || key === "lunch" || key === "dinner") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white/80 hover:bg-black/50 border border-orange-400/40 text-xs font-medium flex items-center gap-1 flash-border"
                        onClick={() => {
                          setCreateWithChefSlot(key as "breakfast" | "lunch" | "dinner");
                          setCreateWithChefOpen(true);
                        }}
                        data-wt="wmb-create-chef-button"
                      >
                        <Sparkles className="h-3 w-3" />
                        Create with Chef
                      </Button>
                    )}

                    {/* Snack Creator button for snacks section only */}
                    {key === "snacks" && (
                      <SnackCreatorButton
                        onClick={() => setSnackCreatorOpen(true)}
                      />
                    )}

                    {/* Plus button for manual entry */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white/80 hover:bg-white/10"
                      onClick={() => openManualModal(key)}
                      data-wt="wmb-add-custom-button"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>

                    {/* Log Snack button hidden - using macro logger instead */}
                  </div>
                </div>

                <div className="space-y-3">
                  {dayLists[key as keyof typeof dayLists].map((meal: Meal, idx: number) => (
                    <MealCard
                      key={meal.id}
                      date={activeDayISO}
                      slot={key}
                      meal={meal}
                      data-wt="wmb-meal-card"
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
                          setBoard(updatedBoard);
                          putWeekBoard(weekStartISO, updatedBoard)
                            .then(({ week }) => {
                              if (week) setBoard(week);
                            })
                            .catch((err) => {
                              console.error("❌ Delete sync failed (Day mode):", err);
                              toast({
                                title: "Sync pending",
                                description: "Changes will sync automatically.",
                              });
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
                      <p className="text-xs text-white/40">Use "Create with Chef" or "+" to add meals</p>
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
                {/* Snack Creator button for snacks section only */}
                {key === "snacks" && (
                  <SnackCreatorButton
                    onClick={() => setSnackCreatorOpen(true)}
                  />
                )}

                {/* Plus button for manual entry */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white/80 hover:bg-white/10"
                  onClick={() => openManualModal(key)}
                >
                  <Plus className="h-4 w-4" />
                </Button>

                {/* Log Snack button hidden - using macro logger instead */}
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
                        console.error("❌ Delete sync failed (Board mode):", err);
                        toast({
                          title: "Sync pending",
                          description: "Changes will sync automatically.",
                        });
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
                  <p className="text-xs text-white/40">Use "Create with Chef" or "+" to add meals</p>
                </div>
              )}
            </div>
          </section>
          ))
        )}

        {/* ================================
            COACH TARGETS (General Nutrition Builder) - READ ONLY
            Set from Client Dashboard
        ==================================== */}
        <div className="col-span-full mt-6 rounded-2xl bg-black/30 backdrop-blur-xl border border-white/20 p-6">
          <h2 className="text-white text-lg font-bold mb-4 flex items-center gap-2">
            🎯 Coach Targets
          </h2>

          <div className="grid grid-cols-2 gap-4">
            {/* Protein */}
            <div className="flex flex-col">
              <label className="text-sm text-white/70 mb-1">Protein (g)</label>
              <div className="bg-black/40 border border-white/20 text-white rounded-xl px-3 py-2">
                {coachTargetsDisplay.protein}
              </div>
            </div>

            {/* Starchy Carbs */}
            <div className="flex flex-col">
              <label className="text-sm text-white/70 mb-1">Starchy Carbs (g)</label>
              <div className="bg-black/40 border border-white/20 text-white rounded-xl px-3 py-2">
                {coachTargetsDisplay.starchy}
              </div>
            </div>

            {/* Fibrous Carbs */}
            <div className="flex flex-col">
              <label className="text-sm text-white/70 mb-1">Fibrous Carbs (g)</label>
              <div className="bg-black/40 border border-white/20 text-white rounded-xl px-3 py-2">
                {coachTargetsDisplay.fibrous}
              </div>
            </div>

            {/* Fats */}
            <div className="flex flex-col">
              <label className="text-sm text-white/70 mb-1">Fats (g)</label>
              <div className="bg-black/40 border border-white/20 text-white rounded-xl px-3 py-2">
                {coachTargetsDisplay.fats}
              </div>
            </div>
          </div>

          <p className="mt-4 text-sm text-white/60 text-center">
            Set targets from Client Dashboard
          </p>
        </div>

        {/* Pro Tip Card */}
        <ProTipCard />

        {/* Daily Targets Card */}
        <div className="col-span-full">
          <DailyTargetsCard
            userId={user?.id}
            showQuickAddButton={false}
            targetsOverride={(() => {
              const coachTargets = proStore.getTargets(clientId);
              const totalCarbs = (coachTargets.starchyCarbs || 0) + (coachTargets.fibrousCarbs || 0);
              return {
                protein_g: coachTargets.protein,
                carbs_g: totalCarbs,
                fat_g: coachTargets.fat,
                starchyCarbs_g: coachTargets.starchyCarbs || 0,
                fibrousCarbs_g: coachTargets.fibrousCarbs || 0,
              };
            })()}
          />
        </div>

        {/* Remaining Macros Footer - Inline Mode */}
        {board &&
          FEATURES.dayPlanning === "alpha" &&
          planningMode === "day" &&
          activeDayISO && (() => {
            const dayLists = getDayLists(board, activeDayISO);
            const computeSlotMacros = (meals: Meal[]) => ({
              count: meals.length,
              calories: meals.reduce((sum, m) => sum + (m.nutrition?.calories || 0), 0),
              protein: meals.reduce((sum, m) => sum + (m.nutrition?.protein || 0), 0),
              carbs: meals.reduce((sum, m) => sum + (m.nutrition?.carbs || 0), 0),
              fat: meals.reduce((sum, m) => sum + (m.nutrition?.fat || 0), 0),
              starchyCarbs: meals.reduce((sum, m) => sum + ((m as any).starchyCarbs ?? m.nutrition?.starchyCarbs ?? 0), 0),
              fibrousCarbs: meals.reduce((sum, m) => sum + ((m as any).fibrousCarbs ?? m.nutrition?.fibrousCarbs ?? 0), 0),
            });
            const slots = {
              breakfast: computeSlotMacros(dayLists.breakfast),
              lunch: computeSlotMacros(dayLists.lunch),
              dinner: computeSlotMacros(dayLists.dinner),
              snacks: computeSlotMacros(dayLists.snacks),
            };
            const consumed = {
              calories: slots.breakfast.calories + slots.lunch.calories + slots.dinner.calories + slots.snacks.calories,
              protein: slots.breakfast.protein + slots.lunch.protein + slots.dinner.protein + slots.snacks.protein,
              carbs: slots.breakfast.carbs + slots.lunch.carbs + slots.dinner.carbs + slots.snacks.carbs,
              fat: slots.breakfast.fat + slots.lunch.fat + slots.dinner.fat + slots.snacks.fat,
              starchyCarbs: slots.breakfast.starchyCarbs + slots.lunch.starchyCarbs + slots.dinner.starchyCarbs + slots.snacks.starchyCarbs,
              fibrousCarbs: slots.breakfast.fibrousCarbs + slots.lunch.fibrousCarbs + slots.dinner.fibrousCarbs + slots.snacks.fibrousCarbs,
            };
            const dayAlreadyLocked = isDayLocked(activeDayISO, user?.id);
            
            // Get coach targets from proStore for this client
            const coachTargets = proStore.getTargets(clientId);
            const totalCarbs = (coachTargets.starchyCarbs || 0) + (coachTargets.fibrousCarbs || 0);
            const totalCalories = (coachTargets.protein * 4) + (totalCarbs * 4) + (coachTargets.fat * 9);
            const targetsForFooter = {
              calories: totalCalories,
              protein_g: coachTargets.protein,
              carbs_g: totalCarbs,
              fat_g: coachTargets.fat,
              starchyCarbs_g: coachTargets.starchyCarbs || 0,
              fibrousCarbs_g: coachTargets.fibrousCarbs || 0,
            };
            
            return (
              <div className="col-span-full mb-6">
                <RemainingMacrosFooter
                  consumedOverride={consumed}
                  targetsOverride={targetsForFooter}
                  showSaveButton={!dayAlreadyLocked}
                  layoutMode="inline"
                  onSaveDay={async () => {
                    const targets = {
                      calories: targetsForFooter.calories,
                      protein_g: targetsForFooter.protein_g,
                      carbs_g: targetsForFooter.carbs_g,
                      fat_g: targetsForFooter.fat_g,
                    };
                    const result = await lockDay({
                      dateISO: activeDayISO,
                      targets,
                      consumed,
                      slots,
                    }, user?.id);
                    
                    if (result.alreadyLocked) {
                      toast({
                        title: "Already Locked",
                        description: result.message,
                        variant: "destructive",
                      });
                    } else {
                      setQuickView({
                        protein: consumed.protein,
                        carbs: consumed.carbs,
                        fat: consumed.fat,
                        calories: consumed.calories,
                        dateISO: activeDayISO,
                      });
                      toast({
                        title: "Day Saved to Coach Targets",
                        description: `${formatDateDisplay(activeDayISO, { weekday: 'long', month: 'short', day: 'numeric' })} has been locked.`,
                      });
                      setLocation(`/pro/clients/${clientId}/dashboard?tab=targets`);
                    }
                  }}
                />
              </div>
            );
          })()}

        {/* Bottom spacing */}
        <div className="col-span-full h-18" />

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

      {/* Snack Picker Drawer - Normal healthy snacks for general nutrition */}
      <SnackPickerDrawer
        open={snackPickerOpen}
        onClose={() => setSnackPickerOpen(false)}
        onSnackSelect={handleSnackSelect}
        dietType="normal"
      />

      {/* Snack Creator Modal (Phase 2 - craving to healthy snack) - with general nutrition guardrails */}
      <SnackCreatorModal
        open={snackCreatorOpen}
        onOpenChange={setSnackCreatorOpen}
        onSnackGenerated={handleSnackSelect}
        dietType="general-nutrition"
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
          const dayName = formatDateDisplay(activeDayISO, { weekday: 'long' });

          return (
            <div className="fixed bottom-0 left-0 right-0 z-[60] bg-gradient-to-r from-zinc-900/95 via-zinc-800/95 to-black/95 backdrop-blur-xl shadow-2xl safe-area-inset-bottom">
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
                  source="Weekly Meal Board"
                  sourceSlug="weekly-meal-board"
                />
              );
            })()}

      {/* Daily Totals Info Modal - Next Steps After First Meal */}
      <Dialog open={showDailyTotalsInfo} onOpenChange={(open) => {
        if (!open) {
          setShowDailyTotalsInfo(false);
          setHasSeenDailyTotalsInfo(true);
          localStorage.setItem("weekly-meal-board-daily-totals-info-seen", "true");
        }
      }}>
        <DialogContent className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 text-white max-w-md mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white text-xl flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-orange-400" />
              Next Steps - Track Your Progress!
            </DialogTitle>
          </DialogHeader>
          <div className="text-white/90 text-sm space-y-4">
            <p className="text-base font-semibold text-white">
              Great job creating your meals! Here's what to do next:
            </p>

            <div className="space-y-3">
              <div className="bg-black/30 p-3 rounded-lg border border-white/10">
                <p className="font-semibold text-white mb-1 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-orange-400" />
                  Option 1: Track Your Macros
                </p>
                <p className="text-white/70 text-xs">
                  Send your day to the Macro Calculator to ensure you're hitting your nutrition targets.
                  Look for the "Send to Macros" button below.
                </p>
              </div>

              <div className="bg-black/30 p-3 rounded-lg border border-white/10">
                <p className="font-semibold text-white mb-1">
                  Option 2: Plan Your Week
                </p>
                <p className="text-white/70 text-xs">
                  Use the Day/Week toggle at the top to switch between planning a single day or your entire week.
                  You can duplicate days or create each day individually.
                </p>
              </div>

              <div className="bg-black/30 p-3 rounded-lg border border-white/10">
                <p className="font-semibold text-white mb-1">
                  💡 Pro Tip: Macro Tracking
                </p>
                <p className="text-white/70 text-xs">
                  Send just ONE day to macros at a time (not the whole week).
                  This way, if you change meals on other days, you won't have outdated data.
                </p>
              </div>

              <div className="bg-black/30 p-3 rounded-lg border border-white/10">
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

      {/* Create With Chef Modal */}
      <CreateWithChefModal
        open={createWithChefOpen}
        onOpenChange={setCreateWithChefOpen}
        mealType={createWithChefSlot}
        onMealGenerated={handleCreateWithChefSelect}
        starchContext={starchContext}
      />

      {/* Quick Tour Modal */}
      <QuickTourModal
        isOpen={quickTour.shouldShow}
        onClose={quickTour.closeTour}
        title="General Nutrition Builder"
        steps={GENERAL_NUTRITION_TOUR_STEPS}
        onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
      />
      </div>
    </motion.div>
  );
}