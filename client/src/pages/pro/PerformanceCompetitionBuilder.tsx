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
import { duplicateAcrossWeeks } from "@/utils/crossWeekDuplicate";
import { ManualMealModal } from "@/components/pickers/ManualMealModal";
import { CompetitionMealPickerDrawer } from "@/components/pickers/CompetitionMealPickerDrawer";
import SnackPickerDrawer from "@/components/pickers/SnackPickerDrawer";
import { CreateWithChefButton } from "@/components/CreateWithChefButton";
import { CreateWithChefModal } from "@/components/CreateWithChefModal";
import { SnackCreatorModal } from "@/components/SnackCreatorModal";
import { getResolvedTargets } from "@/lib/macroResolver";
import { classifyMeal } from "@/utils/starchMealClassifier";
import type { StarchContext } from "@/hooks/useCreateWithChefRequest";
import { SnackCreatorButton } from "@/components/SnackCreatorButton";
import { GlobalMealActionBar } from "@/components/GlobalMealActionBar";
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
  formatDateDisplay
} from "@/utils/midnight";
import ShoppingListPreviewModal from "@/components/ShoppingListPreviewModal";
import { useWeeklyBoard } from "@/hooks/useWeeklyBoard";
// CHICAGO CALENDAR FIX v1.0: getMondayISO replaced with getWeekStartISOInTZ from midnight.ts
import { v4 as uuidv4 } from "uuid";
import {
  Plus,
  Check,
  Sparkles,
  BarChart3,
  ShoppingCart,
  X,
  Trash2,
  ChevronLeft,
  Calendar,
  ChevronRight,
  Copy,
  Target,
  ChefHat,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FEATURES } from "@/utils/features";
import { DayChips } from "@/components/DayChips";
import { DailyStarchIndicator } from "@/components/DailyStarchIndicator";
import { useBodyFatStarchAdjustment } from "@/hooks/useBodyFatStarchAdjustment";
import { DuplicateDayModal } from "@/components/DuplicateDayModal";
import { DuplicateWeekModal } from "@/components/DuplicateWeekModal";
import { setMacroTargets } from "@/lib/dailyLimits";
import { proStore } from "@/lib/proData";
import { linkUserToClient } from "@/lib/macroResolver";
import { saveLastPerformanceClientId } from "@/lib/macroSourcesConfig";
import MealProgressCoach from "@/components/guided/MealProgressCoach";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { BuilderHeader } from "@/components/pro/BuilderHeader";
import { TrialBanner } from "@/components/TrialBanner";
import { useMealBoardDraft } from "@/hooks/useMealBoardDraft";

const PERFORMANCE_TOUR_STEPS: TourStep[] = [
  {
    icon: "1",
    title: "Competition Prep",
    description:
      "Build precise meal plans for bodybuilding shows and athletic events.",
  },
  {
    icon: "2",
    title: "Exact Macros",
    description:
      "Hit your protein, carb, and fat targets with precision-calculated meals.",
  },
  {
    icon: "3",
    title: "Meal Timing",
    description: "Add Meal 4+ for optimal nutrient timing around training.",
  },
  {
    icon: "4",
    title: "Copy Days",
    description: "Duplicate meal plans for consistent prep week over week.",
  },
  {
    icon: "5",
    title: "Shopping List",
    description: "Export ingredients for meal prep shopping runs.",
  },
  {
    icon: "6",
    title: "Track Progress & Save Day",
    description: "Review your color-coded progress at the bottom of the page, then tap Save Day to lock your plan into Biometrics.",
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

// CHICAGO CALENDAR FIX v1.0: All date utilities now imported from midnight.ts
// Using noon UTC anchor pattern to prevent day-shift bugs

// Pro Care Meal Slots - 3 meals for competition prep (fixed)
const lists: Array<["breakfast" | "lunch" | "dinner", string]> = [
  ["breakfast", "Meal 1"],
  ["lunch", "Meal 2"],
  ["dinner", "Meal 3"],
];

// Meal 5 will be rendered separately using the snacks slot
// Dynamic meals (6+) will be stored in board.days[date].snacks array with special prefix

interface AthleteBoardProps {
  mode?: "athlete" | "procare";
}

export default function AthleteBoard({ mode = "athlete" }: AthleteBoardProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const quickTour = useQuickTour("performance-competition-builder");
  
  // Body fat-based starch slot adjustment (includes +1 bonus if below goal for performance builders)
  const bodyFatAdjustment = useBodyFatStarchAdjustment("performance_competition");

  // Route params
  const [, athleteParams] = useRoute("/athlete-meal-board/:clientId");
  const [, proParams] = useRoute(
    "/pro/clients/:id/performance-competition-builder",
  );
  const routeClientId = athleteParams?.clientId || proParams?.id;

  // In standalone mode, use current user's ID; in procare mode, use route clientId
  const clientId =
    mode === "procare" ? routeClientId : routeClientId || user?.id || null;

  // Safety check: redirect only if procare mode without clientId
  useEffect(() => {
    if (mode === "procare" && !clientId) {
      setLocation("/dashboard");
    } else if (clientId) {
      // Save clientId for "Came From" dropdown routing (procare mode only)
      if (mode === "procare") {
        saveLastPerformanceClientId(clientId);
      }
    }
  }, [clientId, setLocation, mode]);

  if (mode === "procare" && !clientId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 flex items-center justify-center">
        <div className="text-white text-center">
          <p>Missing client ID. Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  // 🎯 BULLETPROOF BOARD LOADING
  // CHICAGO CALENDAR FIX v1.0: Using noon UTC anchor pattern
  const [weekStartISO, setWeekStartISO] =
    React.useState<string>(getWeekStartISOInTZ("America/Chicago"));
  const {
    board: hookBoard,
    loading: hookLoading,
    error,
    save: saveToHook,
    source,
  } = useWeeklyBoard(clientId, weekStartISO);

  // Local mutable board state for optimistic updates
  const [board, setBoard] = React.useState<WeekBoard | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);

  // Draft persistence for crash/reload recovery
  const { clearDraft, skipServerSync, markClean } = useMealBoardDraft(
    {
      userId: clientId,
      builderId: 'performance-competition-builder',
      weekStartISO,
    },
    board,
    setBoard,
    hookLoading,
    hookBoard
  );

  // Sync hook board to local state — initial hydration must ALWAYS succeed
  const boardInitializedRef = React.useRef(false);
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
        await saveToHook(updatedBoard as any, uuidv4());
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
        clearDraft();
        markClean();
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
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = React.useState(false);



  // Create With Chef modal state
  const [createWithChefOpen, setCreateWithChefOpen] = useState(false);
  const [createWithChefSlot, setCreateWithChefSlot] = useState<
    "breakfast" | "lunch" | "dinner"
  >("breakfast");

  // Day/Week planning state (moved up for starchContext dependency)
  const [planningMode, setPlanningMode] = React.useState<"day" | "week">("day");
  const [activeDayISO, setActiveDayISO] = React.useState<string>("");

  // Build StarchContext for Create With Chef modal
  const starchContext: StarchContext | undefined = useMemo(() => {
    if (!board || !activeDayISO) return undefined;
    const resolved = clientId ? getResolvedTargets(clientId) : null;
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
  }, [board, activeDayISO, clientId]);

  // Snack Creator modal state (Phase 2)
  const [snackCreatorOpen, setSnackCreatorOpen] = useState(false);

  // Snack Picker state
  const [snackPickerOpen, setSnackPickerOpen] = useState(false);

  // Guided Tour state
  const [hasSeenInfo, setHasSeenInfo] = useState(false);
  const [tourStep, setTourStep] = useState<
    "breakfast" | "lunch" | "dinner" | "snacks" | "complete"
  >("breakfast");

  // Daily Totals Info state (appears after first meal is created)
  const [showDailyTotalsInfo, setShowDailyTotalsInfo] = useState(false);
  const [hasSeenDailyTotalsInfo, setHasSeenDailyTotalsInfo] = useState(false);

  const [showDuplicateDayModal, setShowDuplicateDayModal] =
    React.useState(false);
  const [showDuplicateWeekModal, setShowDuplicateWeekModal] =
    React.useState(false);

  // Shopping list modal state
  const [shoppingListModal, setShoppingListModal] = useState<{
    isOpen: boolean;
    meal: any | null;
  }>({ isOpen: false, meal: null });

  // Dynamic meal tracking (Meal 6+)
  const [dynamicMealCount, setDynamicMealCount] = useState(0);

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

  // 🔋 AI Meal Creator localStorage persistence (copy Weekly Meal Board pattern)
  const AI_MEALS_CACHE_KEY = "ai-athlete-meal-creator-cached-meals";

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

  // Generate week dates
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

  // 🔋 Load AI meals from localStorage on mount or day change
  useEffect(() => {
    if (!board || !activeDayISO) return;

    const cached = loadAIMealsCache();
    if (cached && cached.dayISO === activeDayISO && cached.meals.length > 0) {
      console.log(
        "🔋 Loading AI meals from localStorage:",
        cached.meals.length,
        "meals for",
        activeDayISO,
        "into slot:",
        cached.slot,
      );

      // Merge cached AI meals into the correct slot
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

  // Load/save tour progress from localStorage
  useEffect(() => {
    const infoSeen = localStorage.getItem(
      "performance-competition-builder-info-seen",
    );
    if (infoSeen === "true") {
      setHasSeenInfo(true);
    } else {
      // Auto-mark as seen since Copilot provides guidance now
      setHasSeenInfo(true);
      localStorage.setItem("performance-competition-builder-info-seen", "true");
    }

    const dailyTotalsInfoSeen = localStorage.getItem(
      "performance-competition-builder-daily-totals-info-seen",
    );
    if (dailyTotalsInfoSeen === "true") {
      setHasSeenDailyTotalsInfo(true);
    }

    const savedStep = localStorage.getItem(
      "performance-competition-builder-tour-step",
    );
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

  // Update tour step when meals are created
  useEffect(() => {
    if (!board) return;

    const lists =
      planningMode === "day" && activeDayISO
        ? getDayLists(board, activeDayISO)
        : board.lists;

    // Check meal completion and advance tour
    if (tourStep === "breakfast" && lists.breakfast.length > 0) {
      setTourStep("lunch");
      localStorage.setItem(
        "performance-competition-builder-tour-step",
        "lunch",
      );
    } else if (tourStep === "lunch" && lists.lunch.length > 0) {
      setTourStep("dinner");
      localStorage.setItem(
        "performance-competition-builder-tour-step",
        "dinner",
      );
    } else if (tourStep === "dinner" && lists.dinner.length > 0) {
      setTourStep("snacks");
      localStorage.setItem(
        "performance-competition-builder-tour-step",
        "snacks",
      );
    } else if (tourStep === "snacks" && lists.snacks.length > 0) {
      setTourStep("complete");
      localStorage.setItem(
        "performance-competition-builder-tour-step",
        "complete",
      );
    }
  }, [board, tourStep, planningMode, activeDayISO, hasSeenDailyTotalsInfo]);

  // Duplicate day handler
  const handleDuplicateDay = useCallback(
    async (targetDates: string[]) => {
      if (!board || !activeDayISO) return;

      const sourceLists = { ...getDayLists(board, activeDayISO) };

      try {
        const result = await duplicateAcrossWeeks({
          sourceLists,
          targetDates,
          currentBoard: board,
          currentWeekStartISO: weekStartISO,
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

  // Duplicate week handler
  const handleDuplicateWeek = useCallback(
    async (targetWeekStartISO: string) => {
      if (!board) return;

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

  // Shopping list handler - Single day
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
          ? `${formatDateDisplay(activeDayISO, { weekday: "long" })} Athlete Plan`
          : `Athlete Meal Plan (${formatWeekLabel(weekStartISO)})`,
    }));

    useShoppingListStore.getState().addItems(items);

    toast({
      title: "Added to Shopping List",
      description: `${ingredients.length} items added to your master list`,
    });
  }, [board, planningMode, activeDayISO, weekStartISO, toast]);

  // Shopping list handler - Entire week
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
      notes: `Athlete Meal Plan (${formatWeekLabel(weekStartISO)}) - All 7 Days`,
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
        const existingSlotMeals = dayLists[slot].filter(
          (m) => !m.id.startsWith("ai-meal-"),
        );
        const updatedSlotMeals = [...existingSlotMeals, ...newMeals];
        const updatedDayLists = { ...dayLists, [slot]: updatedSlotMeals };
        const updatedBoard = setDayLists(board, activeDayISO, updatedDayLists);

        setBoard(updatedBoard);
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

  // Handler for snack selection from SnackPickerDrawer (Competition Snacks)
  const handleSnackSelect = useCallback(
    async (snack: any) => {
      if (!board) return;

      try {
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
          // Add to week board
          const updatedBoard = {
            ...board,
            lists: {
              ...board.lists,
              snacks: [...board.lists.snacks, snack],
            },
          };
          await saveBoard(updatedBoard);
        }

        toast({
          title: "Snack Added!",
          description: `${snack.title} added successfully`,
        });

        setSnackPickerOpen(false);
      } catch (error) {
        console.error("Failed to add snack:", error);
        toast({
          title: "Failed to add snack",
          description: "Please try again",
          variant: "destructive",
        });
      }
    },
    [board, planningMode, activeDayISO, saveBoard, toast],
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
      }

      // Dispatch board update event for instant refresh
      try {
        window.dispatchEvent(
          new CustomEvent("board:updated", { detail: { weekStartISO } }),
        );
        window.dispatchEvent(new Event("macros:updated"));
      } catch {
        /* no-op */
      }
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

  // Add a new dynamic meal slot
  const handleAddMealSlot = useCallback(() => {
    setDynamicMealCount((prev) => prev + 1);
    toast({
      title: "Meal Slot Added",
      description: `Meal ${4 + dynamicMealCount} is ready to use`,
    });
  }, [dynamicMealCount, toast]);

  // Remove a dynamic meal slot and clean up board data
  const handleRemoveMealSlot = useCallback(
    async (mealNumber: number) => {
      if (!board) return;

      try {
        // Clean up meals with this slot's ID prefix from the board
        const slotPrefix = `dyn-${mealNumber}-`;

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
              (meal: Meal) => !meal.id.startsWith(slotPrefix),
            ),
          };
          const updatedBoard = setDayLists(
            board,
            activeDayISO,
            updatedDayLists,
          );
          await saveBoard(updatedBoard);
        } else {
          // WEEK MODE: Remove from board.lists
          const updatedBoard = {
            ...board,
            lists: {
              ...board.lists,
              snacks: board.lists.snacks.filter(
                (meal: Meal) => !meal.id.startsWith(slotPrefix),
              ),
            },
          };
          await saveBoard(updatedBoard);
        }

        // Decrement counter (this will shift all subsequent meal numbers down)
        setDynamicMealCount((prev) => Math.max(0, prev - 1));

        toast({
          title: "Meal Slot Removed",
          description: `Meal ${mealNumber} has been deleted`,
        });
      } catch (error) {
        console.error("Failed to remove meal slot:", error);
        toast({
          title: "Error",
          description: "Failed to remove meal slot",
          variant: "destructive",
        });
      }
    },
    [board, planningMode, activeDayISO, saveBoard, toast],
  );

  // Get coach-set macro targets from ProCare
  const coachMacroTargets = useMemo(() => {
    const targets = proStore.getTargets(clientId);
    const totalCarbs =
      (targets.starchyCarbs || 0) + (targets.fibrousCarbs || 0);
    const protein = targets.protein || 0;
    const fat = targets.fat || 0;
    const calories = protein * 4 + totalCarbs * 4 + fat * 9;

    return {
      calories,
      protein,
      carbs: totalCarbs,
      fat,
    };
  }, [clientId]);

  // Handle Set Macros to Biometrics
  const handleSetMacrosToBiometrics = useCallback(() => {
    if (coachMacroTargets.calories < 100) {
      toast({
        title: "Cannot Set Empty Macros",
        description: "Please have your coach set macro targets first",
        variant: "destructive",
      });
      return;
    }

    // Save macros to localStorage with "anon" user (default biometrics key)
    setMacroTargets({
      calories: coachMacroTargets.calories,
      protein_g: coachMacroTargets.protein,
      carbs_g: coachMacroTargets.carbs,
      fat_g: coachMacroTargets.fat,
    }); // Use default "anon" user instead of clientId

    // Link the current user to this clientId for ProCare integration
    linkUserToClient("anon", clientId);

    // Save clientId for "Came From" dropdown routing
    saveLastPerformanceClientId(clientId);

    toast({
      title: "Macros Set to Biometrics!",
      description: `${coachMacroTargets.calories} kcal coach-set targets saved`,
    });

    setLocation(
      "/my-biometrics?from=performance-competition-builder&view=macros",
    );
  }, [coachMacroTargets, clientId, toast, setLocation]);

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
          <p>Loading Performance & Competition Builder...</p>
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

  // Determine current lists based on mode
  const currentLists =
    FEATURES.dayPlanning === "alpha" && planningMode === "day" && activeDayISO
      ? getDayLists(board, activeDayISO)
      : board.lists;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-28"
    >
      <BuilderHeader title="Performance Builder" onOpenTour={quickTour.openTour} clientId={mode === "procare" ? clientId : null} />
      <TrialBanner />

      {/* Main Content Wrapper - padding pushes content below header while gradient shows through */}
      <div
        className="px-4"
        style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + ${mode === "procare" ? '9rem' : '6rem'})` }}
      >
        {/* Header - Week Navigation */}
        <div className="mb-6 border-zinc-800 bg-zinc-900/60 backdrop-blur rounded-2xl">
          <div className="px-4 py-4 flex flex-col gap-3">
            {/* Week Dates (centered) */}
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

            {/* ROW 3: Days of Week */}
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

            {/* ROW 5: Bottom Actions */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">

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

        {/* Meal Cards Grid - Same structure as Weekly Meal Board */}
        <div className="max-w-[1600px] mx-auto px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
          {/* Render day view or week view based on mode */}
          {FEATURES.dayPlanning === "alpha" &&
          planningMode === "day" &&
          activeDayISO &&
          board ? (
            // DAY MODE: Show only the active day's meals
            (() => {
              const dayLists = getDayLists(board, activeDayISO);
              return (
                <>
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
                          slot={
                            key as "breakfast" | "lunch" | "dinner" | "snacks"
                          }
                          onCreateWithAI={() => {
                            setAiMealSlot(
                              key as
                                | "breakfast"
                                | "lunch"
                                | "dinner"
                                | "snacks",
                            );
                            setAiMealModalOpen(true);
                          }}
                          onCreateWithChef={() => {
                            setCreateWithChefSlot(
                              key as "breakfast" | "lunch" | "dinner",
                            );
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
                                  // REMOVE MEAL in Day mode - use the new system

                                  // 🗑️ If it's an AI meal, also clear from localStorage
                                  if (meal.id.startsWith("ai-meal-")) {
                                    console.log(
                                      "🗑️ Deleting AI meal from localStorage:",
                                      meal.name,
                                    );
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
                                    console.error(
                                      "❌ Delete sync failed (Day mode):",
                                      err,
                                    );
                                    toast({
                                      title: "Sync pending",
                                      description: "Changes will sync automatically.",
                                    });
                                  });
                                } else {
                                  // Update meal in day lists
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

                  {/* Dynamic Meal Cards (Meal 4+) - Matches Meals 1-3 structure */}
                  {Array.from({ length: dynamicMealCount }, (_, i) => {
                    const mealNumber = 4 + i;
                    const dynamicSlotKey = `dyn-${mealNumber}` as
                      | "breakfast"
                      | "lunch"
                      | "dinner";
                    return (
                      <section
                        key={`dynamic-meal-${mealNumber}`}
                        className="rounded-2xl border border-emerald-800 bg-emerald-950/40 backdrop-blur p-4"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-white/90 text-lg font-medium">
                            Meal {mealNumber}
                          </h2>
                          <div className="flex gap-2">
                            {/* Create with AI button - hidden by feature flag for launch */}
                            {FEATURES.showCreateWithAI && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-white/80 hover:bg-black/50 border border-pink-400/30 text-xs font-medium flex items-center gap-1 flash-border"
                                onClick={() => {
                                  setAiMealSlot("snacks");
                                  setAiMealModalOpen(true);
                                }}
                              >
                                <Sparkles className="h-3 w-3" />
                                Create with AI
                              </Button>
                            )}

                            {/* Create with Chef button - Competition meals */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-white/80 hover:bg-black/50 border border-emerald-400/30 text-xs font-medium flex items-center gap-1"
                              onClick={() => {
                                setCreateWithChefSlot(dynamicSlotKey);
                                setCreateWithChefOpen(true);
                              }}
                            >
                              <ChefHat className="h-3 w-3" />
                              Create with Chef
                            </Button>

                            {/* Plus button for manual entry */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-white/80 hover:bg-white/10"
                              onClick={() => openManualModal("snacks")}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>

                            {/* Delete button - Remove this dynamic meal slot */}
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
                              m.id.startsWith(`dyn-${mealNumber}-`),
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
                                      console.error(
                                        "❌ Delete sync failed (Day mode):",
                                        err,
                                      );
                                      toast({
                                        title: "Sync pending",
                                        description: "Changes will sync automatically.",
                                      });
                                    });
                                  } else {
                                    const updatedDayLists = {
                                      ...dayLists,
                                      snacks: dayLists.snacks.map(
                                        (existingMeal) =>
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
                            m.id.startsWith(`dyn-${mealNumber}-`),
                          ).length === 0 && (
                            <div className="rounded-2xl border border-dashed border-zinc-700 text-white/50 p-6 text-center text-sm">
                              <p className="mb-2">No Meal {mealNumber} yet</p>
                              <p className="text-xs text-white/40">
                                Use "+" to add meals
                              </p>
                            </div>
                          )}
                        </div>
                      </section>
                    );
                  })}

                  {/* Add Meal Button */}
                  <div className="col-span-full flex justify-center my-4">
                    <Button
                      onClick={handleAddMealSlot}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 py-3 rounded-xl flex items-center gap-2"
                    >
                      <Plus className="h-5 w-5" />
                      Add Meal {4 + dynamicMealCount}
                    </Button>
                  </div>

                  {/* ================================
                    SNACKS SECTION - Competition Snacks
                ==================================== */}
                  <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur p-4 col-span-full">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-white/90 text-lg font-medium">
                        Snacks
                      </h2>
                      <div className="flex gap-2">
                        <SnackCreatorButton
                          onClick={() => setSnackCreatorOpen(true)}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-white/80 hover:bg-black/50 border border-emerald-400/30 text-xs font-medium flex items-center gap-1"
                          onClick={() => setSnackPickerOpen(true)}
                        >
                          <Plus className="h-4 w-4" />
                          Add Snack
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {dayLists.snacks
                        .filter((m: Meal) => !m.id.startsWith("dyn-"))
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
                                  console.error(
                                    "❌ Delete sync failed (Day mode):",
                                    err,
                                  );
                                  toast({
                                    title: "Sync pending",
                                    description: "Changes will sync automatically.",
                                  });
                                });
                              } else {
                                const updatedDayLists = {
                                  ...dayLists,
                                  snacks: dayLists.snacks.map((existingMeal) =>
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
                      {dayLists.snacks.filter(
                        (m: Meal) => !m.id.startsWith("dyn-"),
                      ).length === 0 && (
                        <div className="rounded-2xl border border-dashed border-zinc-700 text-white/50 p-6 text-center text-sm">
                          <p className="mb-2">No snacks yet</p>
                          <p className="text-xs text-white/40">
                            Use "Add Snack" to add competition-safe snacks
                          </p>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* ================================
                    COACH TARGETS (Performance Builder) - READ ONLY
                    Set from Client Dashboard
                ==================================== */}
                  <div className="col-span-full mt-6 rounded-2xl bg-black/30 backdrop-blur-xl border border-white/20 p-6">
                    <h2 className="text-white text-lg font-bold mb-4 flex items-center gap-2">
                      🎯 Coach Targets
                    </h2>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Protein */}
                      <div className="flex flex-col">
                        <label className="text-sm text-white/70 mb-1">
                          Protein (g)
                        </label>
                        <div className="bg-black/40 border border-white/20 text-white rounded-xl px-3 py-2">
                          {coachTargetsDisplay.protein}
                        </div>
                      </div>

                      {/* Starchy Carbs */}
                      <div className="flex flex-col">
                        <label className="text-sm text-white/70 mb-1">
                          Starchy Carbs (g)
                        </label>
                        <div className="bg-black/40 border border-white/20 text-white rounded-xl px-3 py-2">
                          {coachTargetsDisplay.starchy}
                        </div>
                      </div>

                      {/* Fibrous Carbs */}
                      <div className="flex flex-col">
                        <label className="text-sm text-white/70 mb-1">
                          Fibrous Carbs (g)
                        </label>
                        <div className="bg-black/40 border border-white/20 text-white rounded-xl px-3 py-2">
                          {coachTargetsDisplay.fibrous}
                        </div>
                      </div>

                      {/* Fats */}
                      <div className="flex flex-col">
                        <label className="text-sm text-white/70 mb-1">
                          Fats (g)
                        </label>
                        <div className="bg-black/40 border border-white/20 text-white rounded-xl px-3 py-2">
                          {coachTargetsDisplay.fats}
                        </div>
                      </div>
                    </div>

                    <p className="mt-4 text-sm text-white/60 text-center">
                      Set targets from Client Dashboard
                    </p>
                  </div>
                </>
              );
            })()
          ) : (
            // WEEK MODE: Show traditional week view (legacy lists)
            <>
              {lists.map(([key, label]) => (
                <section
                  key={key}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur p-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-white/90 text-lg font-medium">
                      {label}
                    </h2>
                    <div className="flex gap-2">
                      {/* AI Meal Creator button - hidden by feature flag for launch */}
                      {FEATURES.showCreateWithAI && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-white/80 hover:bg-black/50 border border-pink-400/30 text-xs font-medium flex items-center gap-1 flash-border"
                          onClick={() => {
                            setAiMealSlot(
                              key as "breakfast" | "lunch" | "dinner" | "snacks",
                            );
                            setAiMealModalOpen(true);
                          }}
                        >
                          <Sparkles className="h-3 w-3" />
                          Create with AI
                        </Button>
                      )}

                      {/* Create with Chef button - Competition meals */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white/80 hover:bg-black/50 border border-emerald-400/30 text-xs font-medium flex items-center gap-1"
                        onClick={() => {
                          setCreateWithChefSlot(
                            key as "breakfast" | "lunch" | "dinner",
                          );
                          setCreateWithChefOpen(true);
                        }}
                      >
                        <ChefHat className="h-3 w-3" />
                        Create with Chef
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
                              console.error(
                                "❌ Delete sync failed (Board mode):",
                                err,
                              );
                              toast({
                                title: "Sync pending",
                                description: "Changes will sync automatically.",
                              });
                            });
                          } else {
                            // Update meal
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
            </>
          )}

          {/* Pro Tip Card */}
          <ProTipCard />

          {/* Daily Targets Card */}
          <div className="col-span-full">
            <DailyTargetsCard
              userId={clientId}
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
              const dayAlreadyLocked = isDayLocked(activeDayISO, clientId);
              
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
                      }, clientId);
                      
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

        {/* Modals */}
        <CompetitionMealPickerDrawer
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

        {/* Snack Picker Drawer - Competition Snacks */}
        <SnackPickerDrawer
          open={snackPickerOpen}
          onClose={() => setSnackPickerOpen(false)}
          onSnackSelect={handleSnackSelect}
          dietType="competition"
        />

        {/* Create With Chef Modal - with STRICT performance guardrails */}
        <CreateWithChefModal
          open={createWithChefOpen}
          onOpenChange={setCreateWithChefOpen}
          mealType={createWithChefSlot}
          onMealGenerated={handleChefMealGenerated}
          dietType="performance"
          starchContext={starchContext}
        />

        {/* Snack Creator Modal (Phase 2 - craving to healthy snack) - with STRICT performance guardrails */}
        <SnackCreatorModal
          open={snackCreatorOpen}
          onOpenChange={setSnackCreatorOpen}
          onSnackGenerated={handleSnackSelect}
          dietType="performance"
        />

        {/* Shopping List Buttons */}
        {board &&
          (() => {
            const currentBoard = board; // Capture board in local variable for type safety

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

            // DAY MODE: Show dual buttons
            if (
              FEATURES.dayPlanning === "alpha" &&
              planningMode === "day" &&
              activeDayISO
            ) {
              const dayName = formatDateDisplay(activeDayISO, { weekday: "long" });

              return (
                <div className="fixed left-0 right-0 pb-0 z-[60] bg-gradient-to-r from-zinc-900/95 via-zinc-800/95 to-black/95 backdrop-blur-xl border-t border-white/20 shadow-2xl" style={{ bottom: "calc(64px + var(--safe-bottom, 0px))" }}>
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
                                  "/shopping-list-v2?from=performance-competition-builder",
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
                                  "/shopping-list-v2?from=performance-competition-builder",
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

            // WEEK MODE: Use ShoppingAggregateBar
            return (
              <ShoppingAggregateBar
                ingredients={ingredients}
                source="Performance & Competition Builder"
                sourceSlug="performance-competition-builder"
                aboveBottomNav
              />
            );
          })()}
      </div>

      {/* Daily Totals Info Modal - Next Steps After First Meal */}
      <Dialog
        open={showDailyTotalsInfo}
        onOpenChange={(open) => {
          if (!open) {
            setShowDailyTotalsInfo(false);
            setHasSeenDailyTotalsInfo(true);
            localStorage.setItem(
              "performance-competition-builder-daily-totals-info-seen",
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
        title="Performance & Competition Builder Guide"
        steps={PERFORMANCE_TOUR_STEPS}
        onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
      />
    </motion.div>
  );
}
