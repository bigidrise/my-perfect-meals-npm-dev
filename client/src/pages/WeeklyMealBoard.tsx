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
import { PillButton } from "@/components/ui/pill-button";
import { HowThisWorksLink } from "@/components/ui/HowThisWorksLink";
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
import { LockedDayDialog } from "@/components/biometrics/LockedDayDialog";
import {
  lockDay,
  isDayLocked,
  hasLockedDaysInWeek,
  getLockedDaysInWeek,
  initLockedDaysCache,
} from "@/lib/lockedDays";
import { setQuickView } from "@/lib/macrosQuickView";
import { getMacroTargets } from "@/lib/dailyLimits";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeDiet, mealMatchesDiet } from "@/utils/dietaryFilter";
import WeeklyOverviewModal from "@/components/WeeklyOverviewModal";
import BuilderShoppingBar from "@/components/BuilderShoppingBar";
import BottomNav from "@/components/BottomNav";
import { buildDiversityContext, type DiversityContext } from "@/lib/diversityContext";
import { useOnboardingProfile } from "@/hooks/useOnboardingProfile";
import { computeTargetsFromOnboarding, sumBoard } from "@/lib/targets";
import { useTodayMacros } from "@/hooks/useTodayMacros";
import { useMidnightReset } from "@/hooks/useMidnightReset";
import {
  getWeekStartISOInTZ,
  getTodayISOSafe,
  weekDatesInTZ,
  todayISOInTZ,
  nextWeekISO,
  prevWeekISO,
  formatWeekLabel,
  formatDateDisplay,
  addDaysISOSafe,
  isoToUtcNoonDate,
} from "@/utils/midnight";
import { useQueryClient } from "@tanstack/react-query";

import {
  Calendar1,
  Check,
  BarChart3,
  ShoppingCart,
  X,
  Home,
  ArrowLeft,
  Calendar,
  Lock,
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
import { setActiveBuilderNs } from "@/lib/activeBuilderNs";
import { getMondayISO } from "@/../../shared/schema/weeklyBoard";
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
import { useCopilot } from "@/components/copilot/CopilotContext";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import {
  isGuestMode,
  incrementMealsBuilt,
  startMealBoardVisit,
  endMealBoardVisit,
  shouldShowHardGate,
  getGuestLoopCount,
  hasActiveMealDaySession,
  getActiveMealDaySessionRemaining,
} from "@/lib/guestMode";
import { GUEST_SUITE_BRANDING } from "@/lib/guestSuiteBranding";
import { ProTipCard } from "@/components/ProTipCard";
import { useMealBoardDraft } from "@/hooks/useMealBoardDraft";
import { NutritionBudgetBanner } from "@/components/NutritionBudgetBanner";
import { BuilderHeader } from "@/components/pro/BuilderHeader";
import { TrialBanner } from "@/components/TrialBanner";

// CHICAGO CALENDAR FIX v1.0: Week navigation utilities are now imported from midnight.ts
// Using noon UTC anchor pattern to avoid day-shift bugs

const WEEKLY_TOUR_STEPS: TourStep[] = [
  {
    icon: "1",
    title: "Choose Your Builder",
    description:
      "Tap 'Create with Chef' to describe what you want, and let the AI build your meal.",
  },
  {
    icon: "2",
    title: "Fill Each Meal Card",
    description:
      "Add breakfast, lunch, dinner, and snacks. Preparation cards will guide you if needed.",
  },
  {
    icon: "3",
    title: "Duplicate Your Days",
    description: "Use 'Duplicate' to copy meals to other days of the week.",
  },
  {
    icon: "4",
    title: "Track Your Macros",
    description: "Send your day to the Macro Calculator to track nutrition.",
  },
  {
    icon: "5",
    title: "Build Your Grocery List",
    description:
      "Send ingredients to the Shopping List for easy grocery shopping.",
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

export default function WeeklyMealBoard() {
  usePageTitle("Weekly Meal Builder");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isDesktop = useIsDesktop();
  const queryClient = useQueryClient();
  const { runAction, open, startWalkthrough } = useCopilot();
  const { user } = useAuth();
  const userDiet = normalizeDiet(user?.dietaryRestrictions);

  const [, proParams] = useRoute("/pro/clients/:id/weekly-builder");
  const proClientId = proParams?.id;

  const effectiveUserId = proClientId || user?.id;

  const quickTour = useQuickTour("weekly-meal-board");

  // 🎯 BULLETPROOF BOARD LOADING: Cache-first, guaranteed to render
  // CHICAGO CALENDAR FIX v1.0: Uses noon UTC anchor pattern
  const [weekStartISO, setWeekStartISO] = React.useState<string>(() =>
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
  } = useWeeklyBoard("1", weekStartISO, proClientId);

  // Local mutable board state for optimistic updates
  const [board, setBoard] = React.useState<WeekBoard | null>(null);
  const { fetchImageForMeal } = useChefMealImage();
  const boardRef = React.useRef<WeekBoard | null>(null);

  // Register WeeklyMealBoard as the active board (default namespace — no bt)
  React.useEffect(() => {
    setActiveBuilderNs(undefined);
  }, []);

  // Reset the initial-hydration gate whenever the viewed week changes.
  // This ensures incoming server data for the new week bypasses skipServerSync()
  // and always paints — even if the user made edits in the previous week.
  React.useEffect(() => {
    boardRef.current = null;
  }, [weekStartISO]);

  const [saving, setSaving] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);

  // Initialize locked days cache from server on component load
  React.useEffect(() => {
    if (effectiveUserId) {
      initLockedDaysCache(effectiveUserId);
    }
  }, [effectiveUserId]);

  // Guest mode: Hard gate enforcement - redirect if 4 meal days used
  // Checks on mount AND listens for guestProgressUpdate events during session
  React.useEffect(() => {
    const checkHardGate = () => {
      if (isGuestMode() && shouldShowHardGate()) {
        toast({
          title: GUEST_SUITE_BRANDING.loopLimits.blockedAccessTitle,
          description: GUEST_SUITE_BRANDING.loopLimits.blockedAccessDescription,
        });
        setLocation("/pricing");
      }
    };

    // Check on mount
    checkHardGate();

    // Listen for progress updates (fires when loopCount changes)
    const handleProgressUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.action === "mealDayUsed") {
        checkHardGate();
      }
    };

    window.addEventListener("guestProgressUpdate", handleProgressUpdate);
    return () => {
      window.removeEventListener("guestProgressUpdate", handleProgressUpdate);
    };
  }, [setLocation, toast]);

  // Guest mode: Track meal board visits for "meal day" counting (24-hour sessions)
  React.useEffect(() => {
    if (isGuestMode() && !shouldShowHardGate()) {
      // Check if returning to an active session or starting a new one
      const hadActiveSession = hasActiveMealDaySession();
      const newMealDayConsumed = startMealBoardVisit();
      const loopCount = getGuestLoopCount();

      if (newMealDayConsumed) {
        // NEW meal day session started
        toast({
          title: `Meal Day ${loopCount} of 4 Started`,
          description: GUEST_SUITE_BRANDING.coaching.welcomeToBoard,
          duration: 6000,
        });
      } else if (hadActiveSession) {
        // Returning to active session
        const remaining = getActiveMealDaySessionRemaining();
        if (remaining) {
          toast({
            title: "Welcome Back",
            description: `You're still in Meal Day ${loopCount}. Session active for ${remaining.hours}h ${remaining.minutes}m more. Keep building!`,
            duration: 4000,
          });
        }
      }

      return () => {
        endMealBoardVisit();
      };
    }
  }, [toast]);

  // Draft persistence for crash/reload recovery
  const { clearDraft, skipServerSync, markClean } = useMealBoardDraft(
    {
      userId: effectiveUserId,
      builderId: "weekly-meal-board",
      weekStartISO,
    },
    board,
    setBoard,
    hookLoading,
    hookBoard,
  );

  // Sync hook board to local state only after loading completes
  // Initial hydration always succeeds; draft logic only blocks subsequent syncs
  React.useEffect(() => {
    if (!hookLoading && hookBoard) {
      if (!boardRef.current) {
        setBoard(hookBoard);
        boardRef.current = hookBoard;
        return;
      }
      if (skipServerSync()) {
        return;
      }
      if (!Object.is(boardRef.current, hookBoard)) {
        setBoard(hookBoard);
        boardRef.current = hookBoard;
      }
    }
  }, [hookBoard, hookLoading, skipServerSync]);

  // Use hook's loading state directly (no local copy needed)
  const loading = hookLoading;

  // Wrapper to save with idempotent IDs
  const saveBoard = React.useCallback(
    async (updatedBoard: WeekBoard) => {
      setSaving(true);
      try {
        // Type assertion needed because ExtendedMeal has optional title, but schema requires it
        await saveToHook(updatedBoard as any, uuidv4());
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
        // Clear draft after successful server save
        // Note: do NOT call markClean() — keeping dirtyRef=true blocks hookBoard
        // from overwriting local board (which may have imageUrls the server stripped)
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

  // AI Premades modal state (DEPRECATED - replaced by Create With Chef)
  const [premadePickerOpen, setPremadePickerOpen] = useState(false);
  const [premadePickerSlot, setPremadePickerSlot] = useState<
    "breakfast" | "lunch" | "dinner"
  >("breakfast");

  // Create With Chef modal state (replaces AI Premades)
  const [createWithChefOpen, setCreateWithChefOpen] = useState(false);
  const [createWithChefSlot, setCreateWithChefSlot] = useState<
    "breakfast" | "lunch" | "dinner" | "meal4" | "meal5" | "meal6"
  >("breakfast");

  // Snack Creator modal state (Phase 2 - replaces Create with AI for snacks)
  const [snackCreatorOpen, setSnackCreatorOpen] = useState(false);

  // Favorites picker state
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [favoritesSlot, setFavoritesSlot] = useState<"breakfast" | "lunch" | "dinner" | "snacks" | "meal4" | "meal5" | "meal6">("breakfast");

  // Locked day dialog state
  const [lockedDayDialogOpen, setLockedDayDialogOpen] = useState(false);
  const [additionalMacrosOpen, setAdditionalMacrosOpen] = useState(false);
  const [pendingLockedDayISO, setPendingLockedDayISO] = useState<string>("");

  // Computed: check if week mode is read-only (any day in week is locked)
  const weekModeReadOnly = React.useMemo(() => {
    if (planningMode !== "week") return false;
    return hasLockedDaysInWeek(weekStartISO, effectiveUserId);
  }, [planningMode, weekStartISO, effectiveUserId]);

  // Build StarchContext for Create With Chef modal
  // This enables intelligent carb distribution based on existing meals
  const starchContext: StarchContext | undefined = useMemo(() => {
    if (!board || !activeDayISO) return undefined;

    // Get the starch strategy from resolved targets (default to 'one' if no user/targets)
    const resolved = effectiveUserId ? getResolvedTargets(effectiveUserId) : null;
    const strategy = resolved?.starchStrategy || "one";

    // Get existing meals for the active day
    const dayLists = getDayLists(board, activeDayISO);
    const existingMeals: StarchContext["existingMeals"] = [];

    // Classify each meal slot
    for (const slot of ["breakfast", "lunch", "dinner"] as const) {
      const meals = dayLists[slot] || [];
      for (const meal of meals) {
        existingMeals.push({
          slot,
          hasStarch: classifyMeal(meal).isStarchMeal,
        });
      }
    }

    return {
      strategy,
      existingMeals,
    };
  }, [board, activeDayISO, effectiveUserId]);

  // Build DiversityContext for Create With Chef modal
  // Tracks which bases (quinoa, tofu…) and meal formats (bowl, salad…) are already on the board
  // so the AI avoids generating a repetitive week of meals
  // NOTE: Uses direct board.days access (not getDayLists) to avoid mutating board state
  const diversityContext: DiversityContext | undefined = useMemo(() => {
    try {
      if (!board || !activeDayISO) return undefined;
      const dayData = board.days?.[activeDayISO];
      if (!dayData) return undefined;
      const allMeals = [
        ...(dayData.breakfast || []),
        ...(dayData.lunch || []),
        ...(dayData.dinner || []),
      ];
      if (allMeals.length < 2) return undefined;
      return buildDiversityContext(allMeals);
    } catch {
      return undefined;
    }
  }, [board, activeDayISO]);

  // Guard function: checks if current day is locked before allowing edits
  // NOTE: Always recompute lock state fresh to avoid stale closure issues
  const checkLockedDay = useCallback(
    (forDayISO?: string): boolean => {
      // Week mode: silently block edits if any day in the week is locked
      // (banner already informs user - no dialog needed)
      if (planningMode === "week") {
        // Recompute fresh instead of using memoized value
        const isWeekLocked = hasLockedDaysInWeek(weekStartISO, effectiveUserId);
        return isWeekLocked;
      }

      // Day mode: check specific day and show dialog
      const dayToCheck = forDayISO || activeDayISO;
      if (dayToCheck && isDayLocked(dayToCheck, effectiveUserId)) {
        setPendingLockedDayISO(dayToCheck);
        setLockedDayDialogOpen(true);
        return true; // Day is locked, block edit
      }
      return false; // Day is not locked, allow edit
    },
    [activeDayISO, planningMode, weekStartISO, effectiveUserId],
  );

  // Handle "Go to Today" from locked day dialog
  const handleGoToToday = useCallback(() => {
    const today = todayISOInTZ("America/Chicago");
    setActiveDayISO(today);
    setLockedDayDialogOpen(false);
    setPendingLockedDayISO("");
  }, []);

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
              [premadePickerSlot]: [...board.lists[premadePickerSlot], meal],
            },
            version: board.version + 1,
            meta: {
              ...board.meta,
              lastUpdatedAt: new Date().toISOString(),
            },
          };
          setBoard(updatedBoard);
          boardRef.current = updatedBoard;
          await saveBoard(updatedBoard);
        }

        // Only dispatch macros:updated - do NOT refetch board after local mutation
        // board:updated was causing race condition where stale server data overwrote local state
        window.dispatchEvent(new Event("macros:updated"));

        // Dispatch walkthrough event (premadePickerSlot is always breakfast/lunch/dinner, never snacks)
        const eventTarget = document.querySelector(
          `[data-testid="meal-filled-${premadePickerSlot}"]`,
        );
        if (eventTarget) {
          eventTarget.dispatchEvent(new CustomEvent("filled"));
        }
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
      weekStartISO,
      saveBoard,
      toast,
    ],
  );

  // Handler for Create With Chef meal selection (replaces AI Premades)
  // NOTE: slot is passed from the modal to avoid stale state issues
  const handleCreateWithChefSelect = useCallback(
    async (meal: any, slot: "breakfast" | "lunch" | "dinner" | "snacks") => {
      if (!board) return;

      // Guard: Check if day is locked before allowing edits
      if (checkLockedDay()) return;

      try {
        // Add to the appropriate slot based on slot parameter from modal
        if (
          FEATURES.dayPlanning === "alpha" &&
          planningMode === "day" &&
          activeDayISO
        ) {
          // Add to specific day
          const dayLists = getDayLists(board, activeDayISO);
          const updatedDayLists = {
            ...dayLists,
            [slot]: [...dayLists[slot as keyof typeof dayLists], meal],
          };
          const updatedBoard = setDayLists(
            board,
            activeDayISO,
            updatedDayLists,
          );
          setBoard(updatedBoard);
          boardRef.current = updatedBoard;
          await saveBoard(updatedBoard);
        } else {
          // Week mode: update local board and save
          const updatedBoard = {
            ...board,
            lists: {
              ...board.lists,
              [slot]: [...board.lists[slot], meal],
            },
            version: board.version + 1,
            meta: {
              ...board.meta,
              lastUpdatedAt: new Date().toISOString(),
            },
          };
          setBoard(updatedBoard);
          boardRef.current = updatedBoard;
          await saveBoard(updatedBoard);
        }

        fetchImageForMeal(meal, slot, (mealId, imageUrl) => {
          setBoard(prev => {
            if (!prev) return prev;
            if (getMealImageUrl(prev, mealId) === imageUrl) return prev;
            const updated = updateMealImageInBoard(prev, mealId, imageUrl);
            saveBoard(updated).catch(() => {});
            return updated;
          });
        }, userDiet);

        window.dispatchEvent(new Event("macros:updated"));

        const eventTarget = document.querySelector(
          `[data-testid="meal-filled-${slot}"]`,
        );
        if (eventTarget) {
          eventTarget.dispatchEvent(new CustomEvent("filled"));
        }
      } catch (error) {
        console.error("Failed to add Create With Chef meal:", error);
        toast({
          title: "Error",
          description: "Failed to add meal. Please try again.",
          variant: "destructive",
        });
      }
    },
    [
      board,
      planningMode,
      activeDayISO,
      weekStartISO,
      saveBoard,
      toast,
      checkLockedDay,
    ],
  );

  // Handler for snack selection (used by SnackCreatorModal)
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
              snacks: [...board.lists.snacks, snack],
            },
            version: board.version + 1,
            meta: {
              ...board.meta,
              lastUpdatedAt: new Date().toISOString(),
            },
          };
          setBoard(updatedBoard);
          boardRef.current = updatedBoard;
          await saveBoard(updatedBoard);
        }

        // Only dispatch macros:updated - do NOT refetch board after local mutation
        window.dispatchEvent(new Event("macros:updated"));

        // Trigger proper image pipeline — matches Chef/Craving Creator flow
        fetchImageForMeal({ id: snack.id, name: snack.name }, 'snacks', (mealId, imageUrl) => {
          setBoard(prev => {
            if (!prev) return prev;
            if (getMealImageUrl(prev, mealId) === imageUrl) return prev;
            return updateMealImageInBoard(prev, mealId, imageUrl);
          });
        }, userDiet);

        // Dispatch walkthrough event for snacks
        const eventTarget = document.querySelector(
          `[data-testid="meal-filled-snack"]`,
        );
        if (eventTarget) {
          eventTarget.dispatchEvent(new CustomEvent("filled"));
        }
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

  const [tourStep, setTourStep] = useState<
    "breakfast" | "lunch" | "dinner" | "complete"
  >("breakfast");

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
      setTourStep(
        saved as "breakfast" | "lunch" | "dinner" | "complete",
      );
    }
  }, []);

  const advanceTourStep = useCallback(() => {
    const sequence: Array<
      "breakfast" | "lunch" | "dinner" | "complete"
    > = ["breakfast", "lunch", "dinner", "complete"];
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
  // CHICAGO CALENDAR FIX v1.0: Use noon UTC anchor pattern
  const weekDatesList = useMemo(() => {
    return weekStartISO ? weekDatesInTZ(weekStartISO, "America/Chicago") : [];
  }, [weekStartISO]);

  // Set initial active day when week loads
  // UX: Auto-focus on today if it's in this week, otherwise default to Monday
  // CHICAGO CALENDAR FIX v1.0: Both weekDatesInTZ and getTodayISOSafe use noon UTC anchor
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
      console.log(
        "🔋 Loading AI meals from localStorage:",
        cached.meals.length,
        "meals for",
        activeDayISO,
        "into slot:",
        cached.slot,
      );

      // Merge cached AI meals into the correct slot (not hardcoded to breakfast!)
      const dayLists = getDayLists(board, activeDayISO);
      const targetSlot = cached.slot || "breakfast"; // Fallback to breakfast for old cached data
      const existingSlotMeals = dayLists[targetSlot].filter(
        (m) => !m.id.startsWith("ai-meal-"),
      );
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
      const eventTarget = document.querySelector(
        `[data-testid="daily-totals-ready"]`,
      );
      if (eventTarget) {
        eventTarget.dispatchEvent(new CustomEvent("ready"));
      }
    }, 500); // Increased delay to ensure DOM is fully rendered

    return () => clearTimeout(timer);
  }, [board, planningMode, activeDayISO]); // Watch board, mode, and active day

  // Duplicate day handler
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
          cacheUserId: proClientId || "1",
        });

        if (result.currentWeekBoard) {
          setBoard(result.currentWeekBoard);
          boardRef.current = result.currentWeekBoard;
          await saveBoard(result.currentWeekBoard);
        }

        if (result.errors.length > 0) {
          toast({
            title: "Partial duplicate",
            description: `${result.currentWeekDayCount + result.otherWeeksSaved} of ${result.totalDays} days saved. Some future weeks failed.`,
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



  const profile = useOnboardingProfile();
  const targets = computeTargetsFromOnboarding(profile);

  // 🔧 FIX #1: Use real macro tracking instead of board state
  const macroData = useTodayMacros(effectiveUserId || "");
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
        className={`text-xs px-2 py-1 rounded-2xl border ${
          ok
            ? "border-lime-500/40 text-lime-300 bg-lime-500/10"
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
  // Only log to console for debugging, don't interrupt UX with toasts
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

  // Week navigation handlers (hook manages loading state automatically)
  // Just update weekStartISO - the useWeeklyBoard hook handles fetching with cache fallback
  const gotoWeek = useCallback((targetISO: string) => {
    setWeekStartISO(targetISO);
  }, []);

  // CHICAGO CALENDAR FIX v1.0: Use noon UTC anchor helpers for week navigation
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

    // Hard dietary compliance guard — block non-compliant meals from reaching the board
    const userDiet = normalizeDiet(user?.dietaryRestrictions);
    if (!mealMatchesDiet(userDiet, meal)) {
      toast({
        title: "Dietary restriction",
        description: `"${meal.name}" doesn't meet your ${userDiet} dietary requirements and cannot be added to the board.`,
        variant: "destructive",
      });
      return;
    }

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
            [list]: [...board.lists[list], meal],
          },
          version: board.version + 1,
          meta: {
            ...board.meta,
            lastUpdatedAt: new Date().toISOString(),
          },
        };
        setBoard(updatedBoard);
        boardRef.current = updatedBoard;
        await saveBoard(updatedBoard);
        console.log("✅ Successfully added meal to", list, "for", weekStartISO);
      }

      // Only dispatch macros:updated - do NOT refetch board after local mutation
      try {
        window.dispatchEvent(new Event("macros:updated"));
      } catch {
        /* no-op, safest on older browsers */
      }

      // Guest mode: Track meal building for unlocks and meal day counting
      // incrementMealsBuilt() now handles both mealsBuiltCount AND countMealDayUsed() internally
      if (isGuestMode()) {
        incrementMealsBuilt();
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
    const userDiet = normalizeDiet(user?.dietaryRestrictions);
    if (!mealMatchesDiet(userDiet, mealObj)) {
      toast({
        title: "Dietary restriction",
        description: `"${mealObj.name}" doesn't meet your ${userDiet} dietary requirements.`,
        variant: "destructive",
      });
      return;
    }
    try {
      if (FEATURES.dayPlanning === "alpha" && planningMode === "day" && activeDayISO) {
        const dayLists = getDayLists(board, activeDayISO);
        const updatedDayLists = { ...dayLists, [favoritesSlot]: [mealObj] };
        const updatedBoard = setDayLists(board, activeDayISO, updatedDayLists);
        setBoard(updatedBoard);
        boardRef.current = updatedBoard;
        await saveBoard(updatedBoard);
      } else {
        const updatedBoard = {
          ...board,
          lists: { ...board.lists, [favoritesSlot]: [mealObj] },
          version: board.version + 1,
          meta: { ...board.meta, lastUpdatedAt: new Date().toISOString() },
        };
        setBoard(updatedBoard);
        boardRef.current = updatedBoard;
        await saveBoard(updatedBoard);
      }
      window.dispatchEvent(new Event("macros:updated"));
      setFavoritesOpen(false);
    } catch (err) {
      console.error("Failed to insert favorite:", err);
    }
  }, [board, favoritesSlot, planningMode, activeDayISO, saveBoard, checkLockedDay, user, toast]);

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
          starchyCarbs: meal.starchyCarbs ?? meal.nutrition?.starchyCarbs ?? 0,
          fibrousCarbs: meal.fibrousCarbs ?? meal.nutrition?.fibrousCarbs ?? 0,
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
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-28 overflow-x-hidden"
    >
      <BuilderHeader title="Weekly Meal Builder" onOpenTour={quickTour.openTour} clientId={proClientId} />
      <TrialBanner />

      {/* Main Content */}
      <div
        className="max-w-[1600px] mx-auto px-4 space-y-6"
        style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + ${proClientId ? '9rem' : '6rem'})` }}
      >
        {/* Nutrition Budget Banner - Phase 1: Read-only awareness */}
        <NutritionBudgetBanner className="mb-2" userId={effectiveUserId} />

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
            {FEATURES.dayPlanning === "alpha" && activeDayISO && board && (
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

              <HowThisWorksLink />

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

        <div className="pb-10 grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
          {/* Render day view or week view based on mode */}
          {FEATURES.dayPlanning === "alpha" &&
          planningMode === "day" &&
          activeDayISO &&
          board ? (
            // DAY MODE: Meal 1/2/3, dynamic Meal 4+, Snacks
            (() => {
              const dayLists = getDayLists(board, activeDayISO);
              return (
                <>
                  {lists.map(([key, label]) => (
                    <section
                      key={key}
                      data-meal-id={key}
                      data-testid={`meal-slot-${key}`}
                      className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur p-4"
                    >
                      <div data-testid={`meal-filled-${key}`} style={{ display: "none" }} />
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-white/90 text-lg font-medium">{label}</h2>
                        <GlobalMealActionBar
                          slot={key as "breakfast" | "lunch" | "dinner" | "meal4" | "meal5" | "meal6"}
                          onCreateWithAI={() => {
                            if (checkLockedDay(activeDayISO)) return;
                            setAiMealSlot(key as "breakfast" | "lunch" | "dinner" | "snacks" | "meal4" | "meal5" | "meal6");
                            setAiMealModalOpen(true);
                          }}
                          onCreateWithChef={() => {
                            if (checkLockedDay(activeDayISO)) return;
                            setCreateWithChefSlot(key as "breakfast" | "lunch" | "dinner" | "meal4" | "meal5" | "meal6");
                            setCreateWithChefOpen(true);
                          }}
                          onSnackCreator={() => {
                            if (checkLockedDay(activeDayISO)) return;
                            setSnackCreatorOpen(true);
                          }}
                          onSave={(meal) => { if (!checkLockedDay(activeDayISO)) quickAdd(key as "breakfast"|"lunch"|"dinner"|"snacks"|"meal4"|"meal5"|"meal6", meal); }}
                          onImageReady={(mealId, imageUrl) => { setBoard(prev => { if (!prev) return prev; if (getMealImageUrl(prev, mealId) === imageUrl) return prev; const updated = updateMealImageInBoard(prev, mealId, imageUrl); saveBoard(updated).catch(() => {}); return updated; }); }}
                          onFavorites={() => {
                            if (checkLockedDay(activeDayISO)) return;
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
                            data-wt="wmb-meal-card"
                            onUpdated={(m) => {
                              if (m === null) {
                                if (checkLockedDay()) return;
                                if (meal.id.startsWith("ai-meal-")) clearAIMealsCache();
                                const updatedDayLists = { ...dayLists, [key]: dayLists[key as keyof typeof dayLists].filter((e) => e.id !== meal.id) };
                                const updatedBoard = setDayLists(board, activeDayISO, updatedDayLists);
                                setBoard(updatedBoard);
                                boardRef.current = updatedBoard;
                                putWeekBoard(weekStartISO, updatedBoard, proClientId)
                                  .then(({ week }) => { if (week) setBoard(week); })
                                  .catch((err) => {
                                    console.error("❌ Delete sync failed (Day mode):", err);
                                    toast({ title: "Sync pending", description: "Changes will sync automatically." });
                                  });
                              } else {
                                const updatedDayLists = { ...dayLists, [key]: dayLists[key as keyof typeof dayLists].map((e, i) => i === idx ? m : e) };
                                const updatedBoard = setDayLists(board, activeDayISO, updatedDayLists);
                                putWeekBoard(weekStartISO, updatedBoard, proClientId).then(({ week }) => setBoard(week));
                              }
                            }}
                          />
                        ))}
                        {dayLists[key as keyof typeof dayLists].length === 0 && (
                          <div data-wt="weekly-empty-slot" className="rounded-2xl border border-dashed border-zinc-700 text-white/50 p-6 text-center text-sm">
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
                        onSnackCreator={() => { if (checkLockedDay(activeDayISO)) return; setSnackCreatorOpen(true); }}
                        onSave={(meal) => { if (!checkLockedDay(activeDayISO)) quickAdd("snacks", meal); }}
                        onImageReady={(mealId, imageUrl) => { setBoard(prev => { if (!prev) return prev; if (getMealImageUrl(prev, mealId) === imageUrl) return prev; const updated = updateMealImageInBoard(prev, mealId, imageUrl); saveBoard(updated).catch(() => {}); return updated; }); }}
                        onFavorites={() => { if (checkLockedDay(activeDayISO)) return; setFavoritesSlot("snacks"); setFavoritesOpen(true); }}
                      />
                    </div>
                    <div className="space-y-3">
                      {dayLists.snacks.map((meal: Meal) => (
                        <MealCard key={meal.id} date={activeDayISO} slot="snacks" meal={meal} showStarchBadge={true}
                          onUpdated={(m) => {
                            if (m === null) {
                              if (checkLockedDay()) return;
                              const updatedDayLists = { ...dayLists, snacks: dayLists.snacks.filter((e) => e.id !== meal.id) };
                              const updatedBoard = setDayLists(board, activeDayISO, updatedDayLists);
                              setBoard(updatedBoard);
                              boardRef.current = updatedBoard;
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
                        <div data-wt="weekly-empty-slot" className="rounded-2xl border border-dashed border-zinc-700 text-white/50 p-6 text-center text-sm">
                          <p className="mb-2">No snacks yet</p>
                          <p className="text-xs text-white/40">Use "Create with Chef" to create snacks</p>
                        </div>
                      )}
                    </div>
                  </section>
                </>
              );
            })()
          ) : (
            // WEEK MODE: Meal 1/2/3 only
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
                <section key={key} data-meal-id={key} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-white/90 text-lg font-medium">{label}</h2>
                    <div className="flex gap-2">
                      {!weekModeReadOnly && <AddOwnMealButton slot={key as "breakfast"|"lunch"|"dinner"|"snacks"|"meal4"|"meal5"|"meal6"} onSave={(meal) => quickAdd(key as "breakfast"|"lunch"|"dinner"|"snacks"|"meal4"|"meal5"|"meal6", meal)} onImageReady={(mealId, imageUrl) => { setBoard(prev => { if (!prev) return prev; if (getMealImageUrl(prev, mealId) === imageUrl) return prev; const updated = updateMealImageInBoard(prev, mealId, imageUrl); saveBoard(updated).catch(() => {}); return updated; }); }} variant="icon" />}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {board.lists[key].map((meal: Meal, idx: number) => (
                      <MealCard key={meal.id} date={"board"} slot={key} meal={meal} showStarchBadge={true}
                        onUpdated={(m) => {
                          if (m === null) {
                            if (checkLockedDay()) return;
                            if (!board) return;
                            const updatedBoard = {
                              ...board,
                              lists: { ...board.lists, [key]: board.lists[key].filter((item: Meal) => item.id !== meal.id) },
                              version: board.version + 1,
                              meta: { ...board.meta, lastUpdatedAt: new Date().toISOString() },
                            };
                            setBoard(updatedBoard);
                            boardRef.current = updatedBoard;
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
            </>
          )}

          {/* Pro Tip Card */}
          <ProTipCard />

          {/* Quick Add - Daily Targets Reference Card */}
          <div hidden>
          <div className="col-span-full">
            {(() => {
              const resolved = getResolvedTargets(effectiveUserId);
              const hasTargets =
                (resolved.protein_g || 0) > 0 || (resolved.carbs_g || 0) > 0;

              // Item 5: Show "Targets not set" instead of silently hiding the card
              if (!hasTargets) return (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 mb-4 text-center">
                  <p className="text-xs text-white/40 uppercase tracking-wide">Daily Targets</p>
                  <p className="text-sm text-white/50 mt-1">
                    {proClientId ? "Waiting for coach targets — use Macro Calculator to set your own." : "Targets not set — use the Macro Calculator to get started."}
                  </p>
                </div>
              );

              const hasStarchyFibrous =
                (resolved.starchyCarbs_g ?? 0) > 0 ||
                (resolved.fibrousCarbs_g ?? 0) > 0;

              return (
                <div className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-lg p-4 mb-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-white/60 uppercase tracking-wide">
                        Daily Targets
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-semibold text-white/70 uppercase tracking-wide">
                          QUICK
                        </span>
                        <PillButton
                          onClick={() => setAdditionalMacrosOpen(true)}
                          data-testid="button-quick-add-macros"
                        >
                          Add
                        </PillButton>
                      </div>
                    </div>
                    {hasStarchyFibrous ? (
                      <div className="grid grid-cols-5 gap-2">
                        <div className="text-center">
                          <div className="text-lg font-bold text-white">
                            {Math.round(resolved.protein_g || 0)}g
                          </div>
                          <div className="text-xs text-white/60">Protein</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-white">
                            {Math.round(resolved.carbs_g || 0)}g
                          </div>
                          <div className="text-xs text-white/60">
                            Total Carbs
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-white">
                            {Math.round(resolved.starchyCarbs_g ?? 0)}g
                          </div>
                          <div className="text-xs text-white/60">Starchy</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-white">
                            {Math.round(resolved.fibrousCarbs_g ?? 0)}g
                          </div>
                          <div className="text-xs text-white/60">Fibrous</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-white">
                            {Math.round(resolved.fat_g || 0)}g
                          </div>
                          <div className="text-xs text-white/60">Fat</div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <div className="text-lg font-bold text-white">
                            {Math.round(resolved.protein_g || 0)}g
                          </div>
                          <div className="text-xs text-white/60">Protein</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-white">
                            {Math.round(resolved.carbs_g || 0)}g
                          </div>
                          <div className="text-xs text-white/60">Carbs</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-white">
                            {Math.round(resolved.fat_g || 0)}g
                          </div>
                          <div className="text-xs text-white/60">Fat</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
          </div>

          {/* Remaining Macros Footer - Inline for Day Mode, Sticky for Week Mode */}
          {board &&
            FEATURES.dayPlanning === "alpha" &&
            (() => {
              const isDay = planningMode === "day" && activeDayISO;
              const dayLists = isDay
                ? getDayLists(board, activeDayISO)
                : board.lists;
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
                // Starchy/fibrous breakdown consumed
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
              const dayAlreadyLocked = isDay
                ? isDayLocked(activeDayISO, effectiveUserId)
                : false;

              return (
                <div
                  className={
                    isDay
                      ? "col-span-full"
                      : "col-span-full pb-32"
                  }
                >
                  {!proClientId && <RemainingMacrosFooter
                    userId={effectiveUserId}
                    consumedOverride={consumed}
                    showSaveButton={Boolean(isDay) && !dayAlreadyLocked}
                    layoutMode={isDay ? "inline" : "sticky"}
                    onSaveDay={
                      isDay
                        ? async () => {
                            const raw = getMacroTargets(effectiveUserId);
                            const targets = raw
                              ? {
                                  calories: raw.calories,
                                  protein_g: raw.protein_g,
                                  carbs_g: raw.carbs_g,
                                  fat_g: raw.fat_g,
                                }
                              : {
                                  calories: 0,
                                  protein_g: 0,
                                  carbs_g: 0,
                                  fat_g: 0,
                                };
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
                                description: `${formatDateDisplay(activeDayISO, { weekday: "long", month: "short", day: "numeric" }, "America/Chicago")} has been locked.`,
                              });
                              if (!isGuestMode()) {
                                setLocation(buildBiometricsUrl({ section: "macros", from: "weekly-meal-board", highlight: true }));
                              }
                            }
                          }
                        : undefined
                    }
                  />}
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
            availableDates={weekDatesList.filter(
              (date) => date !== activeDayISO,
            )}
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

        {/* Shopping bar */}
        <BuilderShoppingBar
          board={board}
          activeDayISO={activeDayISO}
          weekDatesList={weekDatesList}
          sourceSlug="weekly-meal-board"
        />

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
          starchContext={starchContext}
          diversityContext={diversityContext}
          dietType="general-nutrition"
        />

        {/* Snack Creator Modal (Phase 2 - craving to healthy snack) */}
        <SnackCreatorModal
          open={snackCreatorOpen}
          onOpenChange={setSnackCreatorOpen}
          onSnackGenerated={handleSnackSelect}
          starchContext={starchContext}
        />

        {/* Quick Tour Modal */}
        <QuickTourModal
          isOpen={quickTour.shouldShow}
          onClose={quickTour.closeTour}
          title="How to Build Your Week"
          steps={WEEKLY_TOUR_STEPS}
          onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
        />

        {/* Locked Day Dialog */}
        <LockedDayDialog
          open={lockedDayDialogOpen}
          onOpenChange={setLockedDayDialogOpen}
          dateISO={pendingLockedDayISO}
          onViewOnly={() => {
            setLockedDayDialogOpen(false);
            setPendingLockedDayISO("");
          }}
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
      </div>
    </motion.div>
  );
}
