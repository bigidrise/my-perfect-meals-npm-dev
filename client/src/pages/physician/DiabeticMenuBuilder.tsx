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
import { usePageTitle } from "@/contexts/PageTitleContext";
import { MealCard, Meal } from "@/components/MealCard";
import {
  getWeekBoard,
  saveWeekBoard,
  removeMealFromCurrentWeek,
  getCurrentWeekBoard,
  getWeekBoardByDate,
  putWeekBoard,
  type WeekBoard,
  getDayLists,
  setDayLists,
  cloneDayLists,
  updateMealImageInBoard,
  getMealImageUrl,
} from "@/lib/boardApi";
import { useChefMealImage } from "@/hooks/useChefMealImage";
import { duplicateAcrossWeeks } from "@/utils/crossWeekDuplicate";
import { MealPickerDrawer } from "@/components/pickers/MealPickerDrawer";
import { AddOwnMealButton } from "@/components/pickers/AddOwnMealButton";
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
import { useAuth } from "@/contexts/AuthContext";
import WeeklyOverviewModal from "@/components/WeeklyOverviewModal";
import BuilderShoppingBar from "@/components/BuilderShoppingBar";
import { useOnboardingProfile } from "@/hooks/useOnboardingProfile";
import { computeTargetsFromOnboarding, sumBoard } from "@/lib/targets";
import { useTodayMacros } from "@/hooks/useTodayMacros";
import { useNutritionBudget } from "@/hooks/useNutritionBudget";
import { useMidnightReset } from "@/hooks/useMidnightReset";
import {
  getWeekStartISOInTZ,
  getTodayISOSafe,
  weekDatesInTZ,
  nextWeekISO,
  prevWeekISO,
  formatWeekLabel,
  formatDateDisplay,
  todayISOInTZ,
} from "@/utils/midnight";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Calendar,
  Check,
  Sparkles,
  BarChart3,
  ShoppingCart,
  X,
  Trash2,
} from "lucide-react";
import { FEATURES } from "@/utils/features";
import { DayChips } from "@/components/DayChips";
import { DailyStarchIndicator } from "@/components/DailyStarchIndicator";
import { DuplicateDayModal } from "@/components/DuplicateDayModal";
import { WhyChip } from "@/components/WhyChip";
import { WhyDrawer } from "@/components/WhyDrawer";
import { getWeeklyPlanningWhy } from "@/utils/reasons";
import { useToast } from "@/hooks/use-toast";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import ShoppingListPreviewModal from "@/components/ShoppingListPreviewModal";
import { useWeeklyBoard } from "@/hooks/useWeeklyBoard";
import { BUILDER_NS } from "@shared/builderNamespaces";
import { setActiveBuilderNs } from "@/lib/activeBuilderNs";
// CHICAGO CALENDAR FIX v1.0: getMondayISO replaced with getWeekStartISOInTZ from midnight.ts
import { v4 as uuidv4 } from "uuid";
import MealPremadePicker from "@/components/pickers/MealPremadePicker";

import AdditionalMacrosModal from "@/components/modals/AdditionalMacrosModal";
import { CreateWithChefButton } from "@/components/CreateWithChefButton";
import { CreateWithChefModal } from "@/components/CreateWithChefModal";
import { SnackCreatorModal } from "@/components/SnackCreatorModal";
import { GlobalMealActionBar } from "@/components/GlobalMealActionBar";
import { FavoritesPickerModal } from "@/components/FavoritesPickerModal";
import { savedMealToMeal } from "@/utils/savedMealToMeal";
import type { SavedMealRow } from "@/hooks/useSavedMeals";
import { getResolvedTargets } from "@/lib/macroResolver";
import { classifyMeal } from "@/utils/starchMealClassifier";
import type { StarchContext } from "@/hooks/useCreateWithChefRequest";
import DailyMealProgressBar from "@/components/guided/DailyMealProgressBar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { useMealBoardDraft } from "@/hooks/useMealBoardDraft";
import { NutritionBudgetBanner } from "@/components/NutritionBudgetBanner";
import { HowThisWorksLink } from "@/components/ui/HowThisWorksLink";
import { BuilderHeader } from "@/components/pro/BuilderHeader";
import { TrialBanner } from "@/components/TrialBanner";

const DIABETIC_BUILDER_TOUR_STEPS: TourStep[] = [
  {
    icon: "1",
    title: "Add Your Meals",
    description:
      "Tap the + button on any meal card to add diabetic-friendly recipes.",
  },
  {
    icon: "2",
    title: "Low-GI Focused",
    description:
      "All meals are optimized for stable blood sugar with low glycemic ingredients.",
  },
  {
    icon: "3",
    title: "Duplicate Days",
    description:
      "Copy your meal plan to other days for consistent eating patterns.",
  },
  {
    icon: "4",
    title: "Track Macros",
    description:
      "Send meals to the Macro Calculator to monitor carbs and nutrition.",
  },
  {
    icon: "5",
    title: "Shopping List",
    description:
      "Export ingredients for easy diabetic-friendly grocery shopping.",
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
      "The starch indicator helps you manage starchy carbs. Green = slots available, Orange = all used, Red = over limit. Fibrous carbs are unlimited!",
  },
  {
    icon: "*",
    title: "What the Asterisks Mean",
    description:
      "Protein and carbs are marked with asterisks (*) because they're the most important numbers to focus on when building your meals. Get those right first.",
  },
];

// CHICAGO CALENDAR FIX v1.0: All date utilities now imported from midnight.ts
// Using noon UTC anchor pattern to prevent day-shift bugs

export default function DiabeticMenuBuilder() {
  usePageTitle("Diabetic Builder");
  const quickTour = useQuickTour("diabetic-menu-builder");
  const [, setLocation] = useLocation();

  // ProCare route detection for Client Dashboard button
  const [, proParams] = useRoute("/pro/clients/:id/diabetic-builder");
  const proClientId = proParams?.id;

  const { toast } = useToast();
  const isDesktop = useIsDesktop();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const effectiveUserId = proClientId || user?.id;

  // 🎯 BULLETPROOF BOARD LOADING: Cache-first, guaranteed to render
  // CHICAGO CALENDAR FIX v1.0: Using noon UTC anchor pattern
  const [weekStartISO, setWeekStartISO] = React.useState<string>(
    getWeekStartISOInTZ("America/Chicago"),
  );
  const {
    board: hookBoard,
    loading: hookLoading,
    error,
    save: saveToHook,
    source,
    refresh: refreshBoard,
    primeCache,
  } = useWeeklyBoard("1", weekStartISO, proClientId, BUILDER_NS.DIABETIC);

  // Local mutable board state for optimistic updates
  const [board, setBoard] = React.useState<WeekBoard | null>(null);
  const { fetchImageForMeal } = useChefMealImage();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);

  // Draft persistence for crash/reload recovery
  const { clearDraft, skipServerSync, markClean } = useMealBoardDraft(
    {
      userId: effectiveUserId,
      builderId: "diabetic-menu-builder",
      weekStartISO,
    },
    board,
    setBoard,
    hookLoading,
    hookBoard,
  );

  // Sync hook board to local state — initial hydration must ALWAYS succeed
  const boardInitializedRef = React.useRef(false);

  // Register this builder's board namespace so cross-context features (Add to Plan, etc.) write to the correct board
  React.useEffect(() => {
    setActiveBuilderNs(BUILDER_NS.DIABETIC);
  }, []);

  // Reset the initial-hydration gate on week change so new week data bypasses skipServerSync()
  React.useEffect(() => {
    boardInitializedRef.current = false;
  }, [weekStartISO]);

  React.useEffect(() => {
    if (hookBoard) {
      if (!boardInitializedRef.current) {
        boardInitializedRef.current = true;
        setBoard(hookBoard);
        setLoading(hookLoading);
        return;
      }
      if (skipServerSync()) {
        setLoading(hookLoading);
        return;
      }
      setBoard(hookBoard);
      setLoading(hookLoading);
    }
  }, [hookBoard, hookLoading, skipServerSync]);

  // Wrapper to save with idempotent IDs
  const saveBoard = React.useCallback(
    async (updatedBoard: WeekBoard) => {
      setSaving(true);
      try {
        // Type assertion needed because ExtendedMeal has optional title, but schema requires it
        await saveToHook(updatedBoard as any, uuidv4());
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
        clearDraft();
      } catch (err) {
        console.error("Failed to save board:", err);
        // Silent retry - no toast during decision-making flows
        // Save will auto-retry on next user action
      } finally {
        setSaving(false);
      }
    },
    [saveToHook, clearDraft, markClean],
  );
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerList, setPickerList] = React.useState<
    "breakfast" | "lunch" | "dinner" | "snacks" | null
  >(null);
  const [showOverview, setShowOverview] = React.useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = React.useState(false);

  // NEW: Day/Week planning state
  const [planningMode, setPlanningMode] = React.useState<"day" | "week">("day");
  const [activeDayISO, setActiveDayISO] = React.useState<string>("");

  // Why drawer state
  const [boardWhyOpen, setBoardWhyOpen] = React.useState(false);
  const [showDuplicateDayModal, setShowDuplicateDayModal] =
    React.useState(false);

  // Shopping list v2 modal state
  const [shoppingListModal, setShoppingListModal] = useState<{
    isOpen: boolean;
    meal: any | null;
  }>({ isOpen: false, meal: null });

  // AI Premades modal state
  const [premadePickerOpen, setPremadePickerOpen] = useState(false);
  const [premadePickerSlot, setPremadePickerSlot] = useState<
    "breakfast" | "lunch" | "dinner" | "meal4" | "meal5" | "meal6"
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
    const strategy = resolved?.starchStrategy || "one";
    const dayLists = getDayLists(board, activeDayISO);
    const existingMeals: StarchContext["existingMeals"] = [];
    for (const slot of ["breakfast", "lunch", "dinner"] as const) {
      const meals = dayLists[slot] || [];
      for (const meal of meals) {
        existingMeals.push({
          slot,
          hasStarch: classifyMeal(meal).isStarchMeal,
        });
      }
    }
    return { strategy, existingMeals };
  }, [board, activeDayISO, effectiveUserId]);

  // Snack Creator modal state (Phase 2)
  const [snackCreatorOpen, setSnackCreatorOpen] = useState(false);

  // Favorites picker state
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [favoritesSlot, setFavoritesSlot] = useState<"breakfast" | "lunch" | "dinner" | "snacks" | "meal4" | "meal5" | "meal6">("breakfast");

  // Locked day dialog state
  const [lockedDayDialogOpen, setLockedDayDialogOpen] = useState(false);
  const [additionalMacrosOpen, setAdditionalMacrosOpen] = useState(false);
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

  // Handler for snack selection
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
          setBoard(updatedBoard);
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
    [board, planningMode, activeDayISO, saveBoard, weekStartISO, toast],
  );

  // Handler for premade meal selection
  const handlePremadeSelect = useCallback(
    async (meal: any) => {
      if (!board) return;

      // Guard: Check if day is locked before allowing edits
      if (checkLockedDay()) return;

      try {
        // Add to the appropriate slot based on premadePickerSlot
        if (
          FEATURES.dayPlanning === "alpha" &&
          planningMode === "day" &&
          activeDayISO
        ) {
          // Add to specific day
          const dayLists = getDayLists(board, activeDayISO);
          const updatedDayLists = {
            ...dayLists,
            [premadePickerSlot]: [
              ...dayLists[premadePickerSlot as keyof typeof dayLists],
              meal,
            ],
          };
          const updatedBoard = setDayLists(
            board,
            activeDayISO,
            updatedDayLists,
          );
          setBoard(updatedBoard);
          await saveBoard(updatedBoard);
        } else {
          // Week mode: update local board and save
          const updatedBoard = {
            ...board,
            lists: {
              ...board.lists,
              [premadePickerSlot]: [...board.lists[premadePickerSlot], meal],
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
      } catch (error) {
        console.error("Failed to add premade meal:", error);
        toast({
          title: "Error",
          description: "Failed to add meal. Please try again.",
          variant: "destructive",
        });
      }
    },
    [
      board,
      premadePickerSlot,
      planningMode,
      activeDayISO,
      saveBoard,
      weekStartISO,
      toast,
    ],
  );

  // Guided Tour state
  const [hasSeenInfo, setHasSeenInfo] = useState(false);
  const [tourStep, setTourStep] = useState<
    "breakfast" | "lunch" | "dinner" | "complete"
  >("breakfast");

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
    if (!cached || cached.dayISO !== activeDayISO || cached.meals.length === 0) return;

    const dayLists = getDayLists(board, activeDayISO);
    const targetSlot = cached.slot || "breakfast";
    const currentSlotMeals = dayLists[targetSlot];

    // Guard: if all cached meals are already present, do not setBoard (prevents infinite loop)
    const allAlreadyPresent = cached.meals.every((cm) =>
      currentSlotMeals.some((m) => m.id === cm.id),
    );
    if (allAlreadyPresent) return;

    console.log(
      "🔋 Loading AI meals from localStorage:",
      cached.meals.length,
      "meals for",
      activeDayISO,
      "into slot:",
      cached.slot,
    );

    // Merge cached AI meals into the correct slot
    const existingSlotMeals = currentSlotMeals.filter(
      (m) => !m.id.startsWith("ai-meal-"),
    );
    const updatedSlotMeals = [...existingSlotMeals, ...cached.meals];
    const updatedDayLists = { ...dayLists, [targetSlot]: updatedSlotMeals };
    const updatedBoard = setDayLists(board, activeDayISO, updatedDayLists);

    setBoard(updatedBoard);
  }, [board, activeDayISO]); // board dep is intentional; guard above prevents infinite loop

  // Load/save tour progress from localStorage
  useEffect(() => {
    const infoSeen = localStorage.getItem("diabetic-menu-builder-info-seen");
    if (infoSeen === "true") {
      setHasSeenInfo(true);
    } else {
      // Auto-mark info as seen since Copilot provides guidance now
      setHasSeenInfo(true);
      localStorage.setItem("diabetic-menu-builder-info-seen", "true");
    }

    const dailyTotalsInfoSeen = localStorage.getItem(
      "diabetic-menu-builder-daily-totals-info-seen",
    );
    if (dailyTotalsInfoSeen === "true") {
      setHasSeenDailyTotalsInfo(true);
    }

    const savedStep = localStorage.getItem("diabetic-menu-builder-tour-step");
    if (
      savedStep === "breakfast" ||
      savedStep === "lunch" ||
      savedStep === "dinner" ||
      savedStep === "complete"
    ) {
      setTourStep(savedStep as "breakfast" | "lunch" | "dinner" | "complete");
    }
  }, []);

  // Update tour step when meals are created
  useEffect(() => {
    if (!board) return;

    const lists =
      FEATURES.dayPlanning === "alpha" && planningMode === "day" && activeDayISO
        ? getDayLists(board, activeDayISO)
        : board.lists;

    // Check meal completion and advance tour
    if (tourStep === "breakfast" && lists.breakfast.length > 0) {
      setTourStep("lunch");
      localStorage.setItem("diabetic-menu-builder-tour-step", "lunch");
      // Daily Totals info removed - redundant with Guide modal
    } else if (tourStep === "lunch" && lists.lunch.length > 0) {
      setTourStep("dinner");
      localStorage.setItem("diabetic-menu-builder-tour-step", "dinner");
    } else if (tourStep === "dinner" && lists.dinner.length > 0) {
      setTourStep("complete");
      localStorage.setItem("diabetic-menu-builder-tour-step", "complete");
    }
  }, [board, tourStep, planningMode, activeDayISO, hasSeenDailyTotalsInfo]);

  // Duplicate day handler
  const handleDuplicateDay = useCallback(
    async (targetDates: string[]) => {
      if (!board || !activeDayISO) return;

      // Guard: Check if any TARGET date is locked before allowing edits
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
          namespace: BUILDER_NS.DIABETIC,
          cacheUserId: proClientId || "1",
        });

        if (result.currentWeekBoard) {
          setBoard(result.currentWeekBoard);
          await saveBoard(result.currentWeekBoard);
        }

        if (result.errors.length > 0) {
          toast({
            title: "Partial duplicate",
            description: `${result.currentWeekDayCount + result.otherWeeksSaved} of ${result.totalDays} days saved.`,
            variant: "destructive",
          });
        } else if (
          result.otherWeeksSaved > 0 &&
          result.currentWeekDayCount === 0
        ) {
          toast({
            title: "Saved to future week",
            description: `Meals copied to ${result.otherWeeksSaved} day(s). Swipe forward to see them.`,
          });
        } else if (result.otherWeeksSaved > 0) {
          toast({
            title: "Day duplicated",
            description: `${result.currentWeekDayCount} day(s) this week + ${result.otherWeeksSaved} day(s) in future weeks`,
          });
        } else {
          toast({
            title: "Day duplicated",
            description: `Copied to ${result.currentWeekDayCount} day(s)`,
          });
        }
      } catch (error) {
        console.error("Failed to duplicate day:", error);
        toast({
          title: "Failed to duplicate",
          description: "Please try again",
          variant: "destructive",
        });
      }
    },
    [board, activeDayISO, weekStartISO, saveBoard, toast],
  );


  const handleChefMealGenerated = useCallback(
    async (
      generatedMeal: any,
      slot: "breakfast" | "lunch" | "dinner" | "snacks",
    ) => {
      if (!activeDayISO) return;
      if (checkLockedDay()) return;

      const transformedMeal: Meal = {
        id: `ai-meal-${Date.now()}`,
        name: generatedMeal.name,
        title: generatedMeal.name,
        description: generatedMeal.description,
        ingredients: generatedMeal.ingredients || [],
        instructions: generatedMeal.instructions || "",
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

      const newMeals = [transformedMeal];
      saveAIMealsCache(newMeals, activeDayISO, slot);

      if (board) {
        const dayLists = getDayLists(board, activeDayISO);
        const currentSlotMeals = dayLists[slot];
        const nonAIMeals = currentSlotMeals.filter(
          (m) => !m.id.startsWith("ai-meal-"),
        );
        const updatedSlotMeals = [...nonAIMeals, transformedMeal];
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

        try {
          await saveBoard(updatedBoard);
          clearAIMealsCache();
          window.dispatchEvent(new Event("macros:updated"));
        } catch (error) {
          console.error("Failed to save AI meal to server:", error);
        }
      }

      toast({
        title: "AI Meal Created!",
        description: `${generatedMeal.name} saved to your ${slot}`,
      });
    },
    [board, activeDayISO, toast, saveBoard, weekStartISO],
  );

  const profile = useOnboardingProfile();
  const targets = computeTargetsFromOnboarding(profile);

  // 🔧 FIX #1: Use real macro tracking instead of board state
  const macroData = useTodayMacros(effectiveUserId || "");
  const nutritionBudget = useNutritionBudget(effectiveUserId || "");
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
  const totals = {
    calories: macroData.kcal || 0,
    protein: macroData.protein || 0,
    carbs: macroData.carbs || 0,
    fat: macroData.fat || 0,
  };

  // 🔧 FIX #2: Auto-reset macros at midnight in user's timezone
  const userTimezone = "America/Chicago"; // Default timezone - could be enhanced with user preference

  useMidnightReset(userTimezone, () => {
    console.log("🌅 Midnight macro reset triggered");
    // Force refresh of today's macros at midnight
    queryClient.invalidateQueries({
      queryKey: ["/api/users", effectiveUserId || "", "macros", "today"],
    });
    // Also dispatch the global event for other components
    window.dispatchEvent(new Event("macros:updated"));
  });

  // Set initial last reset date on component mount
  useEffect(() => {
    localStorage.setItem("lastDailyResetISO", todayISOInTZ(userTimezone));
  }, [userTimezone]);

  function Chip({
    label,
    value,
    target,
  }: {
    label: string;
    value: number;
    target: number;
  }) {
    const pct = target ? Math.round((value / target) * 100) : 0;
    const ok = pct >= 90 && pct <= 110; // within ±10% looks "green"
    return (
      <span
        className={`text-xs px-2 py-1 rounded-xl border ${
          ok
            ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
            : "border-amber-500/40 text-amber-300 bg-amber-500/10"
        }`}
      >
        {label}: {value} / {target}
      </span>
    );
  }

  // 🎯 Show toast when loading from cache/offline
  React.useEffect(() => {
    if (!loading && source) {
      console.log("[Board] Loaded from source:", source);
    }
  }, [loading, source]);

  // Silent error handling - Facebook-style: no UI for transient network events
  React.useEffect(() => {
    if (error) {
      console.log(
        "[Network] Board load encountered an issue, using cached data if available",
      );
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
          const slot = targetSlot as
            | "breakfast"
            | "lunch"
            | "dinner"
            | "snacks";
          quickAdd(slot, meal);
        }
      } catch (error) {
        console.error("Failed to process pending meal:", error);
        localStorage.removeItem("weeklyPlanMealToAdd");
      }
    }
  }, [board, loading]);

  // Week navigation handlers - just update weekStartISO, the useWeeklyBoard hook handles fetching with cache fallback
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

  function onItemUpdated(
    list: "breakfast" | "lunch" | "dinner" | "snacks" | "meal4" | "meal5" | "meal6",
    idx: number,
    m: Meal | null,
  ) {
    // Guard: Check if day is locked before allowing edits
    if (checkLockedDay()) return;

    setBoard((prev: any) => {
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

  async function quickAdd(
    list: "breakfast" | "lunch" | "dinner" | "snacks" | "meal4" | "meal5" | "meal6",
    meal: Meal,
  ) {
    if (!board) return;

    // Guard: Check if day is locked before allowing edits
    if (checkLockedDay()) return;

    try {
      // In Day mode, add to the specific day. In Week mode, use legacy behavior
      if (
        FEATURES.dayPlanning === "alpha" &&
        planningMode === "day" &&
        activeDayISO
      ) {
        // Add to specific day
        const dayLists = getDayLists(board, activeDayISO);
        const updatedDayLists = {
          ...dayLists,
          [list]: [...dayLists[list as keyof typeof dayLists], meal],
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
        console.log("✅ Successfully added meal to", list, "for", weekStartISO);
      }
    } catch (error) {
      console.error("Failed to add meal:", error);
    }
  }

  function openPicker(list: "breakfast" | "lunch" | "dinner" | "snacks") {
    setPickerList(list);
    setPickerOpen(true);
  }


  const handleFavoriteSelect = useCallback(async (row: SavedMealRow) => {
    if (!board || !favoritesSlot) return;
    if (checkLockedDay()) return;
    const mealObj = savedMealToMeal(row);
    try {
      const dayLists = getDayLists(board, activeDayISO);
      const updatedDayLists = { ...dayLists, [favoritesSlot]: [mealObj] };
      const updatedBoard = setDayLists(board, activeDayISO, updatedDayLists);
      setBoard(updatedBoard);
      await saveBoard(updatedBoard);
      window.dispatchEvent(new Event("macros:updated"));
      setFavoritesOpen(false);
    } catch (err) {
      console.error("Failed to insert favorite:", err);
    }
  }, [board, favoritesSlot, activeDayISO, saveBoard, checkLockedDay]);

  const lists: Array<["breakfast" | "lunch" | "dinner" | "meal4" | "meal5" | "meal6", string]> = [
    ["breakfast", "Meal 1"],
    ["lunch", "Meal 2"],
    ["dinner", "Meal 3"],
    ["meal4", "Meal 4"],
    ["meal5", "Meal 5"],
    ["meal6", "Meal 6"],
  ];

  const handleLogAllMacros = useCallback(async () => {
    if (!board) return;

    try {
      const allMeals = [
        ...board.lists.breakfast,
        ...board.lists.lunch,
        ...board.lists.dinner,
        ...board.lists.snacks,
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
          starchyCarbs:
            (meal as any).starchyCarbs ??
            (meal.nutrition as any)?.starchyCarbs ??
            0,
          fibrousCarbs:
            (meal as any).fibrousCarbs ??
            (meal.nutrition as any)?.fibrousCarbs ??
            0,
          servings: meal.servings || 1,
          source: "weekly-meal-board-bulk",
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

  if (loading || !board)
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pt-20">
        <div className="text-white/80 p-6 text-center">
          Loading meal board...
        </div>
      </div>
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-36"
    >
      <BuilderHeader title="Diabetic Meal Builder" onOpenTour={quickTour.openTour} clientId={proClientId} />
      <TrialBanner />

      {/* Main Content */}
      <div
        className="max-w-[1600px] mx-auto px-4 space-y-6"
        style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + ${proClientId ? '9rem' : '6rem'})` }}
      >
        <div className="flex justify-start mb-2">
          <HowThisWorksLink videoUrl="https://youtube.com/placeholder-diabetic" label="How builders work" />
        </div>

        <NutritionBudgetBanner className="mb-2" userId={effectiveUserId} />

        <div className="mb-6 mt-2 border border-zinc-800 bg-zinc-900/60 backdrop-blur rounded-2xl mx-4">
          <div className="px-4 py-4 flex flex-col gap-3">

            {/* ROW 1: Week Navigation */}
            <div className="flex justify-center">
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
                  {weekStartISO ? formatWeekLabel(weekStartISO) : "Loading…"}
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
                  />
                </div>
              )}

            {/* ROW 5: Bottom Actions */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">

              {/* Save Plan (LEFT) */}
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
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Saved ✓
                  </>
                ) : saving ? (
                  "Saving…"
                ) : (
                  "Save Plan"
                )}
              </Button>

              {/* Duplicate (RIGHT) */}
              <button
                type="button"
                onClick={() => setShowDuplicateDayModal(true)}
                data-testid="duplicate-button"
                className="
                  inline-flex items-center justify-center
                  rounded-2xl
                  px-4 py-2
                  text-sm font-semibold
                  text-white/90
                  bg-black/20
                  border border-white/15
                  backdrop-blur-lg
                  hover:bg-white/10 hover:border-white/25
                  transition-all
                "
                style={{ minHeight: 36 }}
              >
                Duplicate 📅
              </button>

            </div>
          </div>
        </div>

        {/* Week Board Controls */}
        {/* Render day view or week view based on mode */}
        {FEATURES.dayPlanning === "alpha" &&
        planningMode === "day" &&
        activeDayISO &&
        board
          ? // DAY MODE: Meal 1/2/3, dynamic Meal 4+, Snacks
            (() => {
              const dayLists = getDayLists(board, activeDayISO);
              return (
                <>
                  {lists.map(([key, label]) => (
                    <section
                      key={key}
                      data-meal-id={key}
                      className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur p-4"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-white/90 text-lg font-medium">{label}</h2>
                        <GlobalMealActionBar
                          slot={key as "breakfast" | "lunch" | "dinner" | "meal4" | "meal5" | "meal6"}
                          onCreateWithAI={() => {
                            setAiMealSlot(key as "breakfast" | "lunch" | "dinner" | "snacks" | "meal4" | "meal5" | "meal6");
                            setAiMealModalOpen(true);
                          }}
                          onCreateWithChef={() => {
                            setCreateWithChefSlot(key as "breakfast" | "lunch" | "dinner" | "meal4" | "meal5" | "meal6");
                            setCreateWithChefOpen(true);
                          }}
                          onSnackCreator={() => setSnackCreatorOpen(true)}
                          onSave={(meal) => quickAdd(key as "breakfast"|"lunch"|"dinner"|"snacks"|"meal4"|"meal5"|"meal6", meal)}
                          onImageReady={(mealId, imageUrl) => { setBoard(prev => { if (!prev) return prev; if (getMealImageUrl(prev, mealId) === imageUrl) return prev; const updated = updateMealImageInBoard(prev, mealId, imageUrl); saveBoard(updated).catch(() => {}); return updated; }); }}
                          onFavorites={() => {
                            setFavoritesSlot(key as "breakfast" | "lunch" | "dinner" | "meal4" | "meal5" | "meal6");
                            setFavoritesOpen(true);
                          }}
                          onLogSnack={() => {}}
                          showLogSnack={false}
                        />
                      </div>
                      <div className="space-y-3">
                        {dayLists[key as keyof typeof dayLists].map((meal: Meal, idx: number) => (
                          <MealCard
                            key={meal.id}
                            date={activeDayISO}
                            slot={key}
                            meal={meal}
                            showStarchBadge={true}
                            builderType="diabetic"
                                coachingLine="Built to keep you within your glucose target range."
                            data-wt="wmb-meal-card"
                            onUpdated={(m) => {
                              if (m === null) {
                                if (meal.id.startsWith("ai-meal-")) clearAIMealsCache();
                                const updatedDayLists = {
                                  ...dayLists,
                                  [key]: dayLists[key as keyof typeof dayLists].filter((e) => e.id !== meal.id),
                                };
                                const updatedBoard = setDayLists(board, activeDayISO, updatedDayLists);
                                setBoard(updatedBoard);
                                putWeekBoard(weekStartISO, updatedBoard, proClientId)
                                  .then(({ week }) => { if (week) setBoard(week); })
                                  .catch((err) => {
                                    console.error("❌ Delete sync failed (Day mode):", err);
                                    toast({ title: "Sync pending", description: "Changes will sync automatically." });
                                  });
                              } else {
                                const updatedDayLists = {
                                  ...dayLists,
                                  [key]: dayLists[key as keyof typeof dayLists].map((e, i) => i === idx ? m : e),
                                };
                                const updatedBoard = setDayLists(board, activeDayISO, updatedDayLists);
                                putWeekBoard(weekStartISO, updatedBoard, proClientId).then(({ week }) => setBoard(week));
                              }
                            }}
                          />
                        ))}
                        {dayLists[key as keyof typeof dayLists].length === 0 && (
                          <div className="rounded-2xl border border-dashed border-zinc-700 text-white/50 p-6 text-center text-sm">
                            <p className="mb-2">No {label.toLowerCase()} yet</p>
                            <p className="text-xs text-white/40">Use "Create with Chef" or "+" to add meals</p>
                          </div>
                        )}
                      </div>
                    </section>
                  ))}

                  {/* Snack Creator Section */}
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
                        onFavorites={() => { setFavoritesSlot("snacks"); setFavoritesOpen(true); }}
                      />
                    </div>
                    <div className="space-y-3">
                      {dayLists.snacks.map((meal: Meal) => (
                        <MealCard key={meal.id} date={activeDayISO} slot="snacks" meal={meal} showStarchBadge={true} builderType="diabetic"
                                coachingLine="Built to keep you within your glucose target range."
                          onUpdated={(m) => {
                            if (m === null) {
                              const updatedDayLists = { ...dayLists, snacks: dayLists.snacks.filter((e) => e.id !== meal.id) };
                              const updatedBoard = setDayLists(board, activeDayISO, updatedDayLists);
                              setBoard(updatedBoard);
                              saveBoard(updatedBoard).catch((err) => {
                                console.error("❌ Delete sync failed:", err);
                                toast({ title: "Sync pending", description: "Changes will sync automatically." });
                              });
                            } else {
                              const updatedDayLists = { ...dayLists, snacks: dayLists.snacks.map((e) => e.id === meal.id ? m : e) };
                              const updatedBoard = setDayLists(board, activeDayISO, updatedDayLists);
                              saveBoard(updatedBoard);
                            }
                          }}
                        />
                      ))}
                      {dayLists.snacks.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-zinc-700 text-white/50 p-6 text-center text-sm">
                          <p className="mb-2">No snacks yet</p>
                          <p className="text-xs text-white/40">Use "Create with Chef" to create snacks</p>
                        </div>
                      )}
                    </div>
                  </section>
                </>
              );
            })()
          : // WEEK MODE: Meal 1/2/3 only
            lists.map(([key, label]) => (
              <section
                key={key}
                data-meal-id={key}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur p-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white/90 text-lg font-medium">{label}</h2>
                  <div className="flex gap-2">
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
                      builderType="diabetic"
                                coachingLine="Built to keep you within your glucose target range."
                      onUpdated={(m) => {
                        if (m === null) {
                          if (!board) return;
                          const updatedBoard = {
                            ...board,
                            lists: { ...board.lists, [key]: board.lists[key].filter((item: Meal) => item.id !== meal.id) },
                            version: board.version + 1,
                            meta: { ...board.meta, lastUpdatedAt: new Date().toISOString() },
                          };
                          setBoard(updatedBoard);
                          saveBoard(updatedBoard).catch((err) => {
                            console.error("❌ Delete sync failed (Board mode):", err);
                            toast({ title: "Sync pending", description: "Changes will sync automatically." });
                          });
                        } else {
                          onItemUpdated(key, idx, m);
                        }
                      }}
                    />
                  ))}
                  {board.lists[key].length === 0 && (
                    <div className="rounded-2xl border border-dashed border-zinc-700 text-white/50 p-6 text-center text-sm">
                      <p className="mb-2">No {label.toLowerCase()} yet</p>
                      <p className="text-xs text-white/40">Use "Create with Chef" or "+" to add meals</p>
                    </div>
                  )}
                </div>
              </section>
            ))}

        {/* Pro Tip Card */}
        <ProTipCard />

        {/* Daily Targets Card with Quick Add */}
        <div className="col-span-full">
          <DailyTargetsCard
            userId={effectiveUserId}
            onQuickAddClick={() => setAdditionalMacrosOpen(true)}
            targetsOverride={(() => {
              const targetMacros = getMacroTargets(effectiveUserId);
              if (!targetMacros) return { protein_g: 0, carbs_g: 0, fat_g: 0 };
              return {
                protein_g: targetMacros.protein_g || 0,
                carbs_g: targetMacros.carbs_g || 0,
                fat_g: targetMacros.fat_g || 0,
                starchyCarbs_g: targetMacros.starchyCarbs_g,
                fibrousCarbs_g: targetMacros.fibrousCarbs_g,
              };
            })()}
          />
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
              starchyCarbs:
                slots.breakfast.starchyCarbs +
                slots.lunch.starchyCarbs +
                slots.dinner.starchyCarbs +
                slots.snacks.starchyCarbs,
              fibrousCarbs:
                slots.breakfast.fibrousCarbs +
                slots.lunch.fibrousCarbs +
                slots.dinner.fibrousCarbs +
                slots.snacks.fibrousCarbs,
            };
            const dayAlreadyLocked = isDayLocked(activeDayISO, effectiveUserId);

            if (proClientId) return null;
            return (
              <div className="col-span-full mb-6">
                <RemainingMacrosFooter
                  consumedOverride={consumed}
                  showSaveButton={!dayAlreadyLocked}
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
                        fat: consumed.fat,
                        calories: consumed.calories,
                        starchyCarbs: consumed.starchyCarbs,
                        fibrousCarbs: consumed.fibrousCarbs,
                        dateISO: activeDayISO,
                      });
                      toast({
                        title: "Day Saved to Biometrics",
                        description: `${formatDateDisplay(activeDayISO, { weekday: "long", month: "short", day: "numeric" })} has been locked.`,
                      });
                      setLocation("/my-biometrics");
                    }
                  }}
                />
              </div>
            );
          })()}

        {/* Bottom spacing to clear fixed shopping bar */}
        <div className="col-span-full h-18" />
      </div>

      {/* MealPickerDrawer handles ALL meal slots (breakfast, lunch, dinner, snacks) */}
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

      <WeeklyOverviewModal
        open={showOverview}
        onClose={() => setShowOverview(false)}
        weekStartISO={weekStartISO}
        board={board}
        onJumpToDay={undefined} // wire later if/when day-level boards are added
      />

      {/* NEW: Duplicate Day Modal */}
      {FEATURES.dayPlanning === "alpha" && (
        <DuplicateDayModal
          isOpen={showDuplicateDayModal}
          onClose={() => setShowDuplicateDayModal(false)}
          onConfirm={handleDuplicateDay}
          sourceDateISO={activeDayISO}
          availableDates={weekDatesList.filter((date) => date !== activeDayISO)}
        />
      )}


      {/* Why Drawer */}
      {FEATURES.explainMode === "alpha" && (
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

      {/* Meal Premade Picker Modal */}
      <MealPremadePicker
        open={premadePickerOpen}
        onClose={() => setPremadePickerOpen(false)}
        mealType={premadePickerSlot}
        dietType="diabetic"
        onMealSelect={handlePremadeSelect}
      />

      {/* Create With Chef Modal - with diabetic guardrails */}
      <CreateWithChefModal
        open={createWithChefOpen}
        onOpenChange={setCreateWithChefOpen}
        mealType={createWithChefSlot}
        onMealGenerated={handleChefMealGenerated}
        dietType="diabetic"
        starchContext={starchContext}
        remainingMacros={remainingMacrosForChef}
        builderMode="targeted"
      />

      {/* Snack Creator Modal (Phase 2 - craving to healthy snack) - with diabetic guardrails */}
      <SnackCreatorModal
        open={snackCreatorOpen}
        onOpenChange={setSnackCreatorOpen}
        onSnackGenerated={handleSnackSelect}
        dietType="diabetic"
        starchContext={starchContext}
      />

      {/* Shopping bar */}
      <BuilderShoppingBar
        board={board}
        activeDayISO={activeDayISO}
        weekDatesList={weekDatesList}
        sourceSlug="diabetic-meal-board"
      />

      {/* Daily Totals Info Modal - Next Steps After First Meal */}
      <Dialog
        open={showDailyTotalsInfo}
        onOpenChange={(open) => {
          if (!open) {
            setShowDailyTotalsInfo(false);
            setHasSeenDailyTotalsInfo(true);
            localStorage.setItem(
              "diabetic-menu-builder-daily-totals-info-seen",
              "true",
            );
          }
        }}
      >
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
                  Send your day to the Macro Calculator to ensure you're hitting
                  your nutrition targets. Look for the "Send to Macros" button
                  below.
                </p>
              </div>

              <div className="bg-black/30 p-3 rounded-lg border border-white/10">
                <p className="font-semibold text-white mb-1">
                  Option 2: Plan Your Week
                </p>
                <p className="text-white/70 text-xs">
                  Use the Day/Week toggle at the top to switch between planning
                  a single day or your entire week. You can duplicate days or
                  create each day individually.
                </p>
              </div>

              <div className="bg-black/30 p-3 rounded-lg border border-white/10">
                <p className="font-semibold text-white mb-1">
                  💡 Pro Tip: Macro Tracking
                </p>
                <p className="text-white/70 text-xs">
                  Send just ONE day to macros at a time (not the whole week).
                  This way, if you change meals on other days, you won't have
                  outdated data.
                </p>
              </div>

              <div className="bg-black/30 p-3 rounded-lg border border-white/10">
                <p className="font-semibold text-white mb-1 flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-emerald-400" />
                  Shopping List Ready
                </p>
                <p className="text-white/70 text-xs">
                  You CAN send your entire week to the shopping list! This
                  consolidates all ingredients for easy grocery shopping. Click
                  "Send Entire Week" at the bottom.
                </p>
              </div>
            </div>

            <p className="text-xs text-white/60 text-center pt-2 border-t border-white/10">
              Next: Check out the Shopping List to learn how to use it
              effectively!
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Tour Modal */}
      <QuickTourModal
        isOpen={quickTour.shouldShow}
        onClose={quickTour.closeTour}
        title="Diabetic Meal Builder Guide"
        steps={DIABETIC_BUILDER_TOUR_STEPS}
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

      {/* Favorites Picker Modal */}
      <FavoritesPickerModal
        open={favoritesOpen}
        onClose={() => setFavoritesOpen(false)}
        onSelect={handleFavoriteSelect}
        targetLabel={`Meal ${favoritesSlot.charAt(0).toUpperCase() + favoritesSlot.slice(1)}`}
      />

      {/* Additional Macros Modal */}
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
    </motion.div>
  );
}
