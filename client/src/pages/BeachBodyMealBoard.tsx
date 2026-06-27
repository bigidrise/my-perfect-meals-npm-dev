import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { buildBiometricsUrl } from "@/lib/biometricsNavigation";
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
import { usePageTitle } from "@/contexts/PageTitleContext";
import { MealCard, Meal } from "@/components/MealCard";
import {
  type WeekBoard,
  getDayLists,
  setDayLists,
  cloneDayLists,
  putWeekBoard,
  getWeekBoardByDate,
  updateMealImageInBoard,
  getMealImageUrl,
  mergeImageUrlsOnly,
} from "@/lib/boardApi";
import { useChefMealImage } from "@/hooks/useChefMealImage";
import { duplicateAcrossWeeks } from "@/utils/crossWeekDuplicate";
import { AddOwnMealButton } from "@/components/pickers/AddOwnMealButton";
import { AthleteMealPickerDrawer } from "@/components/pickers/AthleteMealPickerDrawer";
import MealPremadePicker from "@/components/pickers/MealPremadePicker";
import {
  RemainingMacrosFooter,
  type ConsumedMacros,
} from "@/components/biometrics/RemainingMacrosFooter";
import { DailyTargetsCard } from "@/components/biometrics/DailyTargetsCard";
import { ProTipCard } from "@/components/ProTipCard";
import { LockedDayDialog } from "@/components/biometrics/LockedDayDialog";
import { lockDay, isDayLocked } from "@/lib/lockedDays";
import { setQuickView } from "@/lib/macrosQuickView";
import { getMacroTargets } from "@/lib/dailyLimits";
import { getResolvedTargets } from "@/lib/macroResolver";
import { classifyMeal } from "@/utils/starchMealClassifier";
import type { StarchContext } from "@/hooks/useCreateWithChefRequest";
import { useAuth } from "@/contexts/AuthContext";
import { useBodyFatStarchAdjustment } from "@/hooks/useBodyFatStarchAdjustment";
import WeeklyOverviewModal from "@/components/WeeklyOverviewModal";
import BuilderShoppingBar from "@/components/BuilderShoppingBar";
import { useToast } from "@/hooks/use-toast";
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
import { getRolling14Days } from "@/utils/dateRange";
import ShoppingListPreviewModal from "@/components/ShoppingListPreviewModal";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useWeeklyBoard } from "@/hooks/useWeeklyBoard";
import { BUILDER_NS } from "@shared/builderNamespaces";
import { setActiveBuilderNs } from "@/lib/activeBuilderNs";
// CHICAGO CALENDAR FIX v1.0: getMondayISO replaced with getWeekStartISOInTZ from midnight.ts
import { v4 as uuidv4 } from "uuid";
import {
  Check,
  Sparkles,
  Calendar,
  BarChart3,
  ShoppingCart,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  Info,
  ChefHat,
  Save,
} from "lucide-react";
import { FEATURES } from "@/utils/features";
import { apiRequest } from "@/lib/queryClient";
import { DayChips } from "@/components/DayChips";
import { DailyStarchIndicator } from "@/components/DailyStarchIndicator";

import { DuplicateDayModal } from "@/components/DuplicateDayModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AdditionalMacrosModal from "@/components/modals/AdditionalMacrosModal";
import { CreateWithChefButton } from "@/components/CreateWithChefButton";
import { CreateWithChefModal } from "@/components/CreateWithChefModal";
import { SnackCreatorModal } from "@/components/SnackCreatorModal";
import { SnackCreatorButton } from "@/components/SnackCreatorButton";
import { GlobalMealActionBar } from "@/components/GlobalMealActionBar";
import { useNavigateToFavorites } from "@/hooks/useNavigateToFavorites";
import { computeTargetsFromOnboarding } from "@/lib/targets";
import { useTodayMacros } from "@/hooks/useTodayMacros";
import { useNutritionBudget } from "@/hooks/useNutritionBudget";
import { useOnboardingProfile } from "@/hooks/useOnboardingProfile";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { NutritionBudgetBanner } from "@/components/NutritionBudgetBanner";
import { HowThisWorksLink } from "@/components/ui/HowThisWorksLink";
import { PillButton } from "@/components/ui/pill-button";
import { BuilderHeader } from "@/components/pro/BuilderHeader";
import { TrialBanner } from "@/components/TrialBanner";

const BEACHBODY_TOUR_STEPS: TourStep[] = [
  {
    icon: "1",
    title: "Fill Your Meals",
    description:
      "Add Meal 1, 2, and 3 using AI-generated recipes or athlete-focused premades.",
  },
  {
    icon: "2",
    title: "Add Extra Meals",
    description:
      "Tap 'Add Meal 4+' for additional meals to hit your calorie targets.",
  },
  {
    icon: "3",
    title: "Duplicate Days",
    description:
      "Copy your day's meals to other days for quick meal prep planning.",
  },
  {
    icon: "4",
    title: "Track Macros",
    description:
      "Send your meals to the Macro Calculator for precise nutrition tracking.",
  },
  {
    icon: "5",
    title: "Build Shopping List",
    description:
      "Export all ingredients to your shopping list for easy grocery runs.",
  },
  {
    icon: "6",
    title: "Track Progress at Bottom",
    description:
      "The bottom bar shows color-coded progress: green = on track, yellow = close, red = over. Tap 'Save Day' to lock your day to Biometrics.",
  },
  {
    icon: "🥔",
    title: "Watch Your Starch Slots",
    description:
      "The starch indicator shows your daily starch meal status. Green = slots available, Orange = all used, Red = over limit. Fibrous carbs are unlimited!",
  },
  {
    icon: "*",
    title: "What the Asterisks Mean",
    description:
      "Protein and carbs are marked with asterisks (*) because they're the most important numbers to focus on when building your meals. Get those right first.",
  },
];

// Helper function to create new snacks
function makeNewSnack(nextIndex: number): Meal {
  return {
    id: `snk-${Date.now()}`,
    title: "Snack",
    servings: 1,
    ingredients: [],
    instructions: [],
    nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  };
}

// CHICAGO CALENDAR FIX v1.0: All date utilities now imported from midnight.ts
// Using noon UTC anchor pattern to prevent day-shift bugs

// Fixed Meal Slots (6 meals)
const lists: Array<["breakfast" | "lunch" | "dinner" | "meal4" | "meal5" | "meal6", string]> = [
  ["breakfast", "Meal 1"],
  ["lunch", "Meal 2"],
  ["dinner", "Meal 3"],
  ["meal4", "Meal 4"],
  ["meal5", "Meal 5"],
  ["meal6", "Meal 6"],
];

export default function BeachBodyMealBoard() {
  usePageTitle("Performance Nutrition Builder");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const quickTour = useQuickTour("beach-body-meal-board");
  const { user } = useAuth();
  
  // Body fat-based starch slot adjustment
  const bodyFatAdjustment = useBodyFatStarchAdjustment("beach_body");

  // Get current user ID
  const getCurrentUserId = () => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        return user.id;
      } catch {
        return null;
      }
    }
    return null;
  };

  const clientId = getCurrentUserId();

  const [, proParams] = useRoute("/pro/clients/:id/beach-body-builder");
  const proClientId = proParams?.id;

  const effectiveUserId = proClientId || user?.id;

  // Board loading
  // CHICAGO CALENDAR FIX v1.0: Using noon UTC anchor pattern
  const [weekStartISO, setWeekStartISO] =
    React.useState<string>(getWeekStartISOInTZ("America/Chicago"));
  const {
    board: hookBoard,
    loading: hookLoading,
    error,
    save: saveToHook,
    refresh: refreshBoard,
    primeCache,
  } = useWeeklyBoard(clientId, weekStartISO, proClientId, BUILDER_NS.BEACH_BODY);

  // Register this builder's board namespace so cross-context features (Add to Plan, etc.) write to the correct board
  React.useEffect(() => {
    setActiveBuilderNs(BUILDER_NS.BEACH_BODY);
  }, []);

  const [board, setBoard] = React.useState<WeekBoard | null>(null);
  const boardRef = React.useRef<WeekBoard | null>(null);
  const { fetchImageForMeal } = useChefMealImage();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);
  const isDesktop = useIsDesktop();

  // Reset the initial-hydration gate whenever the viewed week changes so
  // incoming server data for the new week always paints fresh.
  React.useEffect(() => {
    boardRef.current = null;
  }, [weekStartISO]);

  React.useEffect(() => {
    if (!hookLoading && hookBoard) {
      if (!boardRef.current) {
        // First load for this week: always use server data directly.
        setBoard(hookBoard as any);
        boardRef.current = hookBoard as any;
        setLoading(false);
        return;
      }
      // Subsequent server syncs: preserve any locally-set S3 imageUrls that
      // the server may not have persisted yet (e.g. image just generated and
      // save is still in flight). mergeImageUrlsOnly starts from the local
      // board and only upgrades meals that gain an S3 url from the server.
      setBoard(prev => {
        if (!prev) return hookBoard as any;
        return mergeImageUrlsOnly(prev, hookBoard as any);
      });
    }
    setLoading(hookLoading);
  }, [hookBoard, hookLoading]);

  const saveBoard = React.useCallback(
    async (updatedBoard: WeekBoard) => {
      setSaving(true);
      try {
        await saveToHook(updatedBoard as any, uuidv4());
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
      } catch (err) {
        console.error("Failed to save board:", err);
      } finally {
        setSaving(false);
      }
    },
    [saveToHook],
  );

  // Manual save handler for Save Plan button
  const handleSave = React.useCallback(async () => {
    if (!board) return;
    await saveBoard(board);
  }, [board, saveBoard]);

  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerList, setPickerList] = React.useState<
    "breakfast" | "lunch" | "dinner" | "snacks" | null
  >(null);
  const [showOverview, setShowOverview] = React.useState(false);

  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  // Day/Week planning state - MUST be defined before callbacks that use them
  const [planningMode, setPlanningMode] = React.useState<"day" | "week">("day");
  const [activeDayISO, setActiveDayISO] = React.useState<string>("");

  // Locked day dialog state
  const [lockedDayDialogOpen, setLockedDayDialogOpen] = useState(false);
  const [pendingLockedDayISO, setPendingLockedDayISO] = useState<string>("");

  // Guard function: checks if current day is locked before allowing edits
  const checkLockedDay = useCallback(
    (forDayISO?: string): boolean => {
      const dayToCheck = forDayISO || activeDayISO;
      if (
        planningMode === "day" &&
        dayToCheck &&
        isDayLocked(dayToCheck, effectiveUserId)
      ) {
        setPendingLockedDayISO(dayToCheck);
        setLockedDayDialogOpen(true);
        return true; // Day is locked, block edit
      }
      return false; // Day is not locked, allow edit
    },
    [activeDayISO, planningMode, effectiveUserId],
  );

  // Handle "Go to Today" from locked day dialog
  const handleGoToToday = useCallback(() => {
    const today = todayISOInTZ("America/Chicago");
    setActiveDayISO(today);
    setLockedDayDialogOpen(false);
    setPendingLockedDayISO("");
  }, []);

  // AI Premade Picker state (competition meals)
  const [premadePickerOpen, setPremadePickerOpen] = useState(false);
  const [premadePickerSlot, setPremadePickerSlot] = useState<
    "breakfast" | "lunch" | "dinner" | "snacks" | "meal4" | "meal5" | "meal6"
  >("breakfast");

  // Create With Chef modal state
  const [createWithChefOpen, setCreateWithChefOpen] = useState(false);
  const [createWithChefSlot, setCreateWithChefSlot] = useState<
    "breakfast" | "lunch" | "dinner" | "meal4" | "meal5" | "meal6"
  >("breakfast");

  // Build StarchContext for Create With Chef modal
  const starchContext: StarchContext | undefined = useMemo(() => {
    if (!board || !activeDayISO) return undefined;
    const resolved = effectiveUserId ? getResolvedTargets(effectiveUserId) : null;
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
  }, [board, activeDayISO, effectiveUserId]);

  // Snack Creator modal state (Phase 2)
  const [snackCreatorOpen, setSnackCreatorOpen] = useState(false);

  const goToFavorites = useNavigateToFavorites();

  const [aiMealSlot, setAiMealSlot] = useState<"breakfast" | "lunch" | "dinner" | "snacks" | "meal4" | "meal5" | "meal6">("breakfast");
  const [aiMealModalOpen, setAiMealModalOpen] = useState(false);

  // Guided Tour state
  const [hasSeenInfo, setHasSeenInfo] = useState(false);
  const [tourStep, setTourStep] = useState<
    "breakfast" | "lunch" | "dinner" | "snacks" | "complete"
  >("breakfast");

  const [showDuplicateDayModal, setShowDuplicateDayModal] =
    React.useState(false);

  // Carb cycle state — fetched on mount and passed to AthleteMealPickerDrawer so the
  // carb budget bar and meal-dimming filter activate whenever a low_carb or refeed
  // phase is active.
  // Cached in sessionStorage so the bar appears instantly on reload with no extra
  // network call. The cache is invalidated whenever a carb-cycle write succeeds
  // (see PerformanceNutritionHub.tsx submitCarbLog / handleRefeedToggle).
  const CARB_CYCLE_CACHE_KEY = "mpm.carbCyclePickerState";

  function readCarbCycleCache(): { phase: string; carbTargetG: number } | null {
    try {
      const raw = sessionStorage.getItem(CARB_CYCLE_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (
        (parsed.phase === "low_carb" || parsed.phase === "refeed") &&
        typeof parsed.carbTargetG === "number" &&
        parsed.carbTargetG > 0
      ) {
        return parsed;
      }
    } catch {}
    return null;
  }

  const [carbCyclePickerState, setCarbCyclePickerState] = useState<{ phase: string; carbTargetG: number } | null>(
    () => readCarbCycleCache()
  );

  const [hasCoachLink, setHasCoachLink] = useState(false);

  useEffect(() => {
    apiRequest("/api/client/tablet")
      .then(() => setHasCoachLink(true))
      .catch(() => setHasCoachLink(false));
  }, []);

  useEffect(() => {
    // Skip the network call when valid cached state is already available —
    // the cache is cleared by write paths so stale data won't linger.
    if (readCarbCycleCache()) return;

    apiRequest("/api/performance/carb-cycle")
      .then((data: any) => {
        const phase = data?.state?.phase;
        const carbTargetG = data?.state?.carbTargetG;
        if ((phase === "low_carb" || phase === "refeed") && carbTargetG > 0) {
          const next = { phase, carbTargetG };
          setCarbCyclePickerState(next);
          try { sessionStorage.setItem(CARB_CYCLE_CACHE_KEY, JSON.stringify(next)); } catch {}
        } else {
          setCarbCyclePickerState(null);
          try { sessionStorage.removeItem(CARB_CYCLE_CACHE_KEY); } catch {}
        }
      })
      .catch((err: unknown) => {
        console.warn("[BeachBodyMealBoard] Failed to fetch carb cycle state:", err);
      });
  }, []);

  // Shopping list modal state
  const [shoppingListModal, setShoppingListModal] = useState<{
    isOpen: boolean;
    meal: any | null;
  }>({ isOpen: false, meal: null });

  // Track current dynamic slot for meal additions (legacy, kept for premade picker compat)
  const [currentDynamicSlot, setCurrentDynamicSlot] = useState<number | null>(
    null,
  );

  // Open premade picker for a specific slot
  const handleOpenPremadePicker = useCallback(
    (
      slot: "breakfast" | "lunch" | "dinner" | "snacks",
      dynamicSlotNumber?: number,
    ) => {
      setPremadePickerSlot(slot);
      setCurrentDynamicSlot(dynamicSlotNumber || null);
      setPremadePickerOpen(true);
    },
    [],
  );

  // Handle premade meal selection
  const handlePremadeSelect = useCallback(
    async (meal: Meal) => {
      if (!board) return;

      // Guard: Check if day is locked before allowing edits
      if (checkLockedDay()) return;

      try {
        // Generate proper ID with dynamic slot prefix if applicable
        const mealId = currentDynamicSlot
          ? `bb-dyn-${currentDynamicSlot}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          : meal.id ||
            `premade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const mealWithId = {
          ...meal,
          id: mealId,
        };

        if (
          FEATURES.dayPlanning === "alpha" &&
          planningMode === "day" &&
          activeDayISO
        ) {
          const dayLists = getDayLists(board, activeDayISO);
          const updatedDayLists = {
            ...dayLists,
            [premadePickerSlot]: [...dayLists[premadePickerSlot], mealWithId],
          };
          const updatedBoard = setDayLists(
            board,
            activeDayISO,
            updatedDayLists,
          );
          await saveBoard(updatedBoard);
        } else {
          const updatedBoard = {
            ...board,
            lists: {
              ...board.lists,
              [premadePickerSlot]: [
                ...board.lists[premadePickerSlot],
                mealWithId,
              ],
            },
          };
          await saveBoard(updatedBoard);
        }

        toast({
          title: "Meal Added",
          description: `${meal.title || meal.name} added to your plan`,
        });
        setPremadePickerOpen(false);
        setCurrentDynamicSlot(null);
      } catch (err) {
        console.error("Failed to add premade meal:", err);
        toast({
          title: "Error",
          description: "Failed to add meal",
          variant: "destructive",
        });
      }
    },
    [
      board,
      planningMode,
      activeDayISO,
      premadePickerSlot,
      currentDynamicSlot,
      saveBoard,
      toast,
    ],
  );

  // Additional Macros modal state
  const [additionalMacrosOpen, setAdditionalMacrosOpen] = useState(false);

  // AI Meals cache
  const AI_MEALS_CACHE_KEY = "ai-beach-body-meal-creator-cached-meals";

  interface CachedAIMeals {
    meals: Meal[];
    dayISO: string;
    slot: "breakfast" | "lunch" | "dinner" | "snacks";
    generatedAtISO: string;
  }

  function saveAIMealsCache(
    meals: Meal[],
    dayISO: string,
    slot: "breakfast" | "lunch" | "dinner" | "snacks",
  ) {
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

  function clearAIMealsCache() {
    try {
      localStorage.removeItem(AI_MEALS_CACHE_KEY);
    } catch {}
  }

  // CHICAGO CALENDAR FIX v1.0: Using safe weekDatesInTZ with noon UTC anchor
  const weekDatesList = useMemo(() => {
    return weekStartISO ? weekDatesInTZ(weekStartISO, "America/Chicago") : [];
  }, [weekStartISO]);

  // CHICAGO CALENDAR FIX v1.0: Default to today if in current week, otherwise Monday
  useEffect(() => {
    if (weekDatesList.length > 0 && !activeDayISO) {
      const todayISO = getTodayISOSafe("America/Chicago");
      const todayInWeek = weekDatesList.find((d) => d === todayISO);
      setActiveDayISO(todayInWeek ?? weekDatesList[0]);
    }
  }, [weekDatesList, activeDayISO]);

  useEffect(() => {
    if (!board || !activeDayISO) return;

    const cached = loadAIMealsCache();
    if (cached && cached.dayISO === activeDayISO && cached.meals.length > 0) {
      const dayLists = getDayLists(board, activeDayISO);
      const targetSlot = cached.slot || "breakfast";
      const existingSlotMeals = dayLists[targetSlot].filter(
        (m) => !m.id.startsWith("ai-meal-"),
      );
      const updatedSlotMeals = [...existingSlotMeals, ...cached.meals];
      const updatedDayLists = { ...dayLists, [targetSlot]: updatedSlotMeals };
      const updatedBoard = setDayLists(board, activeDayISO, updatedDayLists);

      setBoard(updatedBoard);
    }
  }, [board, activeDayISO]);

  useEffect(() => {
    const infoSeen = localStorage.getItem("beach-body-board-info-seen");
    if (infoSeen === "true") {
      setHasSeenInfo(true);
    }

    const savedStep = localStorage.getItem("beach-body-board-tour-step");
    if (
      savedStep === "breakfast" ||
      savedStep === "lunch" ||
      savedStep === "dinner" ||
      savedStep === "snacks" ||
      savedStep === "complete"
    ) {
      setTourStep(savedStep);
    }
  }, []);

  useEffect(() => {
    if (!board) return;

    const lists =
      planningMode === "day" && activeDayISO
        ? getDayLists(board, activeDayISO)
        : board.lists;

    if (tourStep === "breakfast" && lists.breakfast.length > 0) {
      setTourStep("lunch");
      localStorage.setItem("beach-body-board-tour-step", "lunch");
    } else if (tourStep === "lunch" && lists.lunch.length > 0) {
      setTourStep("dinner");
      localStorage.setItem("beach-body-board-tour-step", "dinner");
    } else if (tourStep === "dinner" && lists.dinner.length > 0) {
      setTourStep("snacks");
      localStorage.setItem("beach-body-board-tour-step", "snacks");
    } else if (tourStep === "snacks" && lists.snacks.length > 0) {
      setTourStep("complete");
      localStorage.setItem("beach-body-board-tour-step", "complete");
    }
  }, [board, tourStep, planningMode, activeDayISO]);

  const handleDuplicateDay = useCallback(
    async (targetDates: string[]) => {
      if (!board || !activeDayISO) return;

      const lockedTarget = targetDates.find((d) => isDayLocked(d, effectiveUserId));
      if (lockedTarget) {
        setPendingLockedDayISO(lockedTarget);
        setLockedDayDialogOpen(true);
        return;
      }

      const sourceLists = { ...getDayLists(board, activeDayISO) };

      try {
        const result = await duplicateAcrossWeeks({
          sourceLists,
          targetDates,
          currentBoard: board,
          currentWeekStartISO: weekStartISO,
          namespace: BUILDER_NS.BEACH_BODY,
          cacheUserId: proClientId || clientId,
        });

        if (result.currentWeekBoard) {
          setBoard(result.currentWeekBoard);
          await saveBoard(result.currentWeekBoard);
        }

        if (result.errors.length > 0) {
          toast({ title: "Partial duplicate", description: `${result.currentWeekDayCount + result.otherWeeksSaved} of ${result.totalDays} days saved.`, variant: "destructive" });
        } else if (result.otherWeeksSaved > 0 && result.currentWeekDayCount === 0) {
          toast({ title: "Saved to future week", description: `Meals copied to ${result.otherWeeksSaved} day(s). Swipe forward to see them.` });
        } else if (result.otherWeeksSaved > 0) {
          toast({ title: "Day duplicated", description: `${result.currentWeekDayCount} day(s) this week + ${result.otherWeeksSaved} day(s) in future weeks` });
        } else {
          toast({ title: "Day duplicated", description: `Copied to ${result.currentWeekDayCount} day(s)` });
        }
      } catch (error) {
        console.error("Failed to duplicate day:", error);
        toast({ title: "Failed to duplicate", description: "Please try again", variant: "destructive" });
      }
    },
    [board, activeDayISO, weekStartISO, saveBoard, toast],
  );



  const handleChefMealGenerated = useCallback(
    async (generatedMeal: any, slot: "breakfast" | "lunch" | "dinner" | "snacks") => {
      if (!activeDayISO) return;
      if (checkLockedDay()) return;

      const transformedMeal: Meal = {
        id: `ai-meal-${Date.now()}`,
        name: generatedMeal.name,
        title: generatedMeal.name,
        description: generatedMeal.description,
        ingredients: generatedMeal.ingredients || [],
        instructions: generatedMeal.instructions,
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
          starchyCarbs: generatedMeal.starchyCarbs || 0,
          fibrousCarbs: generatedMeal.fibrousCarbs || 0,
        },
        starchyCarbs: generatedMeal.starchyCarbs || 0,
        fibrousCarbs: generatedMeal.fibrousCarbs || 0,
        dietClassification: generatedMeal.dietClassification || null,
        appliedProtocol: generatedMeal.appliedProtocol ?? null,
      };

      const newMeals = [transformedMeal];
      saveAIMealsCache(newMeals, activeDayISO, slot);

      if (board) {
        const dayLists = getDayLists(board, activeDayISO);
        const existingSlotMeals = dayLists[slot].filter(
          (m) => !m.id.startsWith("ai-meal-"),
        );
        const updatedSlotMeals = [...existingSlotMeals, ...newMeals];
        const updatedDayLists = { ...dayLists, [slot]: updatedSlotMeals };
        const updatedBoard = setDayLists(board, activeDayISO, updatedDayLists);

        setBoard(updatedBoard);
        fetchImageForMeal(transformedMeal, slot, (mealId, imageUrl) => {
          setBoard(prev => {
            if (!prev) return prev;
            if (getMealImageUrl(prev, mealId) === imageUrl) return prev;
            const updated = updateMealImageInBoard(prev, mealId, imageUrl);
            saveBoard(updated).catch(() => {});
            return updated;
          });
        });
        toast({
          title: "AI Meal Added!",
          description: `${generatedMeal.name} added to ${lists.find((l) => l[0] === slot)?.[1]}`,
        });

        try {
          await saveBoard(updatedBoard);
        } catch (error) {
          console.error("Failed to save AI meal to server:", error);
        }
      }
    },
    [activeDayISO, board, saveBoard, toast],
  );

  // Handler for snack selection from AI Snack Creator
  const handleSnackSelect = useCallback(
    async (snack: any) => {
      if (!board) return;

      // Guard: Check if day is locked before allowing edits
      if (checkLockedDay()) return;

      try {
        // Add to the snacks slot
        if (
          FEATURES.dayPlanning === "alpha" &&
          planningMode === "day" &&
          activeDayISO
        ) {
          // Add to specific day
          const dayLists = getDayLists(board, activeDayISO);
          const updatedDayLists = {
            ...dayLists,
            snacks: [...dayLists.snacks, snack],
          };
          const updatedBoard = setDayLists(
            board,
            activeDayISO,
            updatedDayLists,
          );
          await saveBoard(updatedBoard);
        } else {
          // Week mode: update local board and save
          const updatedBoard = {
            ...board,
            lists: {
              ...board.lists,
              snacks: [...board.lists.snacks, snack],
            },
            version: board.version + 1,
            meta: {
              ...board.meta,
              lastUpdatedAt: new Date().toISOString(),
            },
          };
          setBoard(updatedBoard);
          await saveBoard(updatedBoard);
        }

        // Dispatch board update event
        window.dispatchEvent(new Event("macros:updated"));

        // Trigger proper image pipeline — matches Chef/Craving Creator flow
        fetchImageForMeal({ id: snack.id, name: snack.name }, 'snacks', (mealId, imageUrl) => {
          setBoard(prev => {
            if (!prev) return prev;
            if (getMealImageUrl(prev, mealId) === imageUrl) return prev;
            return updateMealImageInBoard(prev, mealId, imageUrl);
          });
        });
      } catch (error) {
        console.error("Failed to add snack:", error);
        toast({
          title: "Error",
          description: "Failed to add snack. Please try again.",
          variant: "destructive",
        });
      }
    },
    [board, planningMode, activeDayISO, weekStartISO, saveBoard, toast],
  );

  // Week navigation - just update weekStartISO, the useWeeklyBoard hook handles fetching with cache fallback
  const gotoWeek = useCallback((targetISO: string) => {
    setWeekStartISO(targetISO);
  }, []);

  const onPrevWeek = useCallback(() => {
    if (!weekStartISO) return;
    gotoWeek(prevWeekISO(weekStartISO, "America/Chicago"));
  }, [weekStartISO, gotoWeek]);

  const onNextWeek = useCallback(() => {
    if (!weekStartISO) return;
    gotoWeek(nextWeekISO(weekStartISO, "America/Chicago"));
  }, [weekStartISO, gotoWeek]);

  async function quickAdd(
    list: "breakfast" | "lunch" | "dinner" | "snacks" | "meal4" | "meal5" | "meal6",
    meal: Meal,
  ) {
    if (!board) return;

    // Guard: Check if day is locked before allowing edits
    if (checkLockedDay()) return;

    try {
      if (
        FEATURES.dayPlanning === "alpha" &&
        planningMode === "day" &&
        activeDayISO
      ) {
        const dayLists = getDayLists(board, activeDayISO);
        const updatedDayLists = {
          ...dayLists,
          [list]: [...dayLists[list as keyof typeof dayLists], meal],
        };
        const updatedBoard = setDayLists(board, activeDayISO, updatedDayLists);
        setBoard(updatedBoard);
        await saveBoard(updatedBoard);
      } else {
        const updatedBoard = {
          ...board,
          lists: {
            ...board.lists,
            [list]: [...board.lists[list], meal],
          },
          version: board.version + 1,
          meta: {
            ...board.meta,
            lastUpdatedAt: new Date().toISOString(),
          },
        };
        setBoard(updatedBoard);
        await saveBoard(updatedBoard);
      }

      try {
        window.dispatchEvent(new Event("macros:updated"));
      } catch {}
    } catch (error) {
      console.error("Failed to add meal:", error);
    }
  }

  function openPicker(list: "breakfast" | "lunch" | "dinner" | "snacks") {
    setPickerList(list);
    setPickerOpen(true);
  }

  // Get profile and targets for macro tracking
  const profile = useOnboardingProfile();
  const targets = useMemo(
    () => computeTargetsFromOnboarding(profile),
    [profile],
  );
  const macroData = useTodayMacros(effectiveUserId || "");
  const nutritionBudget = useNutritionBudget(effectiveUserId || "");

  // Remaining macro budget — passed to AI so it generates within today's remaining allowance.
  // Only send if the user has targets configured. Clamp negatives to 0 (overage = nothing left).
  const remainingMacrosForChef = useMemo(() => {
    if (!nutritionBudget.hasTargets) return undefined;
    const r = nutritionBudget.remaining;
    return {
      protein: Math.max(0, r.protein),
      carbs: Math.max(0, r.carbs),
      fat: Math.max(0, r.fat),
      calories: Math.max(0, r.calories),
    };
  }, [nutritionBudget.hasTargets, nutritionBudget.remaining]);

  const totals = useMemo(() => {
    if (!board) return { calories: 0, protein: 0, carbs: 0, fat: 0 };

    let allMeals: Meal[] = [];
    if (
      FEATURES.dayPlanning === "alpha" &&
      planningMode === "day" &&
      activeDayISO
    ) {
      const dayLists = getDayLists(board, activeDayISO);
      allMeals = [
        ...dayLists.breakfast,
        ...dayLists.lunch,
        ...dayLists.dinner,
        ...dayLists.snacks,
        ...(dayLists.meal4 ?? []),
        ...(dayLists.meal5 ?? []),
        ...(dayLists.meal6 ?? []),
      ];
    } else {
      allMeals = [
        ...board.lists.breakfast,
        ...board.lists.lunch,
        ...board.lists.dinner,
        ...board.lists.snacks,
        ...(board.lists.meal4 ?? []),
        ...(board.lists.meal5 ?? []),
        ...(board.lists.meal6 ?? []),
      ];
    }

    return {
      calories: Math.round(
        allMeals.reduce(
          (sum, meal) => sum + (meal.nutrition?.calories ?? 0),
          0,
        ),
      ),
      protein: Math.round(
        allMeals.reduce((sum, meal) => sum + (meal.nutrition?.protein ?? 0), 0),
      ),
      carbs: Math.round(
        allMeals.reduce((sum, meal) => sum + (meal.nutrition?.carbs ?? 0), 0),
      ),
      fat: Math.round(
        allMeals.reduce((sum, meal) => sum + (meal.nutrition?.fat ?? 0), 0),
      ),
      // starchyCarbs tracks only the starchy carb allocation (rice, oats, potatoes, etc.)
      // Fibrous carbs (vegetables) are NOT counted here — they are unrestricted.
      starchyCarbs: Math.round(
        allMeals.reduce(
          (sum, meal) => sum + ((meal as any).starchyCarbs ?? (meal.nutrition as any)?.starchyCarbs ?? 0),
          0,
        ),
      ),
    };
  }, [board, planningMode, activeDayISO]);

  // Silent error handling - Facebook-style: no UI for transient network events
  React.useEffect(() => {
    if (error) {
      console.log("[Network] Board load encountered an issue, using cached data if available");
    }
  }, [error]);

  if (loading && !board) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-2xl h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading Performance Nutrition Builder...</p>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 flex items-center justify-center">
        <div className="text-white text-center">
          <p>Failed to load board</p>
        </div>
      </div>
    );
  }

  // ── Clinical paywall ─────────────────────────────────────────────────────
  const entitlements: string[] = (user as any)?.entitlements || [];
  const hasPerformanceAccess =
    entitlements.includes("performance_nutrition") || entitlements.includes("FULL_ACCESS");

  if (!hasPerformanceAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 flex flex-col">
        <BuilderHeader title="Performance Nutrition Builder" onOpenTour={quickTour.openTour} clientId={proClientId} />
        <div className="flex flex-col items-center justify-center flex-1 px-6 text-center gap-6" style={{ paddingTop: "6rem" }}>
          <div className="w-20 h-20 rounded-full bg-orange-600/20 border border-orange-500/30 flex items-center justify-center">
            <span className="text-4xl">🏆</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Performance Nutrition Builder</h2>
            <p className="text-white/60 text-sm max-w-xs leading-relaxed">
              Sport-specific meal building with competition prep protocols, starch cycling, and performance carb targets.
            </p>
          </div>
          <div className="bg-orange-950/40 border border-orange-500/30 rounded-2xl px-5 py-4 max-w-xs w-full space-y-3">
            <p className="text-orange-300 font-semibold text-sm">Clinical Plan Required</p>
            <ul className="text-white/70 text-xs text-left space-y-1.5">
              <li>✓ Performance Nutrition meal protocols</li>
              <li>✓ Competition prep — physique, powerlifting, combat</li>
              <li>✓ Starch allocation &amp; carb cycling</li>
              <li>✓ Protocol-aware meal generation</li>
              <li>✓ Performance Nutrition Hub</li>
            </ul>
          </div>
          <button
            onClick={() => setLocation("/pricing")}
            className="bg-orange-600 text-white font-semibold rounded-xl px-8 py-3 text-sm w-full max-w-xs"
          >
            View Clinical Plan
          </button>
        </div>
      </div>
    );
  }

  const currentLists =
    FEATURES.dayPlanning === "alpha" && planningMode === "day" && activeDayISO
      ? getDayLists(board, activeDayISO)
      : board.lists;

  return (
  <>
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-36 overflow-x-hidden"
    >
      <BuilderHeader title="Performance Nutrition Builder" onOpenTour={quickTour.openTour} clientId={proClientId} />
      <TrialBanner />

      {/* Main Content */}
      <div
        className="max-w-[1600px] mx-auto px-4 space-y-6"
        style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + ${proClientId ? '9rem' : '6rem'})` }}
      >
        <NutritionBudgetBanner className="mb-2" userId={effectiveUserId} />

        {/* ── Protocol Active Banner ── */}
        {(() => {
          const activeTrack = (user as any)?.activeProtocolTrack as string | null;
          const perfCtx = (user as any)?.performanceContext as any;
          const compCtx = (user as any)?.competitionPrepContext as any;

          if (activeTrack === "competition" && compCtx?.competitionType && compCtx?.eventDate) {
            const now = new Date();
            const event = new Date(compCtx.eventDate);
            const weeksOut = Math.max(0, Math.round((event.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000)));
            const phaseLabel =
              weeksOut <= 0 ? "Post-Competition" :
              weeksOut === 1 ? "Show / Meet Day" :
              weeksOut <= 2 ? "Peak Week" :
              weeksOut <= 4 ? "Peak Prep" :
              weeksOut <= 12 ? "Conditioning" : "Base Building";
            const compTypeLabels: Record<string, string> = {
              bodybuilding_show: "Bodybuilding Show", mens_physique: "Men's Physique",
              classic_physique: "Classic Physique", figure: "Figure", bikini: "Bikini",
              wellness: "Wellness", powerlifting_meet: "Powerlifting Meet",
              strongman_competition: "Strongman", olympic_weightlifting_meet: "Olympic Weightlifting",
              fight_camp: "Fight Camp", wrestling_season: "Wrestling Season",
              crossfit_competition: "CrossFit Competition", hyrox: "Hyrox",
              marathon: "Marathon", triathlon_race: "Triathlon Race", spartan_race: "Spartan Race",
            };
            return (
              <div className="mx-4 mb-2 rounded-xl bg-orange-950/40 border border-orange-500/40 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-orange-400 font-bold text-sm">🏆 Competition Prep Active</div>
                    <div className="text-white/80 text-sm">
                      {compCtx.competitionType === "other"
                        ? (compCtx.customSportName ?? "Custom Sport")
                        : (compTypeLabels[compCtx.competitionType] ?? compCtx.competitionType)}
                      {weeksOut > 0 ? ` · ${weeksOut} Weeks Out` : " · Event Week"}
                    </div>
                    <div className="text-white/50 text-xs">Current Phase: {phaseLabel}</div>
                  </div>
                  <div className="shrink-0 text-[11px] bg-orange-600/20 border border-orange-500/30 rounded-lg px-2 py-1 text-orange-300 font-semibold">
                    Protocol Active
                  </div>
                </div>
              </div>
            );
          }

          if (activeTrack === "athletic" && perfCtx?.trainingType) {
            const typeLabels: Record<string, string> = {
              strength: "Strength Training", hypertrophy: "Hypertrophy", powerlifting: "Powerlifting",
              olympic_lifting: "Olympic Lifting", mma: "MMA", boxing: "Boxing", wrestling: "Wrestling",
              bjj: "BJJ", crossfit: "CrossFit", endurance_running: "Running",
              cycling: "Cycling", triathlon: "Triathlon", tactical: "Tactical / Military",
              general_fitness: "General Fitness",
            };
            const phaseLabels: Record<string, string> = {
              off_season: "Off Season", pre_season: "Pre-Season", in_season: "In Season",
              weight_cut: "Weight Cut", recovery: "Recovery Phase",
            };
            const freq = perfCtx.trainingFrequency ?? "3-4";
            const phase = phaseLabels[perfCtx.trainingPhase ?? "in_season"] ?? "In Season";
            return (
              <div className="mx-4 mb-2 rounded-xl bg-zinc-900/60 border border-orange-500/30 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-orange-400 font-bold text-sm">⚡ Athletic Performance Active</div>
                    <div className="text-white/80 text-sm">
                      {perfCtx.trainingType === "other"
                        ? (perfCtx.customSportName ?? "Custom Sport")
                        : (typeLabels[perfCtx.trainingType] ?? (perfCtx.trainingType ?? "").replace(/_/g, " "))}
                      {` · ${freq} Sessions/Week`}
                    </div>
                    <div className="text-white/50 text-xs">Current Phase: {phase}</div>
                  </div>
                  <div className="shrink-0 text-[11px] bg-orange-600/20 border border-orange-500/30 rounded-lg px-2 py-1 text-orange-300 font-semibold">
                    Protocol Active
                  </div>
                </div>
              </div>
            );
          }

          return null;
        })()}

        <div className="mb-2 border border-zinc-800 bg-zinc-900/60 backdrop-blur rounded-2xl mx-4">
          <div className="px-4 py-4 flex flex-col gap-3">
            {/* ROW 1: Week Dates (centered) */}
            <div className="flex justify-center">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onPrevWeek}
                  className="rounded-md px-2 py-1 border border-white/20 text-white/80 hover:bg-white/10 transition-colors"
                  aria-label="Previous week"
                  data-testid="button-prev-week"
                >
                  ‹
                </button>

                <div className="text-sm font-medium text-white/90">
                  {formatWeekLabel(weekStartISO)}
                </div>

                <button
                  type="button"
                  onClick={onNextWeek}
                  className="rounded-md px-2 py-1 border border-white/20 text-white/80 hover:bg-white/10 transition-colors"
                  aria-label="Next week"
                  data-testid="button-next-week"
                >
                  ›
                </button>
              </div>
            </div>

            {/* ROW 2 & 3: Days of Week */}
            {FEATURES.dayPlanning === "alpha" && weekDatesList.length > 0 && (
              <div className="flex justify-center">
                <DayChips
                  weekDates={weekDatesList}
                  activeDayISO={activeDayISO}
                  onDayChange={setActiveDayISO}
                />
              </div>
            )}

            {/* ROW 4: Daily Starch Indicator */}
            {FEATURES.dayPlanning === "alpha" &&
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
                    bodyFatSlotDelta={bodyFatAdjustment.slotDelta}
                  />
                </div>
              )}

            {/* ROW 5: Daily Macro Totals vs Targets */}
            {FEATURES.dayPlanning === "alpha" && activeDayISO && (() => {
              const resolved = effectiveUserId ? getResolvedTargets(effectiveUserId) : null;
              const hasTargets = resolved && resolved.source !== "none" && (
                resolved.calories > 0 || resolved.protein_g > 0 ||
                resolved.carbs_g > 0 || resolved.fat_g > 0
              );

              function macroColor(value: number, target: number): string {
                if (!target) return "bg-white/10 text-white/80";
                const pct = value / target;
                if (pct > 1) return "bg-red-700/60 text-red-100";
                if (pct >= 0.9) return "bg-amber-600/60 text-amber-100";
                return "bg-lime-800/50 text-lime-100";
              }

              return (
                <div className="flex flex-wrap items-center gap-1.5 px-1">
                  <span className="text-white/40 text-xs font-medium shrink-0">Today:</span>
                  {hasTargets ? (
                    <>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${macroColor(totals.calories, resolved!.calories)}`}>
                        {totals.calories.toLocaleString()} / {Math.round(resolved!.calories).toLocaleString()} cal
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${macroColor(totals.protein, resolved!.protein_g)}`}>
                        P {totals.protein} / {Math.round(resolved!.protein_g)}g
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${macroColor(totals.carbs, resolved!.carbs_g)}`}>
                        C {totals.carbs} / {Math.round(resolved!.carbs_g)}g
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${macroColor(totals.fat, resolved!.fat_g)}`}>
                        F {totals.fat} / {Math.round(resolved!.fat_g)}g
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="bg-white/10 text-white/80 text-xs font-semibold px-2 py-0.5 rounded-full">
                        {totals.calories.toLocaleString()} cal
                      </span>
                      <span className="bg-white/10 text-white/80 text-xs font-semibold px-2 py-0.5 rounded-full">
                        P {totals.protein}g
                      </span>
                      <span className="bg-white/10 text-white/80 text-xs font-semibold px-2 py-0.5 rounded-full">
                        C {totals.carbs}g
                      </span>
                      <span className="bg-white/10 text-white/80 text-xs font-semibold px-2 py-0.5 rounded-full">
                        F {totals.fat}g
                      </span>
                    </>
                  )}
                </div>
              );
            })()}

            {/* ROW 6: Bottom Actions */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">

              <div className="inline-flex flex-col items-center gap-1">
                <PillButton
                  onClick={handleSave}
                  disabled={saving || justSaved}
                  active={true}
                  variant="emerald"
                  className="px-3"
                  glow="emerald"
                  data-wt="wmb-save-week-button"
                >
                  {justSaved ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
                </PillButton>
                <span className="text-xs font-semibold text-white/70 tracking-wide">
                  {saving ? "Saving…" : justSaved ? "Saved ✓" : "Save Plan"}
                </span>
              </div>

              <HowThisWorksLink />

              <div className="inline-flex flex-col items-center gap-1">
                <PillButton
                  onClick={() => setShowDuplicateDayModal(true)}
                  data-testid="duplicate-button"
                  active={true}
                  variant="sky"
                  className="px-3"
                >
                  <Calendar className="h-3 w-3" />
                </PillButton>
                <span className="text-xs font-semibold text-white/70 tracking-wide">Duplicate</span>
              </div>

            </div>
          </div>
        </div>

        {/* Meal Cards Grid - Meals 1-3 fixed + dynamic meals */}
        <div className="max-w-[1600px] mx-auto px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 mt-6">
          {FEATURES.dayPlanning === "alpha" &&
          planningMode === "day" &&
          activeDayISO &&
          board
            ? (() => {
                const dayLists = getDayLists(board, activeDayISO);

                return (
                  <>
                    {/* Fixed Meals 1-3 */}
                    {lists.map(([key, label]) => (
                      <section
                        key={key}
                        className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur p-4"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-white/90 text-lg font-medium">
                            {label}
                          </h2>
                          <GlobalMealActionBar
                            slot={key as "breakfast" | "lunch" | "dinner" | "snacks" | "meal4" | "meal5" | "meal6"}
                            onCreateWithAI={() => {
                              setAiMealSlot(key as "breakfast" | "lunch" | "dinner" | "snacks" | "meal4" | "meal5" | "meal6");
                              setAiMealModalOpen(true);
                            }}
                            onCreateWithChef={() => {
                              setCreateWithChefSlot(key as "breakfast" | "lunch" | "dinner" | "meal4" | "meal5" | "meal6");
                              setCreateWithChefOpen(true);
                            }}
                            onSnackCreator={() => {
                              setSnackCreatorOpen(true);
                            }}
                            onSave={(meal) => quickAdd(key as "breakfast"|"lunch"|"dinner"|"snacks"|"meal4"|"meal5"|"meal6", meal)}
                            onImageReady={(mealId, imageUrl) => { setBoard(prev => { if (!prev) return prev; if (getMealImageUrl(prev, mealId) === imageUrl) return prev; const updated = updateMealImageInBoard(prev, mealId, imageUrl); saveBoard(updated).catch(() => {}); return updated; }); }}
                            onFavorites={goToFavorites}
                          />
                        </div>

                        <div className="space-y-3">
                          {dayLists[key as keyof typeof dayLists].map(
                            (meal: Meal, idx: number) => (
                              <MealCard
                                key={meal.id}
                                date={activeDayISO}
                                slot={key}
                                meal={meal}
                                showStarchBadge={true}
                                data-wt="wmb-meal-card"
                                onUpdated={(m) => {
                                  if (m === null) {
                                    if (meal.id.startsWith("ai-meal-")) {
                                      clearAIMealsCache();
                                    }

                                    const updatedDayLists = {
                                      ...dayLists,
                                      [key]: dayLists[
                                        key as keyof typeof dayLists
                                      ].filter(
                                        (existingMeal) =>
                                          existingMeal.id !== meal.id,
                                      ),
                                    };
                                    const updatedBoard = setDayLists(
                                      board,
                                      activeDayISO,
                                      updatedDayLists,
                                    );
                                    setBoard(updatedBoard);
                                    saveBoard(updatedBoard).catch((err) => {
                                      console.error("Delete sync failed:", err);
                                      toast({
                                        title: "Sync pending",
                                        description: "Changes will sync automatically.",
                                      });
                                    });
                                  } else {
                                    const updatedDayLists = {
                                      ...dayLists,
                                      [key]: dayLists[
                                        key as keyof typeof dayLists
                                      ].map((existingMeal, i) =>
                                        i === idx ? m : existingMeal,
                                      ),
                                    };
                                    const updatedBoard = setDayLists(
                                      board,
                                      activeDayISO,
                                      updatedDayLists,
                                    );
                                    saveBoard(updatedBoard);
                                  }
                                }}
                              />
                            ),
                          )}
                          {dayLists[key as keyof typeof dayLists].length ===
                            0 && (
                            <div className="rounded-2xl border border-dashed border-zinc-700 text-white/50 p-6 text-center text-sm">
                              <p className="mb-2">
                                No {label.toLowerCase()} meals yet
                              </p>
                              <p className="text-xs text-white/40">
                                Use "+" to add meals
                              </p>
                            </div>
                          )}
                        </div>
                      </section>
                    ))}

                  </>
                );
              })()
            : // This part renders the meals for the entire week if not in 'day' planning mode
              // It uses the original `lists` which does not include Meal 5.
              // To include Meal 5 here, `beachBodyLists` should be used if `lists` is intended to be modified globally.
              // However, since the prompt focuses on Beach Body Meal Board, this part might not need modification if it's for a different context.
              // For consistency with the Beach Body board, one might consider using `beachBodyLists` here as well.
              lists.map(([key, label]) => (
                <section
                  key={key}
                  data-meal-id={key === "snacks" ? "snack1" : key}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur p-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-white/90 text-lg font-medium">
                      {label}
                    </h2>
                    <div className="flex gap-2">
                      {/* AI Meal Creator button - hidden by feature flag for launch */}
                      {FEATURES.showCreateWithAI && key !== "snacks" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-white/80 hover:bg-black/50 border border-pink-400/30 text-xs font-medium flex items-center gap-1 flash-border"
                          onClick={() => {
                            setAiMealSlot(
                              key as
                                | "breakfast"
                                | "lunch"
                                | "dinner"
                                | "snacks",
                            );
                            setAiMealModalOpen(true);
                          }}
                        >
                          <Sparkles className="h-3 w-3" />
                          Create with AI
                        </Button>
                      )}

                      {/* Snack Creator for snacks slot only */}
                      {key === "snacks" && (
                        <SnackCreatorButton
                          onClick={() => setSnackCreatorOpen(true)}
                        />
                      )}

                      <AddOwnMealButton slot={key as "breakfast"|"lunch"|"dinner"|"snacks"|"meal4"|"meal5"|"meal6"} onSave={(meal) => quickAdd(key as "breakfast"|"lunch"|"dinner"|"snacks"|"meal4"|"meal5"|"meal6", meal)} onImageReady={(mealId, imageUrl) => { setBoard(prev => { if (!prev) return prev; if (getMealImageUrl(prev, mealId) === imageUrl) return prev; const updated = updateMealImageInBoard(prev, mealId, imageUrl); saveBoard(updated).catch(() => {}); return updated; }); }} variant="icon" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    {board.lists[key].map((meal: Meal, idx: number) => (
                      <MealCard
                        key={meal.id}
                        date={"board"}
                        slot={key}
                        meal={meal}
                        showStarchBadge={true}
                        onUpdated={(m) => {
                          if (m === null) {
                            if (!board) return;
                            const updatedBoard = {
                              ...board,
                              lists: {
                                ...board.lists,
                                [key]: board.lists[key].filter(
                                  (item: Meal) => item.id !== meal.id,
                                ),
                              },
                              version: board.version + 1,
                              meta: {
                                ...board.meta,
                                lastUpdatedAt: new Date().toISOString(),
                              },
                            };
                            setBoard(updatedBoard);
                            saveBoard(updatedBoard).catch((err) => {
                              console.error("Delete sync failed:", err);
                              toast({
                                title: "Sync pending",
                                description: "Changes will sync automatically.",
                              });
                            });
                          } else {
                            const updatedBoard = {
                              ...board,
                              lists: {
                                ...board.lists,
                                [key]: board.lists[key].map(
                                  (item: Meal, i: number) =>
                                    i === idx ? m : item,
                                ),
                              },
                              version: board.version + 1,
                            };
                            setBoard(updatedBoard);
                            saveBoard(updatedBoard).catch(console.error);
                          }
                        }}
                      />
                    ))}
                    {board.lists[key].length === 0 && (
                      <div className="rounded-2xl border border-dashed border-zinc-700 text-white/50 p-6 text-center text-sm">
                        <p className="mb-2">
                          No {label.toLowerCase()} meals yet
                        </p>
                        <p className="text-xs text-white/40">
                          Use "+" to add meals
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              ))}

          {/* Snack Card - Below Meals, Above Daily Totals */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur p-4 col-span-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white/90 text-lg font-medium">Snacks</h2>
              <GlobalMealActionBar
                slot="snacks"
                onCreateWithAI={() => {}}
                onCreateWithChef={() => {}}
                onSnackCreator={() => setSnackCreatorOpen(true)}
                onSave={(meal) => quickAdd("snacks", meal)}
                onImageReady={(mealId, imageUrl) => { setBoard(prev => { if (!prev) return prev; if (getMealImageUrl(prev, mealId) === imageUrl) return prev; const updated = updateMealImageInBoard(prev, mealId, imageUrl); saveBoard(updated).catch(() => {}); return updated; }); }}
                onFavorites={goToFavorites}
              />
            </div>

            <div className="space-y-3">
              {FEATURES.dayPlanning === "alpha" &&
              planningMode === "day" &&
              activeDayISO &&
              board
                ? (() => {
                    const dayLists = getDayLists(board, activeDayISO);
                    return dayLists.snacks.map((meal: Meal, idx: number) => (
                      <MealCard
                        key={meal.id}
                        date={activeDayISO}
                        slot="snacks"
                        meal={meal}
                        showStarchBadge={true}
                        data-wt="wmb-meal-card"
                        onUpdated={(m) => {
                          if (m === null) {
                            if (meal.id.startsWith("ai-meal-")) {
                              clearAIMealsCache();
                            }
                            const updatedDayLists = {
                              ...dayLists,
                              snacks: dayLists.snacks.filter(
                                (existingMeal) => existingMeal.id !== meal.id,
                              ),
                            };
                            const updatedBoard = setDayLists(
                              board,
                              activeDayISO,
                              updatedDayLists,
                            );
                            setBoard(updatedBoard);
                            saveBoard(updatedBoard).catch((err) => {
                              console.error("Delete sync failed:", err);
                              toast({
                                title: "Sync pending",
                                description: "Changes will sync automatically.",
                              });
                            });
                          } else {
                            const updatedDayLists = {
                              ...dayLists,
                              snacks: dayLists.snacks.map((existingMeal, i) =>
                                i === idx ? m : existingMeal,
                              ),
                            };
                            const updatedBoard = setDayLists(
                              board,
                              activeDayISO,
                              updatedDayLists,
                            );
                            saveBoard(updatedBoard);
                          }
                        }}
                      />
                    ));
                  })()
                : board.lists.snacks.map((meal: Meal, idx: number) => (
                    <MealCard
                      key={meal.id}
                      date={"board"}
                      slot="snacks"
                      meal={meal}
                      showStarchBadge={true}
                      data-wt="wmb-meal-card"
                      onUpdated={(m) => {
                        if (m === null) {
                          if (!board) return;
                          const updatedBoard = {
                            ...board,
                            lists: {
                              ...board.lists,
                              snacks: board.lists.snacks.filter(
                                (item: Meal) => item.id !== meal.id,
                              ),
                            },
                            version: board.version + 1,
                            meta: {
                              ...board.meta,
                              lastUpdatedAt: new Date().toISOString(),
                            },
                          };
                          setBoard(updatedBoard);
                          saveBoard(updatedBoard).catch((err) => {
                            console.error("Delete sync failed:", err);
                            toast({
                              title: "Sync pending",
                              description: "Changes will sync automatically.",
                            });
                          });
                        } else {
                          const updatedBoard = {
                            ...board,
                            lists: {
                              ...board.lists,
                              snacks: board.lists.snacks.map(
                                (item: Meal, i: number) =>
                                  i === idx ? m : item,
                              ),
                            },
                            version: board.version + 1,
                          };
                          setBoard(updatedBoard);
                          saveBoard(updatedBoard).catch(console.error);
                        }
                      }}
                    />
                  ))}
              {(FEATURES.dayPlanning === "alpha" &&
              planningMode === "day" &&
              activeDayISO &&
              board
                ? getDayLists(board, activeDayISO).snacks.length === 0
                : board.lists.snacks.length === 0) && (
                <div className="rounded-2xl border border-dashed border-zinc-700 text-white/50 p-6 text-center text-sm">
                  <p className="mb-2">No snacks yet</p>
                  <p className="text-xs text-white/40">Use "+" to add snacks</p>
                </div>
              )}
            </div>
          </section>

          {/* Pro Tip Card */}
          <ProTipCard />

          {/* Daily Targets Card with Quick Add */}
          <div className="col-span-full">
            <DailyTargetsCard
              userId={effectiveUserId}
              onQuickAddClick={() => setAdditionalMacrosOpen(true)}
              targetsOverride={(() => {
                const resolved = getResolvedTargets(effectiveUserId);
                return {
                  protein_g: resolved.protein_g || 0,
                  carbs_g: resolved.carbs_g || 0,
                  fat_g: resolved.fat_g || 0,
                  starchyCarbs_g: resolved.starchyCarbs_g,
                  fibrousCarbs_g: resolved.fibrousCarbs_g,
                };
              })()}
            />
          </div>
        </div>

        {/* Remaining Macros Footer - Inline Mode */}
        {board &&
          FEATURES.dayPlanning === "alpha" &&
          planningMode === "day" &&
          activeDayISO &&
          (() => {
              const dayLists = getDayLists(board, activeDayISO);
              const computeSlotMacros = (meals: Meal[]) => {
                let sc = 0, fc = 0;
                for (const m of meals) {
                  const storedStarchy = (m as any).starchyCarbs ?? m.nutrition?.starchyCarbs;
                  const storedFibrous = (m as any).fibrousCarbs ?? m.nutrition?.fibrousCarbs;
                  const totalCarbs = m.nutrition?.carbs || 0;
                  if (typeof storedStarchy === "number" && storedStarchy > 0) {
                    sc += storedStarchy;
                    fc += typeof storedFibrous === "number" ? storedFibrous : 0;
                  } else if (typeof storedFibrous === "number" && storedFibrous > 0) {
                    fc += storedFibrous;
                  } else {
                    if (classifyMeal(m).isStarchMeal) {
                      sc += totalCarbs;
                    } else {
                      fc += totalCarbs;
                    }
                  }
                }
                return {
                  count: meals.length,
                  calories: meals.reduce((sum, m) => sum + (m.nutrition?.calories || 0), 0),
                  protein: meals.reduce((sum, m) => sum + (m.nutrition?.protein || 0), 0),
                  carbs: meals.reduce((sum, m) => sum + (m.nutrition?.carbs || 0), 0),
                  fat: meals.reduce((sum, m) => sum + (m.nutrition?.fat || 0), 0),
                  starchyCarbs: sc,
                  fibrousCarbs: fc,
                };
              };
              const slots = {
                breakfast: computeSlotMacros(dayLists.breakfast),
                lunch: computeSlotMacros(dayLists.lunch),
                dinner: computeSlotMacros(dayLists.dinner),
                snacks: computeSlotMacros(dayLists.snacks),
              };
              const consumed = {
                calories:
                  slots.breakfast.calories +
                  slots.lunch.calories +
                  slots.dinner.calories +
                  slots.snacks.calories,
                protein:
                  slots.breakfast.protein +
                  slots.lunch.protein +
                  slots.dinner.protein +
                  slots.snacks.protein,
                carbs:
                  slots.breakfast.carbs +
                  slots.lunch.carbs +
                  slots.dinner.carbs +
                  slots.snacks.carbs,
                fat:
                  slots.breakfast.fat +
                  slots.lunch.fat +
                  slots.dinner.fat +
                  slots.snacks.fat,
                starchyCarbs: slots.breakfast.starchyCarbs + slots.lunch.starchyCarbs + slots.dinner.starchyCarbs + slots.snacks.starchyCarbs,
                fibrousCarbs: slots.breakfast.fibrousCarbs + slots.lunch.fibrousCarbs + slots.dinner.fibrousCarbs + slots.snacks.fibrousCarbs,
              };
              const dayAlreadyLocked = isDayLocked(activeDayISO, effectiveUserId);

              if (proClientId) return null;
              return (
                <div className="col-span-full mb-6">
                  <RemainingMacrosFooter
                    consumedOverride={consumed}
                    showSaveButton={false}
                    layoutMode="inline"
                    onSaveDay={async () => {
                      const raw = getMacroTargets(effectiveUserId);
                      const targets = raw
                        ? {
                            calories: raw.calories,
                            protein_g: raw.protein_g,
                            carbs_g: raw.carbs_g,
                            fat_g: raw.fat_g,
                          }
                        : { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
                      const result = await lockDay(
                        {
                          dateISO: activeDayISO,
                          targets,
                          consumed,
                          slots,
                        },
                        effectiveUserId,
                      );

                      if (result.alreadyLocked) {
                        toast({
                          title: "Already Locked",
                          description: result.message,
                          variant: "destructive",
                        });
                      } else {
                        try {
                          await fetch(`/api/users/${effectiveUserId}/macros/daily-summary`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({
                              dateISO: activeDayISO,
                              calories: consumed.calories,
                              protein: consumed.protein,
                              carbs: consumed.carbs,
                              fat: consumed.fat,
                              starchyCarbs: consumed.starchyCarbs || 0,
                              fibrousCarbs: consumed.fibrousCarbs || 0,
                              source: "locked-day",
                            }),
                          });
                        } catch (e) {
                          console.error("Failed to write daily summary:", e);
                        }
                        queryClient.invalidateQueries({ queryKey: ["/api/users", effectiveUserId, "macros", "today"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/users", effectiveUserId, "macro-logs", "daily"] });
                        window.dispatchEvent(new Event("macros:updated"));
                        setQuickView({
                          protein: consumed.protein,
                          carbs: consumed.carbs,
                          starchyCarbs: consumed.starchyCarbs,
                          fibrousCarbs: consumed.fibrousCarbs,
                          fat: consumed.fat,
                          calories: consumed.calories,
                          dateISO: activeDayISO,
                        });
                        toast({
                          title: "Day Saved to Biometrics",
                          description: `${formatDateDisplay(activeDayISO, { weekday: "long", month: "short", day: "numeric" })} has been locked.`,
                        });
                        setLocation(buildBiometricsUrl({ section: "macros", from: "beachbody-meal-board", highlight: true }));
                      }
                    }}
                  />
            </div>
          );
        })()}

        {/* Bottom spacing to clear fixed shopping bar */}
        <div className="h-18" />

        <AthleteMealPickerDrawer
          open={pickerOpen}
          list={pickerList}
          onClose={() => {
            setPickerOpen(false);
            setPickerList(null);
          }}
          onPick={(meal, slot) => {
            quickAdd(slot, meal);
            // Keep the drawer open so the carb budget bar updates in real-time
            // as the user adds multiple meals in a single session.
            // The user closes the drawer manually via the X or backdrop dismiss.
          }}
          carbCycleState={carbCyclePickerState}
          carbsUsed={totals.starchyCarbs}
          hasCoachLink={hasCoachLink}
          macroTargets={(() => {
            const resolved = effectiveUserId ? getResolvedTargets(effectiveUserId) : null;
            if (!resolved || resolved.source === "none") return null;
            return {
              calories: Math.round(resolved.calories ?? 0),
              protein_g: Math.round(resolved.protein_g ?? 0),
              carbs_g: Math.round(resolved.carbs_g ?? 0),
              fat_g: Math.round(resolved.fat_g ?? 0),
            };
          })()}
        />

        <WeeklyOverviewModal
          open={showOverview}
          onClose={() => setShowOverview(false)}
          weekStartISO={weekStartISO}
          board={board}
          onJumpToDay={undefined}
        />

        {FEATURES.dayPlanning === "alpha" && (
          <DuplicateDayModal
            isOpen={showDuplicateDayModal}
            onClose={() => setShowDuplicateDayModal(false)}
            onConfirm={handleDuplicateDay}
            sourceDateISO={activeDayISO}
            availableDates={getRolling14Days(activeDayISO || weekStartISO)}
          />
        )}


        <ShoppingListPreviewModal
          isOpen={shoppingListModal.isOpen}
          onClose={() => setShoppingListModal({ isOpen: false, meal: null })}
          meal={shoppingListModal.meal}
        />

        {/* AI Premade Picker - Competition Meals */}
        <MealPremadePicker
          open={premadePickerOpen}
          onClose={() => {
            setPremadePickerOpen(false);
            setCurrentDynamicSlot(null);
          }}
          mealType={
            premadePickerSlot === "snacks" ? "snack" : premadePickerSlot
          }
          onMealSelect={handlePremadeSelect}
          showMacroTargeting={false}
          dietType="competition"
        />

        <AdditionalMacrosModal
          open={additionalMacrosOpen}
          onClose={() => setAdditionalMacrosOpen(false)}
          onAdd={(meal) => quickAdd("snacks", meal)}
          proteinDeficit={(() => {
            const resolved = getResolvedTargets(effectiveUserId);
            return Math.max(
              0,
              (resolved.protein_g || 0) - Math.round(totals.protein),
            );
          })()}
          carbsDeficit={(() => {
            const resolved = getResolvedTargets(effectiveUserId);
            return Math.max(
              0,
              (resolved.carbs_g || 0) - Math.round(totals.carbs),
            );
          })()}
        />

        {/* Create With Chef Modal - with BeachBody guardrails + remaining budget awareness */}
        <CreateWithChefModal
          open={createWithChefOpen}
          onOpenChange={setCreateWithChefOpen}
          mealType={createWithChefSlot}
          onMealGenerated={handleChefMealGenerated}
          dietType="beachbody"
          dietPhase="lean"
          starchContext={starchContext}
          remainingMacros={remainingMacrosForChef}
        />

        {/* Snack Creator Modal - contest prep guardrails (performance mode) */}
        <SnackCreatorModal
          open={snackCreatorOpen}
          onOpenChange={setSnackCreatorOpen}
          onSnackGenerated={handleSnackSelect}
          dietType="performance"
          starchContext={starchContext}
        />

        {/* Quick Tour Modal */}
        <QuickTourModal
          isOpen={quickTour.shouldShow}
          onClose={quickTour.closeTour}
          title="How to Build Your Performance Nutrition Meals"
          steps={BEACHBODY_TOUR_STEPS}
          onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
        />


        {/* Locked Day Dialog */}
        <LockedDayDialog
          open={lockedDayDialogOpen}
          onOpenChange={setLockedDayDialogOpen}
          dateISO={pendingLockedDayISO}
          onViewOnly={() => setLockedDayDialogOpen(false)}
          onCreateNewDay={handleGoToToday}
        />

        {/* Shopping bar */}
        <BuilderShoppingBar
          board={board}
          activeDayISO={activeDayISO}
          currentWeekStartISO={weekStartISO || ""}
          sourceSlug="beach-body-meal-board"
        />
      </div>
    </motion.div>
  </>
  );
}
