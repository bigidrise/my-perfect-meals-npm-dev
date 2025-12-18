import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { MealCard, Meal } from "@/components/MealCard";
import { getWeekBoard, saveWeekBoard, removeMealFromCurrentWeek, getCurrentWeekBoard, getWeekBoardByDate, putWeekBoard, type WeekBoard, weekDates, getDayLists, setDayLists, cloneDayLists } from "@/lib/boardApi";
import { MealPickerDrawer } from "@/components/pickers/MealPickerDrawer";
import { ManualMealModal } from "@/components/pickers/ManualMealModal";
import { AddSnackModal } from "@/components/AddSnackModal";
import SnackPickerDrawer from "@/components/pickers/SnackPickerDrawer";
import { RemainingMacrosFooter, type ConsumedMacros } from "@/components/biometrics/RemainingMacrosFooter";
import { LockedDayDialog } from "@/components/biometrics/LockedDayDialog";
import { lockDay, isDayLocked, hasLockedDaysInWeek, getLockedDaysInWeek, initLockedDaysCache } from "@/lib/lockedDays";
import { setQuickView } from "@/lib/macrosQuickView";
import { getMacroTargets } from "@/lib/dailyLimits";
import { useAuth } from "@/contexts/AuthContext";
import WeeklyOverviewModal from "@/components/WeeklyOverviewModal";
import ShoppingAggregateBar from "@/components/ShoppingAggregateBar";
import BottomNav from "@/components/BottomNav";
import { normalizeIngredients } from "@/utils/ingredientParser";
import { useOnboardingProfile } from "@/hooks/useOnboardingProfile";
import { useShoppingListStore } from "@/stores/shoppingListStore";
import { computeTargetsFromOnboarding, sumBoard } from "@/lib/targets";
import { useTodayMacros } from "@/hooks/useTodayMacros";
import { useMidnightReset } from "@/hooks/useMidnightReset";
import { todayISOInTZ } from "@/utils/midnight";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Check, Sparkles, BarChart3, ShoppingCart, X, Home, ArrowLeft, Calendar, Lock } from "lucide-react";
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
import AIMealCreatorModal from "@/components/modals/AIMealCreatorModal";
import MealPremadePicker from "@/components/pickers/MealPremadePicker";
import AdditionalMacrosModal from "@/components/modals/AdditionalMacrosModal";
import { CreateWithChefButton } from "@/components/CreateWithChefButton";
import { CreateWithChefModal } from "@/components/CreateWithChefModal";
import { SnackCreatorModal } from "@/components/SnackCreatorModal";
import { GlobalMealActionBar } from "@/components/GlobalMealActionBar";
import { getResolvedTargets } from "@/lib/macroResolver";
import { useCopilot } from "@/components/copilot/CopilotContext";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { QuickTourButton } from "@/components/guided/QuickTourButton";

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

const WEEKLY_TOUR_STEPS: TourStep[] = [
  {
    icon: "1",
    title: "Choose Your Builder",
    description: "Tap 'Create with AI' for custom meals, or 'Create With Chef' to describe what you want."
  },
  {
    icon: "2",
    title: "Fill Each Meal Card",
    description: "Add breakfast, lunch, dinner, and snacks. Preparation cards will guide you if needed."
  },
  {
    icon: "3",
    title: "Duplicate Your Days",
    description: "Use 'Duplicate' to copy meals to other days of the week."
  },
  {
    icon: "4",
    title: "Track Your Macros",
    description: "Send your day to the Macro Calculator to track nutrition."
  },
  {
    icon: "5",
    title: "Build Your Grocery List",
    description: "Send ingredients to the Shopping List for easy grocery shopping."
  },
  {
    icon: "6",
    title: "Track Progress at Bottom",
    description: "The bottom bar shows color-coded progress: green = on track, yellow = close, red = over. Tap 'Save Day' to lock your day to Biometrics."
  }
];

export default function WeeklyMealBoard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { runAction, open, startWalkthrough } = useCopilot();
  const { user } = useAuth();
  
  const quickTour = useQuickTour("weekly-meal-board");

  // 🎯 BULLETPROOF BOARD LOADING: Cache-first, guaranteed to render
  const [weekStartISO, setWeekStartISO] = React.useState<string>(getMondayISO());
  const { board: hookBoard, loading: hookLoading, error, save: saveToHook, source } = useWeeklyBoard("1", weekStartISO);

  // Local mutable board state for optimistic updates
  const [board, setBoard] = React.useState<WeekBoard | null>(null);
  const boardRef = React.useRef<WeekBoard | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);

  // Initialize locked days cache from server on component load
  React.useEffect(() => {
    if (user?.id) {
      initLockedDaysCache(user.id);
    }
  }, [user?.id]);

  // Sync hook board to local state only after loading completes
  React.useEffect(() => {
    if (!hookLoading && !Object.is(boardRef.current, hookBoard)) {
      setBoard(hookBoard);
      boardRef.current = hookBoard;
    }
  }, [hookBoard, hookLoading]);

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

  // AI Premades modal state (DEPRECATED - replaced by Create With Chef)
  const [premadePickerOpen, setPremadePickerOpen] = useState(false);
  const [premadePickerSlot, setPremadePickerSlot] = useState<"breakfast" | "lunch" | "dinner">("breakfast");

  // Create With Chef modal state (replaces AI Premades)
  const [createWithChefOpen, setCreateWithChefOpen] = useState(false);
  const [createWithChefSlot, setCreateWithChefSlot] = useState<"breakfast" | "lunch" | "dinner">("breakfast");

  // Snack Creator modal state (Phase 2 - replaces Create with AI for snacks)
  const [snackCreatorOpen, setSnackCreatorOpen] = useState(false);

  // Snack Picker state
  const [snackPickerOpen, setSnackPickerOpen] = useState(false);

  // Locked day dialog state
  const [lockedDayDialogOpen, setLockedDayDialogOpen] = useState(false);
  const [additionalMacrosOpen, setAdditionalMacrosOpen] = useState(false);
  const [pendingLockedDayISO, setPendingLockedDayISO] = useState<string>('');
  
  // Computed: check if week mode is read-only (any day in week is locked)
  const weekModeReadOnly = React.useMemo(() => {
    if (planningMode !== 'week') return false;
    return hasLockedDaysInWeek(weekStartISO, user?.id);
  }, [planningMode, weekStartISO, user?.id]);
  
  // Guard function: checks if current day is locked before allowing edits
  // NOTE: Always recompute lock state fresh to avoid stale closure issues
  const checkLockedDay = useCallback((forDayISO?: string): boolean => {
    // Week mode: silently block edits if any day in the week is locked
    // (banner already informs user - no dialog needed)
    if (planningMode === 'week') {
      // Recompute fresh instead of using memoized value
      const isWeekLocked = hasLockedDaysInWeek(weekStartISO, user?.id);
      return isWeekLocked;
    }
    
    // Day mode: check specific day and show dialog
    const dayToCheck = forDayISO || activeDayISO;
    if (dayToCheck && isDayLocked(dayToCheck, user?.id)) {
      setPendingLockedDayISO(dayToCheck);
      setLockedDayDialogOpen(true);
      return true; // Day is locked, block edit
    }
    return false; // Day is not locked, allow edit
  }, [activeDayISO, planningMode, weekStartISO, user?.id]);
  
  // Handle "Go to Today" from locked day dialog
  const handleGoToToday = useCallback(() => {
    const today = todayISOInTZ('America/Chicago');
    setActiveDayISO(today);
    setLockedDayDialogOpen(false);
    setPendingLockedDayISO('');
  }, []);

  // Handler for premade meal selection
  const handlePremadeSelect = useCallback(async (meal: any) => {
    if (!board) return;
    
    // Guard: Check if day is locked before allowing edits
    if (checkLockedDay()) return;

    try {
      // Add to the appropriate slot based on premadePickerSlot
      if (FEATURES.dayPlanning === 'alpha' && planningMode === 'day' && activeDayISO) {
        // Add to specific day
        const dayLists = getDayLists(board, activeDayISO);
        const updatedDayLists = {
          ...dayLists,
          [premadePickerSlot]: [...dayLists[premadePickerSlot as keyof typeof dayLists], meal]
        };
        const updatedBoard = setDayLists(board, activeDayISO, updatedDayLists);
        // Update local state FIRST to prevent race condition with refetch
        setBoard(updatedBoard);
        boardRef.current = updatedBoard;
        await saveBoard(updatedBoard);
      } else {
        // Week mode: update local board and save
        const updatedBoard = {
          ...board,
          lists: {
            ...board.lists,
            [premadePickerSlot]: [...board.lists[premadePickerSlot], meal]
          },
          version: board.version + 1,
          meta: {
            ...board.meta,
            lastUpdatedAt: new Date().toISOString()
          }
        };
        setBoard(updatedBoard);
        boardRef.current = updatedBoard;
        await saveBoard(updatedBoard);
      }

      // Only dispatch macros:updated - do NOT refetch board after local mutation
      // board:updated was causing race condition where stale server data overwrote local state
      window.dispatchEvent(new Event("macros:updated"));

      // Dispatch walkthrough event (premadePickerSlot is always breakfast/lunch/dinner, never snacks)
      const eventTarget = document.querySelector(`[data-testid="meal-filled-${premadePickerSlot}"]`);
      if (eventTarget) {
        eventTarget.dispatchEvent(new CustomEvent('filled'));
      }
    } catch (error) {
      console.error("Failed to add premade meal:", error);
      toast({
        title: "Error",
        description: "Failed to add meal. Please try again.",
        variant: "destructive"
      });
    }
  }, [board, premadePickerSlot, planningMode, activeDayISO, weekStartISO, saveBoard, toast]);

  // Handler for Create With Chef meal selection (replaces AI Premades)
  const handleCreateWithChefSelect = useCallback(async (meal: any) => {
    if (!board) return;
    
    // Guard: Check if day is locked before allowing edits
    if (checkLockedDay()) return;

    try {
      // Add to the appropriate slot based on createWithChefSlot
      if (FEATURES.dayPlanning === 'alpha' && planningMode === 'day' && activeDayISO) {
        // Add to specific day
        const dayLists = getDayLists(board, activeDayISO);
        const updatedDayLists = {
          ...dayLists,
          [createWithChefSlot]: [...dayLists[createWithChefSlot as keyof typeof dayLists], meal]
        };
        const updatedBoard = setDayLists(board, activeDayISO, updatedDayLists);
        setBoard(updatedBoard);
        boardRef.current = updatedBoard;
        await saveBoard(updatedBoard);
      } else {
        // Week mode: update local board and save
        const updatedBoard = {
          ...board,
          lists: {
            ...board.lists,
            [createWithChefSlot]: [...board.lists[createWithChefSlot], meal]
          },
          version: board.version + 1,
          meta: {
            ...board.meta,
            lastUpdatedAt: new Date().toISOString()
          }
        };
        setBoard(updatedBoard);
        boardRef.current = updatedBoard;
        await saveBoard(updatedBoard);
      }

      window.dispatchEvent(new Event("macros:updated"));

      const eventTarget = document.querySelector(`[data-testid="meal-filled-${createWithChefSlot}"]`);
      if (eventTarget) {
        eventTarget.dispatchEvent(new CustomEvent('filled'));
      }
    } catch (error) {
      console.error("Failed to add Create With Chef meal:", error);
      toast({
        title: "Error",
        description: "Failed to add meal. Please try again.",
        variant: "destructive"
      });
    }
  }, [board, createWithChefSlot, planningMode, activeDayISO, weekStartISO, saveBoard, toast, checkLockedDay]);

  // Handler for snack selection from SnackPickerDrawer
  const handleSnackSelect = useCallback(async (snack: any) => {
    if (!board) return;
    
    // Guard: Check if day is locked before allowing edits
    if (checkLockedDay()) return;

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
        // Update local state FIRST to prevent race condition with refetch
        setBoard(updatedBoard);
        boardRef.current = updatedBoard;
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
        boardRef.current = updatedBoard;
        await saveBoard(updatedBoard);
      }

      // Only dispatch macros:updated - do NOT refetch board after local mutation
      window.dispatchEvent(new Event("macros:updated"));

      // Dispatch walkthrough event for snacks
      const eventTarget = document.querySelector(`[data-testid="meal-filled-snack"]`);
      if (eventTarget) {
        eventTarget.dispatchEvent(new CustomEvent('filled'));
      }
    } catch (error) {
      console.error("Failed to add snack:", error);
      toast({
        title: "Error",
        description: "Failed to add snack. Please try again.",
        variant: "destructive"
      });
    }
  }, [board, planningMode, activeDayISO, weekStartISO, saveBoard, toast]);

  const [tourStep, setTourStep] = useState<"breakfast" | "lunch" | "dinner" | "snacks" | "complete">("breakfast");

  // Auto-mark tour info as seen since Copilot provides guidance now
  useEffect(() => {
    if (!localStorage.getItem("weekly-meal-board-info-seen")) {
      localStorage.setItem("weekly-meal-board-info-seen", "true");
    }
    if (!localStorage.getItem("weekly-meal-board-daily-totals-info-seen")) {
      localStorage.setItem("weekly-meal-board-daily-totals-info-seen", "true");
    }

    const saved = localStorage.getItem("weekly-meal-board-tour-step");
    if (saved && saved !== "complete") {
      setTourStep(saved as "breakfast" | "lunch" | "dinner" | "snacks" | "complete");
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

  // Dispatch "ready" event when daily totals are calculated (for walkthrough)
  useEffect(() => {
    if (!board) return;
    
    // Dispatch after a short delay to ensure totals are fully calculated and rendered
    const timer = setTimeout(() => {
      const eventTarget = document.querySelector(`[data-testid="daily-totals-ready"]`);
      if (eventTarget) {
        eventTarget.dispatchEvent(new CustomEvent('ready'));
      }
    }, 500); // Increased delay to ensure DOM is fully rendered

    return () => clearTimeout(timer);
  }, [board, planningMode, activeDayISO]); // Watch board, mode, and active day

  // Duplicate day handler
  const handleDuplicateDay = useCallback(async (targetDates: string[]) => {
    if (!board || !activeDayISO) return;
    
    // Guard: Check if any TARGET date is locked before allowing edits
    const lockedTarget = targetDates.find(d => isDayLocked(d, user?.id));
    if (lockedTarget) {
      setPendingLockedDayISO(lockedTarget);
      setLockedDayDialogOpen(true);
      return;
    }

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
    
    // Guard: Check if any day in TARGET week is locked
    const targetWeekDates = weekDates(targetWeekStartISO);
    const lockedTarget = targetWeekDates.find(d => isDayLocked(d, user?.id));
    if (lockedTarget) {
      setPendingLockedDayISO(lockedTarget);
      setLockedDayDialogOpen(true);
      return;
    }

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
      quantity: typeof i.qty === 'number' ? i.qty : (i.qty ? parseFloat(String(i.qty)) : 1),
      unit: i.unit || '',
      notes: planningMode === 'day' && activeDayISO
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
      quantity: typeof i.qty === 'number' ? i.qty : (i.qty ? parseFloat(String(i.qty)) : 1),
      unit: i.unit || '',
      notes: `Weekly Meal Plan (${formatWeekLabel(weekStartISO)}) - All 7 Days`
    }));

    useShoppingListStore.getState().addItems(items);

    toast({
      title: "Added to Shopping List",
      description: `${ingredients.length} items from entire week added to your master list`
    });

    // Dispatch walkthrough event
    setTimeout(() => {
      const eventTarget = document.querySelector(`[data-testid="shopping-week-sent"]`);
      if (eventTarget) {
        eventTarget.dispatchEvent(new CustomEvent('done'));
      }
    }, 200);
  }, [board, weekStartISO, weekDatesList, toast]);

  // AI Meal Creator handler - Save to localStorage (Fridge Rescue pattern)
  const handleAIMealGenerated = useCallback(async (generatedMeal: any) => {
    if (!activeDayISO) return;
    
    // Guard: Check if day is locked before allowing edits
    if (checkLockedDay()) return;

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

    // Dispatch meal:saved event for coach progression
    const mealIdMap: Record<string, string> = {
      breakfast: "breakfast",
      lunch: "lunch",
      dinner: "dinner",
      snacks: "snack1"
    };
    window.dispatchEvent(
      new CustomEvent("meal:saved", { detail: { mealId: mealIdMap[aiMealSlot] || "snack1" } })
    );

    toast({
      title: "AI Meal Created!",
      description: `${generatedMeal.name} saved to your ${slotLabel.toLowerCase()}`,
    });

    // Dispatch walkthrough event
    const slotTestId = aiMealSlot === 'snacks' ? 'snack' : aiMealSlot;
    const eventTarget = document.querySelector(`[data-testid="meal-filled-${slotTestId}"]`);
    if (eventTarget) {
      eventTarget.dispatchEvent(new CustomEvent('filled'));
    }

    // Advance guided tour to next step
    advanceTourStep();
  }, [board, activeDayISO, aiMealSlot, toast, advanceTourStep]);

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
      <span className={`text-xs px-2 py-1 rounded-2xl border ${
        ok ? "border-lime-500/40 text-lime-300 bg-lime-500/10"
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

      // Only dispatch macros:updated - do NOT refetch board after local mutation
      try {
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
    // Guard: Check if day is locked before allowing edits
    if (checkLockedDay()) return;
    
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
    
    // Guard: Check if day is locked before allowing edits
    if (checkLockedDay()) return;

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
        // Update local state FIRST to prevent race condition
        setBoard(updatedBoard);
        boardRef.current = updatedBoard;
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
        boardRef.current = updatedBoard;
        await saveBoard(updatedBoard);
        console.log("✅ Successfully added meal to", list, "for", weekStartISO);
      }

      // Only dispatch macros:updated - do NOT refetch board after local mutation
      try {
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
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
    >
      {/* Universal Safe-Area Header */}
      <div
        className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-2 flex-nowrap">
          {/* Back to Planner */}
          <Button
            onClick={() => setLocation("/planner")}
            className="bg-black/10 hover:bg-black/50 text-white rounded-xl border border-white/10 backdrop-blur-none flex items-center gap-1.5 px-2.5 h-9 flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs font-medium">Back</span>
          </Button>

          {/* Title */}
          <h1 className="text-base font-bold text-white flex-shrink truncate min-w-0" data-testid="weekly-builder-header">
            Weekly Meal Builder
          </h1>

          <div className="flex-grow" />

          {/* Quick Tour Help Button */}
          <QuickTourButton onClick={quickTour.openTour} className="flex-shrink-0" />
        </div>
      </div>

      {/* Main Content */}
      <div
        className="max-w-[1600px] mx-auto px-4 space-y-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
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

          {/* ROW 2: Day/Week Toggle + Duplicate */}
          {FEATURES.dayPlanning === 'alpha' && (
            <div className="flex items-center justify-between gap-3">
              <DayWeekToggle mode={planningMode} onModeChange={setPlanningMode} />

              {planningMode === 'day' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDuplicateDayModal(true)}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs px-3 py-1 rounded-xl"
                  data-testid="duplicate-button"
                >
                  Duplicate...
                </Button>
              )}

              {planningMode === 'week' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (weekModeReadOnly) {
                      toast({ title: "Week Locked", description: "Switch to Day view to edit unlocked days.", variant: "destructive" });
                      return;
                    }
                    setShowDuplicateWeekModal(true);
                  }}
                  disabled={weekModeReadOnly}
                  className={`${weekModeReadOnly ? 'opacity-50 cursor-not-allowed' : ''} bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs px-3 py-1 rounded-xl`}
                >
                  Copy Week...
                </Button>
              )}
            </div>
          )}

          {/* ROW 3: Days of Week */}
          {FEATURES.dayPlanning === 'alpha' && planningMode === 'day' && weekDatesList.length > 0 && (
            <div className="flex justify-center">
              <DayChips
                weekDates={weekDatesList}
                activeDayISO={activeDayISO}
                onDayChange={setActiveDayISO}
              />
            </div>
          )}

          {/* ROW 4: Bottom Actions (Delete All + Save) */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (checkLockedDay()) {
                  return;
                }
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
                    setBoard(clearedBoard);
                    boardRef.current = clearedBoard;
                    saveBoard(clearedBoard);
                    toast({
                      title: "All Meals Deleted",
                      description: "Successfully cleared all meals from the board",
                    });
                  }
                }
              }}
              disabled={planningMode === 'week' && weekModeReadOnly}
              className={`${planningMode === 'week' && weekModeReadOnly ? 'opacity-50 cursor-not-allowed' : ''} bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded-xl`}
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

      <div className="pb-10 grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        {/* Render day view or week view based on mode */}
        {FEATURES.dayPlanning === 'alpha' && planningMode === 'day' && activeDayISO && board ? (
          // DAY MODE: Show only the active day's meals
          (() => {
            const dayLists = getDayLists(board, activeDayISO);
            // Map over the standard lists, but use dayLists for meal data
            return lists.map(([key, label]) => (
              <section 
                key={key} 
                data-meal-id={key === "snacks" ? "snack1" : key}
                data-testid={key === "snacks" ? "meal-slot-snack" : `meal-slot-${key}`}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur p-4"
              >
                {/* Hidden event emitter for walkthrough system */}
                <div data-testid={key === "snacks" ? "meal-filled-snack" : `meal-filled-${key}`} style={{display: 'none'}} />
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white/90 text-lg font-medium">{label}</h2>
                  <GlobalMealActionBar
                    slot={key as "breakfast" | "lunch" | "dinner" | "snacks"}
                    onCreateWithAI={() => {
                      if (checkLockedDay(activeDayISO)) return;
                      if (key === "snacks") {
                        setSnackPickerOpen(true);
                      } else {
                        setAiMealSlot(key as "breakfast" | "lunch" | "dinner" | "snacks");
                        setAiMealModalOpen(true);
                      }
                    }}
                    onCreateWithChef={() => {
                      if (checkLockedDay(activeDayISO)) return;
                      setCreateWithChefSlot(key as "breakfast" | "lunch" | "dinner");
                      setCreateWithChefOpen(true);
                    }}
                    onSnackCreator={() => {
                      if (checkLockedDay(activeDayISO)) return;
                      setSnackCreatorOpen(true);
                    }}
                    onManualAdd={() => {
                      if (checkLockedDay(activeDayISO)) return;
                      openManualModal(key);
                    }}
                    onLogSnack={() => setLocation("/my-biometrics")}
                    showLogSnack={key === "snacks"}
                  />
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
                          // Guard: Check if day is locked before allowing delete
                          if (checkLockedDay()) return;
                          
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
                          // Update local state first to prevent race condition
                          setBoard(updatedBoard);
                          boardRef.current = updatedBoard;
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
                    <div 
                      data-wt="weekly-empty-slot"
                      className="rounded-2xl border border-dashed border-zinc-700 text-white/50 p-6 text-center text-sm"
                    >
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
          <>
            {weekModeReadOnly && (
              <div className="mb-4 rounded-xl bg-amber-900/30 border border-amber-600/40 px-4 py-3 flex items-center gap-3">
                <Lock className="h-5 w-5 text-amber-400 flex-shrink-0" />
                <span className="text-amber-200 text-sm">
                  This week contains locked days saved to Biometrics. Switch to Day view to edit unlocked days.
                </span>
              </div>
            )}
            {lists.map(([key, label]) => (
          <section key={key} data-meal-id={key === "snacks" ? "snack1" : key} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white/90 text-lg font-medium">{label}</h2>
              <div className="flex gap-2">
                {/* Plus button for manual entry - disabled in read-only mode */}
                <Button
                  size="sm"
                  variant="ghost"
                  className={weekModeReadOnly ? "text-white/40 cursor-not-allowed" : "text-white/80 hover:bg-white/10"}
                  onClick={() => !weekModeReadOnly && openManualModal(key)}
                  disabled={weekModeReadOnly}
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
              {board.lists[key].map((meal: Meal, idx: number) => (
                <MealCard
                  key={meal.id}
                  date={"board"}
                  slot={key}
                  meal={meal}
                  onUpdated={(m) => {
                    if (m === null) {
                      // Guard: Check if day is locked before allowing delete
                      if (checkLockedDay()) return;
                      
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
                      boardRef.current = updatedBoard;
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
            ))}
          </>
        )}

        {/* Quick Add Protein/Carbs - Above Daily Totals */}
        <div className="col-span-full">
          {(() => {
            const resolved = getResolvedTargets(user?.id);
            const proteinDeficit = Math.max(0, (resolved.protein_g || 0) - Math.round(totals.protein));
            const carbsDeficit = Math.max(0, (resolved.carbs_g || 0) - Math.round(totals.carbs));
            
            if (proteinDeficit === 0 && carbsDeficit === 0) return null;
            
            return (
              <div className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-lg p-4 mb-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm text-white/80">
                    {proteinDeficit > 0 && <span>Need <strong className="text-orange-400">{proteinDeficit}g protein</strong></span>}
                    {proteinDeficit > 0 && carbsDeficit > 0 && <span> · </span>}
                    {carbsDeficit > 0 && <span>Need <strong className="text-orange-400">{carbsDeficit}g carbs</strong></span>}
                  </div>
                  <Button
                    onClick={() => setAdditionalMacrosOpen(true)}
                    className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                    data-testid="button-quick-add-macros"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Quick Add
                  </Button>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Remaining Macros Footer - Inline for Day Mode, Sticky for Week Mode */}
        {board && FEATURES.dayPlanning === 'alpha' && (() => {
          const isDay = planningMode === 'day' && activeDayISO;
          const dayLists = isDay ? getDayLists(board, activeDayISO) : board.lists;
          const computeSlotMacros = (meals: Meal[]) => ({
            count: meals.length,
            calories: meals.reduce((sum, m) => sum + (m.nutrition?.calories || 0), 0),
            protein: meals.reduce((sum, m) => sum + (m.nutrition?.protein || 0), 0),
            carbs: meals.reduce((sum, m) => sum + (m.nutrition?.carbs || 0), 0),
            fat: meals.reduce((sum, m) => sum + (m.nutrition?.fat || 0), 0),
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
          };
          const dayAlreadyLocked = isDay ? isDayLocked(activeDayISO, user?.id) : false;
          
          return (
            <div className={isDay ? "col-span-full Of a man and a woman as far as June June 2024 them" : "col-span-full pb-32"}>
              <RemainingMacrosFooter
                consumedOverride={consumed}
                showSaveButton={Boolean(isDay) && !dayAlreadyLocked}
                layoutMode={isDay ? "inline" : "sticky"}
                onSaveDay={isDay ? async () => {
                  const raw = getMacroTargets(user?.id);
                  const targets = raw 
                    ? { calories: raw.calories, protein_g: raw.protein_g, carbs_g: raw.carbs_g, fat_g: raw.fat_g }
                    : { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
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
                      title: "Day Saved to Biometrics",
                      description: `${new Date(activeDayISO + 'T00:00:00Z').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })} has been locked.`,
                    });
                    setLocation('/my-biometrics');
                  }
                } : undefined}
              />
            </div>
          );
        })()}

        {/* Bottom spacing to clear fixed shopping bar */}
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

      {/* Snack Picker Drawer - Normal healthy snacks */}
      <SnackPickerDrawer
        open={snackPickerOpen}
        onClose={() => setSnackPickerOpen(false)}
        onSnackSelect={handleSnackSelect}
        dietType="normal"
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
      <AIMealCreatorModal
        open={aiMealModalOpen}
        onOpenChange={setAiMealModalOpen}
        onMealGenerated={handleAIMealGenerated}
        mealSlot={aiMealSlot}
        showMacroTargeting={false}
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
            <div className="fixed bottom-0 left-0 right-0 z-60 bg-gradient-to-r from-zinc-900/95 via-zinc-800/95 to-black/95 backdrop-blur-xl shadow-2xl safe-area-inset-bottom">
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
                      data-testid="send-week-to-shopping"
                    >
                      {/* Hidden event emitter for walkthrough system */}
                      <div data-testid="shopping-week-sent" style={{display: 'none'}} />
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

      {/* Meal Premade Picker Modal - DEPRECATED, kept for Phase 3 cleanup */}
      {/* <MealPremadePicker
        open={premadePickerOpen}
        onClose={() => setPremadePickerOpen(false)}
        mealType={premadePickerSlot}
        onMealSelect={handlePremadeSelect}
      /> */}

      {/* Create With Chef Modal (replaces AI Premades) */}
      <CreateWithChefModal
        open={createWithChefOpen}
        onOpenChange={setCreateWithChefOpen}
        mealType={createWithChefSlot}
        onMealGenerated={handleCreateWithChefSelect}
      />

      {/* Snack Creator Modal (Phase 2 - craving to healthy snack) */}
      <SnackCreatorModal
        open={snackCreatorOpen}
        onOpenChange={setSnackCreatorOpen}
        onSnackGenerated={handleSnackSelect}
      />

      {/* Quick Tour Modal */}
      <QuickTourModal
        isOpen={quickTour.shouldShow}
        onClose={quickTour.closeTour}
        title="How to Build Your Week"
        steps={WEEKLY_TOUR_STEPS}
      />

      {/* Locked Day Dialog */}
      <LockedDayDialog
        open={lockedDayDialogOpen}
        onOpenChange={setLockedDayDialogOpen}
        dateISO={pendingLockedDayISO}
        onViewOnly={() => { setLockedDayDialogOpen(false); setPendingLockedDayISO(''); }}
        onCreateNewDay={handleGoToToday}
      />

      {/* Additional Macros Modal */}
      <AdditionalMacrosModal
        open={additionalMacrosOpen}
        onClose={() => setAdditionalMacrosOpen(false)}
        onAdd={(meal) => quickAdd("snacks", meal)}
        proteinDeficit={(() => {
          const resolved = getResolvedTargets(user?.id);
          return Math.max(0, (resolved.protein_g || 0) - Math.round(totals.protein));
        })()}
        carbsDeficit={(() => {
          const resolved = getResolvedTargets(user?.id);
          return Math.max(0, (resolved.carbs_g || 0) - Math.round(totals.carbs));
        })()}
      />
      </div>
    </motion.div>
  );
}