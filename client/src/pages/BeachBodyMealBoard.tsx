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
import { MealCard, Meal } from "@/components/MealCard";
import {
  type WeekBoard,
  getDayLists,
  setDayLists,
  cloneDayLists,
  putWeekBoard,
  getWeekBoardByDate,
} from "@/lib/boardApi";
import { ManualMealModal } from "@/components/pickers/ManualMealModal";
import { AthleteMealPickerDrawer } from "@/components/pickers/AthleteMealPickerDrawer";
import SnackPickerDrawer from "@/components/pickers/SnackPickerDrawer";
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
import WeeklyOverviewModal from "@/components/WeeklyOverviewModal";
import ShoppingAggregateBar from "@/components/ShoppingAggregateBar";
import { normalizeIngredients } from "@/utils/ingredientParser";
import { useShoppingListStore } from "@/stores/shoppingListStore";
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
import ShoppingListPreviewModal from "@/components/ShoppingListPreviewModal";
import { useWeeklyBoard } from "@/hooks/useWeeklyBoard";
// CHICAGO CALENDAR FIX v1.0: getMondayISO replaced with getWeekStartISOInTZ from midnight.ts
import { v4 as uuidv4 } from "uuid";
import {
  Plus,
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
  Trash2,
  ChefHat,
} from "lucide-react";
import { FEATURES } from "@/utils/features";
import { DayWeekToggle } from "@/components/DayWeekToggle";
import { DayChips } from "@/components/DayChips";
import { DailyStarchIndicator } from "@/components/DailyStarchIndicator";
import { DuplicateDayModal } from "@/components/DuplicateDayModal";
import { DuplicateWeekModal } from "@/components/DuplicateWeekModal";
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
import { computeTargetsFromOnboarding } from "@/lib/targets";
import { useTodayMacros } from "@/hooks/useTodayMacros";
import { useOnboardingProfile } from "@/hooks/useOnboardingProfile";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { QuickTourButton } from "@/components/guided/QuickTourButton";

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

// Fixed Meal Slots (Meals 1-3 only, dynamic meals 4+ handled separately)
const lists: Array<["breakfast" | "lunch" | "dinner" | "snacks", string]> = [
  ["breakfast", "Meal 1"],
  ["lunch", "Meal 2"],
  ["dinner", "Meal 3"],
];

export default function BeachBodyMealBoard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const quickTour = useQuickTour("beach-body-meal-board");
  const { user } = useAuth();

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

  // Board loading
  // CHICAGO CALENDAR FIX v1.0: Using noon UTC anchor pattern
  const [weekStartISO, setWeekStartISO] =
    React.useState<string>(getWeekStartISOInTZ("America/Chicago"));
  const {
    board: hookBoard,
    loading: hookLoading,
    error,
    save: saveToHook,
  } = useWeeklyBoard(clientId, weekStartISO);

  const [board, setBoard] = React.useState<WeekBoard | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);

  React.useEffect(() => {
    if (hookBoard) {
      setBoard(hookBoard);
      setLoading(hookLoading);
    }
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
        // Calm, non-alarming message - will retry automatically
        toast({
          title: "Saving...",
          description: "We'll retry automatically.",
          duration: 3000,
        });
      } finally {
        setSaving(false);
      }
    },
    [saveToHook, toast],
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
  const [manualModalOpen, setManualModalOpen] = React.useState(false);
  const [manualModalList, setManualModalList] = React.useState<
    "breakfast" | "lunch" | "dinner" | "snacks" | null
  >(null);
  const [showOverview, setShowOverview] = React.useState(false);

  // Snack Picker state
  const [snackPickerOpen, setSnackPickerOpen] = useState(false);
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
        isDayLocked(dayToCheck, user?.id)
      ) {
        setPendingLockedDayISO(dayToCheck);
        setLockedDayDialogOpen(true);
        return true; // Day is locked, block edit
      }
      return false; // Day is not locked, allow edit
    },
    [activeDayISO, planningMode, user?.id],
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
    "breakfast" | "lunch" | "dinner" | "snacks"
  >("breakfast");

  // Create With Chef modal state
  const [createWithChefOpen, setCreateWithChefOpen] = useState(false);
  const [createWithChefSlot, setCreateWithChefSlot] = useState<
    "breakfast" | "lunch" | "dinner"
  >("breakfast");

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

  // Snack Creator modal state (Phase 2)
  const [snackCreatorOpen, setSnackCreatorOpen] = useState(false);

  // Guided Tour state
  const [hasSeenInfo, setHasSeenInfo] = useState(false);
  const [tourStep, setTourStep] = useState<
    "breakfast" | "lunch" | "dinner" | "snacks" | "complete"
  >("breakfast");

  const [showDuplicateDayModal, setShowDuplicateDayModal] =
    React.useState(false);
  const [showDuplicateWeekModal, setShowDuplicateWeekModal] =
    React.useState(false);

  // Shopping list modal state
  const [shoppingListModal, setShoppingListModal] = useState<{
    isOpen: boolean;
    meal: any | null;
  }>({ isOpen: false, meal: null });

  // Dynamic meal slot tracking (Meal 4+) - track specific slot numbers as a Set
  const [dynamicSlots, setDynamicSlots] = useState<Set<number>>(new Set());

  // Derive dynamicSlots from saved meals when board loads
  useEffect(() => {
    if (!board) return;

    // Scan all snacks for bb-dyn-{N}- prefixed meals to find which slots exist
    const allSnacks =
      planningMode === "day" && activeDayISO
        ? getDayLists(board, activeDayISO).snacks
        : board.lists.snacks;

    const slots = new Set<number>();
    const prefix = "bb-dyn-";
    allSnacks.forEach((meal: Meal) => {
      if (meal.id.startsWith(prefix)) {
        const match = meal.id.match(/bb-dyn-(\d+)-/);
        if (match) {
          slots.add(parseInt(match[1], 10));
        }
      }
    });

    setDynamicSlots(slots);
  }, [board, planningMode, activeDayISO]);

  // Calculate next available slot number
  const nextSlotNumber = useMemo(() => {
    if (dynamicSlots.size === 0) return 4;
    return Math.max(...Array.from(dynamicSlots)) + 1;
  }, [dynamicSlots]);

  // Add a new dynamic meal slot
  const handleAddMealSlot = useCallback(() => {
    const newSlot = nextSlotNumber;
    setDynamicSlots((prev) => new Set([...prev, newSlot]));
    toast({
      title: "Meal Slot Added",
      description: `Meal ${newSlot} is ready to use`,
    });
  }, [nextSlotNumber, toast]);

  // Remove a dynamic meal slot and clean up board data
  const handleRemoveMealSlot = useCallback(
    async (mealNumber: number) => {
      if (!board) return;

      try {
        const slotPrefix = `bb-dyn-${mealNumber}-`;

        if (
          FEATURES.dayPlanning === "alpha" &&
          planningMode === "day" &&
          activeDayISO
        ) {
          // DAY MODE: Remove meals from day-specific lists
          const dayLists = getDayLists(board, activeDayISO);
          const updatedDayLists = {
            ...dayLists,
            snacks: dayLists.snacks.filter(
              (m: Meal) => !m.id.startsWith(slotPrefix),
            ),
          };
          const updatedBoard = setDayLists(
            board,
            activeDayISO,
            updatedDayLists,
          );
          await saveBoard(updatedBoard);
        } else {
          // WEEK MODE: Remove meals from global snacks list
          const updatedBoard = {
            ...board,
            lists: {
              ...board.lists,
              snacks: board.lists.snacks.filter(
                (m: Meal) => !m.id.startsWith(slotPrefix),
              ),
            },
          };
          await saveBoard(updatedBoard);
        }

        // Remove slot from set
        setDynamicSlots((prev) => {
          const newSet = new Set(prev);
          newSet.delete(mealNumber);
          return newSet;
        });

        toast({
          title: "Meal Slot Removed",
          description: `Meal ${mealNumber} has been deleted`,
        });
      } catch (err) {
        console.error("Failed to remove meal slot:", err);
        toast({
          title: "Error",
          description: "Failed to remove meal slot",
          variant: "destructive",
        });
      }
    },
    [board, planningMode, activeDayISO, saveBoard, toast],
  );

  // Sorted array of dynamic slot numbers for rendering
  const sortedDynamicSlots = useMemo(
    () => Array.from(dynamicSlots).sort((a, b) => a - b),
    [dynamicSlots],
  );

  // Track current dynamic slot for meal additions
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

      // Guard: Check if any TARGET date is locked before allowing edits
      const lockedTarget = targetDates.find((d) => isDayLocked(d, user?.id));
      if (lockedTarget) {
        setPendingLockedDayISO(lockedTarget);
        setLockedDayDialogOpen(true);
        return;
      }

      const sourceLists = getDayLists(board, activeDayISO);
      const clonedLists = cloneDayLists(sourceLists);

      let updatedBoard = board;
      targetDates.forEach((dateISO) => {
        updatedBoard = setDayLists(updatedBoard, dateISO, clonedLists);
      });

      try {
        await saveBoard(updatedBoard);
        toast({
          title: "Day duplicated",
          description: `Copied to ${targetDates.length} day(s)`,
        });
      } catch (error) {
        console.error("Failed to duplicate day:", error);
        toast({
          title: "Failed to duplicate",
          description: "Please try again",
          variant: "destructive",
        });
      }
    },
    [board, activeDayISO, saveBoard, toast],
  );

  const handleDuplicateWeek = useCallback(
    async (targetWeekStartISO: string) => {
      if (!board) return;

      // Guard: Check if any day in TARGET week is locked
      // CHICAGO CALENDAR FIX v1.0: Use safe weekDatesInTZ
      const targetWeekDates = weekDatesInTZ(targetWeekStartISO, "America/Chicago");
      const lockedTarget = targetWeekDates.find((d) =>
        isDayLocked(d, user?.id),
      );
      if (lockedTarget) {
        setPendingLockedDayISO(lockedTarget);
        setLockedDayDialogOpen(true);
        return;
      }

      // CHICAGO CALENDAR FIX v1.0: Use safe weekDatesInTZ for target week dates
      const clonedBoard = {
        ...board,
        id: `week-${targetWeekStartISO}`,
        days: board.days
          ? Object.fromEntries(
              Object.entries(board.days).map(([oldDateISO, lists]) => {
                const dayIndex = weekDatesList.indexOf(oldDateISO);
                const targetWeekDatesSafe = weekDatesInTZ(targetWeekStartISO, "America/Chicago");
                const newDateISO = targetWeekDatesSafe[dayIndex] || oldDateISO;
                return [newDateISO, cloneDayLists(lists)];
              }),
            )
          : undefined,
      };

      try {
        await putWeekBoard(targetWeekStartISO, clonedBoard);
        setWeekStartISO(targetWeekStartISO);
        toast({
          title: "Week duplicated",
          description: `Copied to week of ${targetWeekStartISO}`,
        });
      } catch (error) {
        console.error("Failed to duplicate week:", error);
        toast({
          title: "Failed to duplicate",
          description: "Please try again",
          variant: "destructive",
        });
      }
    },
    [board, weekDatesList, toast],
  );

  const handleAddToShoppingList = useCallback(() => {
    if (!board) {
      toast({
        title: "No meals found",
        description: "Add meals to your board before creating a shopping list.",
        variant: "destructive",
      });
      return;
    }

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
      ];
    } else {
      allMeals = [
        ...board.lists.breakfast,
        ...board.lists.lunch,
        ...board.lists.dinner,
        ...board.lists.snacks,
      ];
    }

    if (allMeals.length === 0) {
      toast({
        title: "No meals found",
        description: "Add meals to your board before creating a shopping list.",
        variant: "destructive",
      });
      return;
    }

    const ingredients = allMeals.flatMap((meal) =>
      normalizeIngredients(meal.ingredients || []),
    );

    const items = ingredients.map((i) => ({
      name: i.name,
      quantity:
        typeof i.qty === "number"
          ? i.qty
          : i.qty
            ? parseFloat(String(i.qty))
            : 1,
      unit: i.unit || "",
      notes:
        planningMode === "day" && activeDayISO
          ? `${formatDateDisplay(activeDayISO, { weekday: "long" })} Beach Body Plan`
          : `Beach Body Meal Plan (${formatWeekLabel(weekStartISO)})`,
    }));

    useShoppingListStore.getState().addItems(items);

    toast({
      title: "Added to Shopping List",
      description: `${ingredients.length} items added to your master list`,
    });
  }, [board, planningMode, activeDayISO, weekStartISO, toast]);

  const handleAddEntireWeekToShoppingList = useCallback(() => {
    if (!board) {
      toast({
        title: "No meals found",
        description: "Add meals to your board before creating a shopping list.",
        variant: "destructive",
      });
      return;
    }

    let allMeals: Meal[] = [];
    weekDatesList.forEach((dateISO) => {
      const dayLists = getDayLists(board, dateISO);
      allMeals.push(
        ...dayLists.breakfast,
        ...dayLists.lunch,
        ...dayLists.dinner,
        ...dayLists.snacks,
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

    const ingredients = allMeals.flatMap((meal) =>
      normalizeIngredients(meal.ingredients || []),
    );

    const items = ingredients.map((i) => ({
      name: i.name,
      quantity:
        typeof i.qty === "number"
          ? i.qty
          : i.qty
            ? parseFloat(String(i.qty))
            : 1,
      unit: i.unit || "",
      notes: `Beach Body Meal Plan (${formatWeekLabel(weekStartISO)}) - All 7 Days`,
    }));

    useShoppingListStore.getState().addItems(items);

    toast({
      title: "Added to Shopping List",
      description: `${ingredients.length} items from entire week added to your master list`,
    });
  }, [board, weekStartISO, weekDatesList, toast]);

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
          starchyCarbs: generatedMeal.starchyCarbs || 0,
          fibrousCarbs: generatedMeal.fibrousCarbs || 0,
        },
        starchyCarbs: generatedMeal.starchyCarbs || 0,
        fibrousCarbs: generatedMeal.fibrousCarbs || 0,
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

        try {
          await saveBoard(updatedBoard);
          toast({
            title: "AI Meal Added!",
            description: `${generatedMeal.name} added to ${lists.find((l) => l[0] === slot)?.[1]}`,
          });
        } catch (error) {
          console.error("Failed to save AI meal:", error);
          toast({
            title: "Failed to save",
            description: "Please try again",
            variant: "destructive",
          });
        }
      }
    },
    [activeDayISO, board, saveBoard, toast],
  );

  // Handler for snack selection from SnackPickerDrawer
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
        window.dispatchEvent(
          new CustomEvent("board:updated", { detail: { weekStartISO } }),
        );
        window.dispatchEvent(new Event("macros:updated"));
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
    list: "breakfast" | "lunch" | "dinner" | "snacks",
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
        window.dispatchEvent(
          new CustomEvent("board:updated", { detail: { weekStartISO } }),
        );
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

  function openManualModal(list: "breakfast" | "lunch" | "dinner" | "snacks") {
    setManualModalList(list);
    setManualModalOpen(true);
  }

  // Get profile and targets for macro tracking
  const profile = useOnboardingProfile();
  const targets = useMemo(
    () => computeTargetsFromOnboarding(profile),
    [profile],
  );
  const macroData = useTodayMacros();

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
      ];
    } else {
      allMeals = [
        ...board.lists.breakfast,
        ...board.lists.lunch,
        ...board.lists.dinner,
        ...board.lists.snacks,
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
          <p>Loading Beach Body Meal Board...</p>
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

  const currentLists =
    FEATURES.dayPlanning === "alpha" && planningMode === "day" && activeDayISO
      ? getDayLists(board, activeDayISO)
      : board.lists;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-32 overflow-x-hidden"
    >
      {/* Universal Safe-Area Header Bar */}
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 pb-3 flex items-center gap-2">
          <Button
            onClick={() => setLocation("/planner")}
            className="bg-black/10 hover:bg-black/10 text-white rounded-xl border border-white/10 backdrop-blur-none flex items-center gap-1 px-3 h-10 flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </Button>
          <h1 className="text-base font-bold text-white flex-1 min-w-0 truncate">
            Beach Body Meal Builder
          </h1>
          <QuickTourButton onClick={quickTour.openTour} />
        </div>
      </div>

      {/* Main Content */}
      <div
        className="max-w-[1600px] mx-auto px-4 space-y-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
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

            {/* ROW 2: Day/Week Toggle + Duplicate */}
            {FEATURES.dayPlanning === "alpha" && (
              <div className="flex items-center justify-between gap-3">
                <DayWeekToggle
                  mode={planningMode}
                  onModeChange={setPlanningMode}
                />

                {planningMode === "day" && (
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

                {planningMode === "week" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowDuplicateWeekModal(true)}
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs px-3 py-1 rounded-xl"
                    data-testid="button-duplicate-week"
                  >
                    Copy Week...
                  </Button>
                )}
              </div>
            )}

            {/* ROW 4: Days of Week */}
            {FEATURES.dayPlanning === "alpha" &&
              planningMode === "day" &&
              weekDatesList.length > 0 && (
                <div className="flex justify-center">
                  <DayChips
                    weekDates={weekDatesList}
                    activeDayISO={activeDayISO}
                    onDayChange={setActiveDayISO}
                  />
                </div>
              )}

            {/* Daily Starch Indicator - Shows starch meal slots */}
            {FEATURES.dayPlanning === "alpha" &&
              planningMode === "day" &&
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
                data-testid="button-delete-all"
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
                              snacks: [],
                            },
                            days: board.days
                              ? Object.fromEntries(
                                  Object.keys(board.days).map((dateISO) => [
                                    dateISO,
                                    {
                                      breakfast: [],
                                      lunch: [],
                                      dinner: [],
                                      snacks: [],
                                    },
                                  ]),
                                )
                              : undefined,
                          };
                          saveBoard(clearedBoard);
                          clearAIMealsCache();
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
                            slot={key as "breakfast" | "lunch" | "dinner" | "snacks"}
                            onCreateWithAI={() => {
                              setAiMealSlot(key as "breakfast" | "lunch" | "dinner" | "snacks");
                              setAiMealModalOpen(true);
                            }}
                            onCreateWithChef={() => {
                              setCreateWithChefSlot(key as "breakfast" | "lunch" | "dinner");
                              setCreateWithChefOpen(true);
                            }}
                            onSnackCreator={() => {
                              setSnackCreatorOpen(true);
                            }}
                            onManualAdd={() => openManualModal(key)}
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

                    {/* Dynamic Meal Slots (Meal 4+) */}
                    {sortedDynamicSlots.map((mealNumber) => (
                      <section
                        key={`dyn-${mealNumber}`}
                        className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur p-4"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-white/90 text-lg font-medium">
                            Meal {mealNumber}
                          </h2>
                          <div className="flex gap-2">
                            {/* Snack Creator (replaced Create with AI) */}
                            <SnackCreatorButton
                              onClick={() => setSnackCreatorOpen(true)}
                            />

                            {/* AI Premades */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-white/80 hover:bg-black/50 border border-emerald-400/30 text-xs font-medium flex items-center gap-1"
                              onClick={() =>
                                handleOpenPremadePicker("snacks", mealNumber)
                              }
                            >
                              <ChefHat className="h-3 w-3" />
                              AI Premades
                            </Button>

                            {/* Manual entry */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-white/80 hover:bg-white/10"
                              onClick={() => {
                                setCurrentDynamicSlot(mealNumber);
                                openManualModal("snacks");
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>

                            {/* Delete slot */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-400 hover:text-red-300 hover:bg-red-900/30"
                              onClick={() => handleRemoveMealSlot(mealNumber)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {dayLists.snacks
                            .filter((m: Meal) =>
                              m.id.startsWith(`bb-dyn-${mealNumber}-`),
                            )
                            .map((meal: Meal, idx: number) => (
                              <MealCard
                                key={meal.id}
                                date={activeDayISO}
                                slot="snacks"
                                meal={meal}
                                onUpdated={(m) => {
                                  if (m === null) {
                                    const updatedDayLists = {
                                      ...dayLists,
                                      snacks: dayLists.snacks.filter(
                                        (existingMeal: Meal) =>
                                          existingMeal.id !== meal.id,
                                      ),
                                    };
                                    const updatedBoard = setDayLists(
                                      board,
                                      activeDayISO,
                                      updatedDayLists,
                                    );
                                    saveBoard(updatedBoard);
                                  } else {
                                    const updatedDayLists = {
                                      ...dayLists,
                                      snacks: dayLists.snacks.map(
                                        (existingMeal: Meal) =>
                                          existingMeal.id === meal.id
                                            ? m
                                            : existingMeal,
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
                            ))}
                          {dayLists.snacks.filter((m: Meal) =>
                            m.id.startsWith(`bb-dyn-${mealNumber}-`),
                          ).length === 0 && (
                            <div className="rounded-2xl border border-dashed border-zinc-700 text-white/50 p-6 text-center text-sm">
                              <p className="mb-2">No meals yet</p>
                              <p className="text-xs text-white/40">
                                Use buttons above to add meals
                              </p>
                            </div>
                          )}
                        </div>
                      </section>
                    ))}

                    {/* Add Meal Button */}
                    <section className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/20 backdrop-blur p-4 flex items-center justify-center min-h-[120px]">
                      <Button
                        variant="ghost"
                        className="text-white/60 hover:text-white hover:bg-white/10 flex flex-col items-center gap-2 py-6"
                        onClick={handleAddMealSlot}
                      >
                        <Plus className="h-8 w-8" />
                        <span className="text-sm">
                          Add Meal {nextSlotNumber}
                        </span>
                      </Button>
                    </section>
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

                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white/80 hover:bg-white/10"
                        onClick={() => openManualModal(key)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
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

          {/* Add Meal Button - WEEK MODE */}
          <div className="col-span-full flex justify-center my-4">
            <Button
              onClick={handleAddMealSlot}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 py-3 rounded-xl flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Add Meal {nextSlotNumber}
            </Button>
          </div>

          {/* Snack Card - Below Add Meal Button, Above Daily Totals */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur p-4 col-span-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white/90 text-lg font-medium">Snacks</h2>
              <div className="flex gap-2">
                {/* Snack Creator (replaced Create with AI) */}
                <SnackCreatorButton
                  onClick={() => setSnackCreatorOpen(true)}
                />

                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white/80 hover:bg-white/10"
                  onClick={() => openManualModal("snacks")}
                  data-wt="wmb-add-custom-button"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
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
              userId={user?.id}
              onQuickAddClick={() => setAdditionalMacrosOpen(true)}
              targetsOverride={(() => {
                const resolved = getResolvedTargets(user?.id);
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
              const computeSlotMacros = (meals: Meal[]) => ({
                count: meals.length,
                calories: meals.reduce(
                  (sum, m) => sum + (m.nutrition?.calories || 0),
                  0,
                ),
                protein: meals.reduce(
                  (sum, m) => sum + (m.nutrition?.protein || 0),
                  0,
                ),
                carbs: meals.reduce(
                  (sum, m) => sum + (m.nutrition?.carbs || 0),
                  0,
                ),
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
              const dayAlreadyLocked = isDayLocked(activeDayISO, user?.id);

              return (
                <div className="col-span-full mb-6">
                  <RemainingMacrosFooter
                    consumedOverride={consumed}
                    showSaveButton={!dayAlreadyLocked}
                    layoutMode="inline"
                    onSaveDay={async () => {
                      const raw = getMacroTargets(user?.id);
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
                        user?.id,
                      );

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
                        setLocation('/my-biometrics');
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
          onPick={(meal) => {
            if (pickerList) {
              quickAdd(pickerList, meal);
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

        {/* Snack Picker Drawer - Competition prep snacks (one category) */}
        <SnackPickerDrawer
          open={snackPickerOpen}
          onClose={() => setSnackPickerOpen(false)}
          onSnackSelect={handleSnackSelect}
          dietType="competition"
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
            availableDates={weekDatesList.filter(
              (date) => date !== activeDayISO,
            )}
          />
        )}

        {FEATURES.dayPlanning === "alpha" && (
          <DuplicateWeekModal
            isOpen={showDuplicateWeekModal}
            onClose={() => setShowDuplicateWeekModal(false)}
            onConfirm={handleDuplicateWeek}
            sourceWeekStartISO={weekStartISO}
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
            const resolved = getResolvedTargets(user?.id);
            return Math.max(
              0,
              (resolved.protein_g || 0) - Math.round(totals.protein),
            );
          })()}
          carbsDeficit={(() => {
            const resolved = getResolvedTargets(user?.id);
            return Math.max(
              0,
              (resolved.carbs_g || 0) - Math.round(totals.carbs),
            );
          })()}
        />

        {/* Create With Chef Modal - with BeachBody guardrails */}
        <CreateWithChefModal
          open={createWithChefOpen}
          onOpenChange={setCreateWithChefOpen}
          mealType={createWithChefSlot}
          onMealGenerated={handleChefMealGenerated}
          dietType="beachbody"
          dietPhase="lean"
          starchContext={starchContext}
        />

        {/* Snack Creator Modal (Phase 2 - craving to healthy snack) - with BeachBody guardrails */}
        <SnackCreatorModal
          open={snackCreatorOpen}
          onOpenChange={setSnackCreatorOpen}
          onSnackGenerated={handleSnackSelect}
          dietType="beachbody"
          dietPhase="lean"
        />

        {board &&
          (() => {
            const currentBoard = board;

            const allMeals =
              planningMode === "day" && activeDayISO
                ? (() => {
                    const dayLists = getDayLists(currentBoard, activeDayISO);
                    return [
                      ...dayLists.breakfast,
                      ...dayLists.lunch,
                      ...dayLists.dinner,
                      ...dayLists.snacks,
                    ];
                  })()
                : [
                    ...currentBoard.lists.breakfast,
                    ...currentBoard.lists.lunch,
                    ...currentBoard.lists.dinner,
                    ...currentBoard.lists.snacks,
                  ];

            const ingredients = allMeals.flatMap((meal) =>
              normalizeIngredients(meal.ingredients || []),
            );

            if (ingredients.length === 0) return null;

            if (
              FEATURES.dayPlanning === "alpha" &&
              planningMode === "day" &&
              activeDayISO
            ) {
              const dayName = formatDateDisplay(activeDayISO, { weekday: "long" });

              return (
                <div className="fixed bottom-0 left-0 right-0 z-[60] bg-gradient-to-r from-zinc-900/95 via-zinc-800/95 to-black/95 backdrop-blur-xl border-t border-white/20 shadow-2xl safe-area-inset-bottom">
                  <div className="container mx-auto px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <div className="text-white text-sm font-semibold">
                        Shopping List Ready - {ingredients.length} ingredients
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            handleAddToShoppingList();
                            setTimeout(
                              () =>
                                setLocation(
                                  "/shopping-list-v2?from=beach-body-meal-board",
                                ),
                              100,
                            );
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
                            setTimeout(
                              () =>
                                setLocation(
                                  "/shopping-list-v2?from=beach-body-meal-board",
                                ),
                              100,
                            );
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

            return (
              <ShoppingAggregateBar
                ingredients={ingredients}
                source="Beach Body Meal Board"
                sourceSlug="beach-body-meal-board"
              />
            );
          })()}

        {/* Quick Tour Modal */}
        <QuickTourModal
          isOpen={quickTour.shouldShow}
          onClose={quickTour.closeTour}
          title="How to Build Your Beach Body Meals"
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
      </div>
    </motion.div>
  );
}
