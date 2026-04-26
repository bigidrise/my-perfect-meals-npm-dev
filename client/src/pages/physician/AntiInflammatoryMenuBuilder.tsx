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
import { RemainingMacrosFooter, type ConsumedMacros } from "@/components/biometrics/RemainingMacrosFooter";
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
  todayISOInTZ 
} from "@/utils/midnight";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Check,
  Calendar,
  BarChart3,
  ShoppingCart,
  X,
  Lock,
  Trash2,
  Save,
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
import { useBoardLockStatus } from "@/hooks/useBoardLockStatus";

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
import { getResolvedTargets, clearResolvedTargetsCache } from "@/lib/macroResolver";
import { proStore } from "@/lib/proData";
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
import { PillButton } from "@/components/ui/pill-button";
import { BuilderHeader } from "@/components/pro/BuilderHeader";
import { TrialBanner } from "@/components/TrialBanner";
import type { ClinicalMode } from "../../../../shared/schema/weeklyBoard";
import { resolveClinicalModeFromFlags } from "@shared/clinical/clinicalModeResolver";
import type { ProtocolBadge } from "@shared/clinical/clinicalModeResolver";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

const ANTI_INFLAMMATORY_TOUR_STEPS: TourStep[] = [
  { icon: "1", title: "Healing Foods", description: "All meals feature anti-inflammatory ingredients like leafy greens and omega-3s." },
  { icon: "2", title: "Add Your Meals", description: "Tap + on any meal card to add inflammation-fighting recipes." },
  { icon: "3", title: "Duplicate Days", description: "Copy your anti-inflammatory meal plan to other days." },
  { icon: "4", title: "Track Macros", description: "Send meals to the Macro Calculator for balanced nutrition." },
  { icon: "5", title: "Shopping List", description: "Export ingredients for healing-focused grocery shopping." },
  { icon: "6", title: "Track Progress at Bottom", description: "The bottom bar shows color-coded progress: green = on track, yellow = close, red = over. Tap 'Save Day' to lock your day to Biometrics." },
  { icon: "🥔", title: "Watch Your Starch Slots", description: "The starch indicator shows your daily starch meal status. Green = slots available, Orange = all used, Red = over limit. Fibrous carbs are unlimited!" },
  { icon: "*", title: "What the Asterisks Mean", description: "Protein and carbs are marked with asterisks (*) because they're the most important numbers to focus on when building your meals. Get those right first." }
];

// CHICAGO CALENDAR FIX v1.0: All date utilities now imported from midnight.ts
// Using noon UTC anchor pattern to prevent day-shift bugs

export default function AntiInflammatoryMenuBuilder() {
  usePageTitle("Anti-Inflammatory Builder");
  const quickTour = useQuickTour("anti-inflammatory-menu-builder");
  const [, setLocation] = useLocation();
  
  // ProCare route detection — primary route + legacy routes kept for redirect
  const [, proParamsAntiInflam] = useRoute("/pro/clients/:id/anti-inflammatory-builder");
  const [matchesKidney, proParamsKidney] = useRoute("/pro/clients/:id/kidney-disease-builder");
  const [matchesHeart, proParamsHeart] = useRoute("/pro/clients/:id/heart-failure-builder");
  const [matchesLiverDisease, proParamsLiverDisease] = useRoute("/pro/clients/:id/liver-disease-builder");
  const proParams = proParamsAntiInflam || proParamsKidney || proParamsHeart || proParamsLiverDisease;
  const proClientId = proParams?.id;

  const { locked: boardLocked } = useBoardLockStatus(proClientId);
  const readOnly = !proClientId && boardLocked;

  const { toast } = useToast();
  const isDesktop = useIsDesktop();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const effectiveUserId = proClientId || user?.id;

  // 🎯 BULLETPROOF BOARD LOADING: Cache-first, guaranteed to render
  // CHICAGO CALENDAR FIX v1.0: Using noon UTC anchor pattern
  const [weekStartISO, setWeekStartISO] =
    React.useState<string>(getWeekStartISOInTZ("America/Chicago"));

  // Clinical mode is FLAG-DRIVEN — physician sets flags in clinical dashboard.
  // resolveClinicalModeFromFlags reads flags and picks the correct mode + namespace.
  const [clinicalModeState, setClinicalModeState] = React.useState<ClinicalMode>(
    () => resolveClinicalModeFromFlags(
      effectiveUserId ? getResolvedTargets(effectiveUserId)?.flags : undefined
    ).mode
  );

  // Redirect legacy clinical routes to canonical anti-inflammatory route.
  // Mode is now determined by physician flags, not by URL path.
  useEffect(() => {
    const legacyId = proParamsKidney?.id || proParamsHeart?.id || proParamsLiverDisease?.id;
    if (legacyId) {
      setLocation(`/pro/clients/${legacyId}/anti-inflammatory-builder`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchesKidney, matchesHeart, matchesLiverDisease]);

  // Re-resolve mode when client context hydrates (handles page refresh)
  useEffect(() => {
    if (!effectiveUserId) return;
    const flags = getResolvedTargets(effectiveUserId)?.flags;
    const { mode } = resolveClinicalModeFromFlags(flags);
    setClinicalModeState(mode);
  }, [effectiveUserId]);

  const resolvedProtocol = useMemo(
    () => resolveClinicalModeFromFlags(
      effectiveUserId ? getResolvedTargets(effectiveUserId)?.flags : undefined
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveUserId, clinicalModeState]
  );

  const namespace = resolvedProtocol.namespace;

  // -----------------------------------------------------------------------
  // Lab-derived mode update
  // When no physician flags are set, read the server protocolSignal and update
  // clinicalModeState so the badge, namespace, and guardrails all stay in sync.
  // clinicalModeState is the single source of truth — badge derived from it below.
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!effectiveUserId) return;
    // Skip the server fetch only when a physician badge is set AND it is NOT oncology.
    // Oncology ALWAYS requires server validation because the flag can originate from a
    // stale localStorage entry left over after a physician disconnected — the DB is the
    // authoritative source for whether oncology support is currently enabled.
    const hasNonOncologyPhysicianBadge =
      resolvedProtocol.primaryBadge !== null &&
      resolvedProtocol.mode !== 'oncology-support';
    if (hasNonOncologyPhysicianBadge) return;

    let cancelled = false;
    fetch(apiUrl(`/api/biometrics/labs/${effectiveUserId}`), {
      headers: { ...getAuthHeaders() },
      credentials: "include",
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        console.log("[AntiInflamBuilder] labs fetch →", JSON.stringify(data?.protocolSignal ?? null));
        if (cancelled) return;

        // Physician-assigned oncology takes precedence over lab-derived protocol signal
        if (data?.oncologySupportEnabled) {
          console.log("[AntiInflamBuilder] oncology support active → setting mode to oncology-support");
          setClinicalModeState('oncology-support');
          return;
        }

        // Protocol Ownership Model: server says oncology is OFF, but proStore may have a stale flag.
        // Strip it so future renders don't re-activate the protocol.
        if (!data?.oncologySupportEnabled && resolvedProtocol.mode === 'oncology-support') {
          try {
            const clientMap: Record<string, string> = JSON.parse(
              localStorage.getItem("mpm_user_client_map") || "{}"
            );
            const clientId = clientMap[effectiveUserId];
            if (clientId) {
              const stripped = proStore.stripMedicalFlags(clientId);
              if (stripped) {
                clearResolvedTargetsCache();
                console.log("[AntiInflamBuilder] Stripped stale oncologySupport flag — DB says it is off.");
              }
            }
          } catch {/* localStorage may be unavailable */}
          setClinicalModeState('anti-inflammatory');
          return;
        }

        // User self-selected specialty condition — higher priority than lab-derived signal
        if (data?.specialtyCondition) {
          const conditionModeMap: Record<string, ClinicalMode> = {
            'renal':            'kidney-disease',
            'cardiac':          'heart-failure',
            'liver-disease':    'liver-disease',
            'liver-support':    'liver-support',
            'oncology-support': 'oncology-support',
          };
          const mappedMode = conditionModeMap[data.specialtyCondition] as ClinicalMode | undefined;
          if (mappedMode) {
            console.log("[AntiInflamBuilder] specialtyCondition →", data.specialtyCondition, "→ mode:", mappedMode);
            setClinicalModeState(mappedMode);
            return;
          }
        }
        if (!data?.protocolSignal?.protocol) return;
        const labMode = data.protocolSignal.protocol as ClinicalMode;
        console.log("[AntiInflamBuilder] setting clinicalMode from labs →", labMode);
        setClinicalModeState(labMode);
      })
      .catch(() => {/* silently ignore */});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId]);

  // Badge comes directly from the active clinical mode — always accurate.
  const CLINICAL_MODE_BADGE: Partial<Record<ClinicalMode, ProtocolBadge>> = {
    "liver-disease":    { label: "Liver Disease",    cls: "bg-amber-600 text-white" },
    "kidney-disease":   { label: "Kidney Disease",   cls: "bg-sky-600 text-white" },
    "heart-failure":    { label: "Cardiac Health",   cls: "bg-red-600 text-white" },
    "liver-support":    { label: "Liver Support",    cls: "bg-emerald-600 text-white" },
    "oncology-support": { label: "Oncology Support", cls: "bg-rose-600 text-white" },
  };
  const activePrimaryBadge: ProtocolBadge | null = CLINICAL_MODE_BADGE[clinicalModeState] ?? null;

  const hasClinicalBadges = !!(activePrimaryBadge || resolvedProtocol.modifierBadges.length > 0);
  const contentPaddingTop = `calc(env(safe-area-inset-top, 0px) + ${
    proClientId
      ? (hasClinicalBadges ? '12rem' : '9rem')
      : (hasClinicalBadges ? '9rem'  : '6rem')
  })`;

  const {
    board: hookBoard,
    loading: hookLoading,
    error,
    save: saveToHook,
    source,
    refresh: refreshBoard,
    primeCache,
  } = useWeeklyBoard("2", weekStartISO, proClientId, namespace);

  // Local mutable board state for optimistic updates
  const [board, setBoard] = React.useState<WeekBoard | null>(null);
  const { fetchImageForMeal } = useChefMealImage();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);

  const clinicalMode = clinicalModeState;

  // Draft persistence for crash/reload recovery
  const { clearDraft, skipServerSync, markClean } = useMealBoardDraft(
    {
      userId: effectiveUserId,
      builderId: 'anti-inflammatory-menu-builder',
      weekStartISO,
    },
    board,
    setBoard,
    hookLoading,
    hookBoard
  );

  // Sync hook board to local state — initial hydration must ALWAYS succeed
  const boardInitializedRef = React.useRef(false);

  // Register this builder's board namespace (dynamic — resolves after clinical mode check)
  React.useEffect(() => {
    setActiveBuilderNs(namespace);
  }, [namespace]);

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
  const [createWithChefSlot, setCreateWithChefSlot] = useState<"breakfast" | "lunch" | "dinner" | "meal4" | "meal5" | "meal6">("breakfast");

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

  // Favorites picker state
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [favoritesSlot, setFavoritesSlot] = useState<"breakfast" | "lunch" | "dinner" | "snacks" | "meal4" | "meal5" | "meal6">("breakfast");

  // Locked day dialog state
  const [lockedDayDialogOpen, setLockedDayDialogOpen] = useState(false);
  const [additionalMacrosOpen, setAdditionalMacrosOpen] = useState(false);
  const [pendingLockedDayISO, setPendingLockedDayISO] = useState<string>('');
  
  // Guard function: checks if current day is locked before allowing edits
  const checkLockedDay = useCallback((forDayISO?: string): boolean => {
    const dayToCheck = forDayISO || activeDayISO;
    if (planningMode === 'day' && dayToCheck && isDayLocked(dayToCheck, effectiveUserId)) {
      setPendingLockedDayISO(dayToCheck);
      setLockedDayDialogOpen(true);
      return true; // Day is locked, block edit
    }
    return false; // Day is not locked, allow edit
  }, [activeDayISO, planningMode, effectiveUserId]);
  
  // Handle "Go to Today" from locked day dialog
  const handleGoToToday = useCallback(() => {
    const today = todayISOInTZ("America/Chicago");
    setActiveDayISO(today);
    setLockedDayDialogOpen(false);
    setPendingLockedDayISO('');
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
  const AI_MEALS_CACHE_KEY = "anti-inflammatory-ai-meal-creator-cached-meals";

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
    const infoSeen = localStorage.getItem(
      "anti-inflammatory-menu-builder-info-seen",
    );
    if (infoSeen === "true") {
      setHasSeenInfo(true);
    } else {
      // Auto-mark info as seen since Copilot provides guidance now
      setHasSeenInfo(true);
      localStorage.setItem("anti-inflammatory-menu-builder-info-seen", "true");
    }

    const dailyTotalsInfoSeen = localStorage.getItem(
      "anti-inflammatory-menu-builder-daily-totals-info-seen",
    );
    if (dailyTotalsInfoSeen === "true") {
      setHasSeenDailyTotalsInfo(true);
    }

    const savedStep = localStorage.getItem(
      "anti-inflammatory-menu-builder-tour-step",
    );
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
      planningMode === "day" && activeDayISO
        ? getDayLists(board, activeDayISO)
        : board.lists;

    // Check meal completion and advance tour
    if (tourStep === "breakfast" && lists.breakfast.length > 0) {
      setTourStep("lunch");
      localStorage.setItem("anti-inflammatory-menu-builder-tour-step", "lunch");

      // Show Daily Totals info after first meal
      if (!hasSeenDailyTotalsInfo) {
        setShowDailyTotalsInfo(true);
      }
    } else if (tourStep === "lunch" && lists.lunch.length > 0) {
      setTourStep("dinner");
      localStorage.setItem(
        "anti-inflammatory-menu-builder-tour-step",
        "dinner",
      );
    } else if (tourStep === "dinner" && lists.dinner.length > 0) {
      setTourStep("complete");
      localStorage.setItem(
        "anti-inflammatory-menu-builder-tour-step",
        "complete",
      );
    }
  }, [board, tourStep, planningMode, activeDayISO, hasSeenDailyTotalsInfo]);

  // Duplicate day handler
  const handleDuplicateDay = useCallback(
    async (targetDates: string[]) => {
      if (!board || !activeDayISO) return;
      
      // Guard: Check if any TARGET date is locked before allowing edits
      const lockedTarget = targetDates.find(d => isDayLocked(d, effectiveUserId));
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
          namespace,
          cacheUserId: proClientId || "2",
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
      queryKey: [
        "/api/users",
        effectiveUserId || "",
        "macros",
        "today",
      ],
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
    list: "breakfast" | "lunch" | "dinner" | "snacks",
    meal: Meal,
  ) {
    if (!board) return;
    
    // Guard: Check if day is locked before allowing edits
    if (checkLockedDay()) return;

    try {
      // In Day mode, add to the specific day. In Week mode, use legacy behavior
      if (
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
        setBoard(updatedBoard);
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

      window.dispatchEvent(new Event("macros:updated"));
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
          starchyCarbs: (meal as any).starchyCarbs ?? (meal.nutrition as any)?.starchyCarbs ?? 0,
          fibrousCarbs: (meal as any).fibrousCarbs ?? (meal.nutrition as any)?.fibrousCarbs ?? 0,
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
    <>
    <BuilderHeader
      title="Anti-Inflammatory Meal Builder"
      onOpenTour={quickTour.openTour}
      clientId={proClientId}
      protocols={[
        activePrimaryBadge,
        ...resolvedProtocol.modifierBadges,
      ].filter((b): b is { label: string; cls: string } => !!b)}
    />
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-20 overflow-x-hidden"
    >

      <TrialBanner />

      {readOnly && (
        <div className="mx-4 mt-2 px-4 py-3 rounded-xl bg-red-900/30 border border-red-500/40 flex items-center gap-3">
          <Lock className="h-4 w-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-200">
            Your meal board is managed by your professional. You can view your plan but cannot make changes.
          </p>
        </div>
      )}

      {/* Main Content */}
      <div
        className="max-w-[1600px] mx-auto px-4 space-y-6"
        style={{ paddingTop: contentPaddingTop }}
      >
        <NutritionBudgetBanner className="mb-2" userId={effectiveUserId} />
        <div className="mb-6 mt-2 border border-zinc-800 bg-zinc-900/60 backdrop-blur rounded-2xl mx-4">
          <div className="px-4 py-4 flex flex-col gap-3">
            {/* ROW 1: Week Dates (centered) */}
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
            {weekDatesList.length > 0 && (
              <div className="flex justify-center">
                <DayChips
                  weekDates={weekDatesList}
                  activeDayISO={activeDayISO}
                  onDayChange={setActiveDayISO}
                />
              </div>
            )}

            {/* ROW 4: Daily Starch Indicator */}
            {activeDayISO &&
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

            {/* ROW 4.5: Active Protocol Indicator */}
            <div className="flex justify-center">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 rounded-lg bg-zinc-800/50 text-xs">
                <span className="font-medium text-white/70">Active Protocol:</span>
                {[
                  { key: "heart-failure",    label: "Cardiac Health",   activeColor: "text-green-400",  dotColor: "bg-green-400",  dotGlow: "shadow-[0_0_4px_rgba(74,222,128,0.8)]"  },
                  { key: "kidney-disease",   label: "Kidney Disease",   activeColor: "text-green-400",  dotColor: "bg-green-400",  dotGlow: "shadow-[0_0_4px_rgba(74,222,128,0.8)]"  },
                  { key: "liver-support",    label: "Liver Support",    activeColor: "text-green-400",  dotColor: "bg-green-400",  dotGlow: "shadow-[0_0_4px_rgba(74,222,128,0.8)]"  },
                  { key: "liver-disease",    label: "Liver Disease",    activeColor: "text-green-400",  dotColor: "bg-green-400",  dotGlow: "shadow-[0_0_4px_rgba(74,222,128,0.8)]"  },
                  { key: "oncology-support", label: "Cancer Protocol",  activeColor: "text-pink-400",   dotColor: "bg-pink-400",   dotGlow: "shadow-[0_0_4px_rgba(244,114,182,0.9)]" },
                ].map(({ key, label, activeColor, dotColor, dotGlow }) => {
                  const isActive = clinicalModeState === key;
                  return (
                    <span
                      key={key}
                      className={`flex items-center gap-1 ${
                        isActive ? `${activeColor} font-semibold` : "text-white/25"
                      }`}
                    >
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full ${
                          isActive ? `${dotColor} ${dotGlow}` : "bg-white/15"
                        }`}
                      />
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* ROW 5: Bottom Actions */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">

              <div className="inline-flex flex-col items-center gap-1">
                <PillButton
                  onClick={handleSave}
                  disabled={saving || justSaved}
                  active={justSaved}
                  variant="emerald"
                  className="px-3 border-emerald-400/70"
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
                  className="px-3 border-sky-400/70"
                >
                  <Calendar className="h-3 w-3" />
                </PillButton>
                <span className="text-xs font-semibold text-white/70 tracking-wide">Duplicate</span>
              </div>

            </div>
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto px-4 pb-10 grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
          {/* Render day view or week view based on mode */}
          {planningMode === "day" &&
          activeDayISO &&
          board
            ? // DAY MODE: Meal 1/2/3, dynamic Meal 4+, Snacks
              (() => {
                const dayLists = getDayLists(board, activeDayISO);
                return (
                  <>
                    {lists.map(([key, label]) => (
                      <section key={key} data-meal-id={key} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur p-4">
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
                            <MealCard key={meal.id} date={activeDayISO} slot={key} meal={meal} showStarchBadge={true} builderType={clinicalModeState} data-wt="wmb-meal-card"
                              onUpdated={(m) => {
                                if (m === null) {
                                  if (meal.id.startsWith("ai-meal-")) clearAIMealsCache();
                                  const updatedDayLists = { ...dayLists, [key]: dayLists[key as keyof typeof dayLists].filter((e) => e.id !== meal.id) };
                                  const updatedBoard = setDayLists(board, activeDayISO, updatedDayLists);
                                  setBoard(updatedBoard);
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
                          <MealCard key={meal.id} date={activeDayISO} slot="snacks" meal={meal} showStarchBadge={true} builderType={clinicalModeState}
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
                <section key={key} data-meal-id={key} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-white/90 text-lg font-medium">{label}</h2>
                    <div className="flex gap-2">
                      <AddOwnMealButton slot={key as "breakfast"|"lunch"|"dinner"|"snacks"|"meal4"|"meal5"|"meal6"} onSave={(meal) => quickAdd(key as "breakfast"|"lunch"|"dinner"|"snacks"|"meal4"|"meal5"|"meal6", meal)} onImageReady={(mealId, imageUrl) => { setBoard(prev => { if (!prev) return prev; if (getMealImageUrl(prev, mealId) === imageUrl) return prev; const updated = updateMealImageInBoard(prev, mealId, imageUrl); saveBoard(updated).catch(() => {}); return updated; }); }} variant="icon" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    {board.lists[key].map((meal: Meal, idx: number) => (
                      <MealCard key={meal.id} date={"board"} slot={key} meal={meal} showStarchBadge={true} builderType={clinicalModeState}
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
          planningMode === "day" &&
          activeDayISO && (() => {
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
                calories: slots.breakfast.calories + slots.lunch.calories + slots.dinner.calories + slots.snacks.calories,
                protein: slots.breakfast.protein + slots.lunch.protein + slots.dinner.protein + slots.snacks.protein,
                carbs: slots.breakfast.carbs + slots.lunch.carbs + slots.dinner.carbs + slots.snacks.carbs,
                fat: slots.breakfast.fat + slots.lunch.fat + slots.dinner.fat + slots.snacks.fat,
                starchyCarbs: slots.breakfast.starchyCarbs + slots.lunch.starchyCarbs + slots.dinner.starchyCarbs + slots.snacks.starchyCarbs,
                fibrousCarbs: slots.breakfast.fibrousCarbs + slots.lunch.fibrousCarbs + slots.dinner.fibrousCarbs + slots.snacks.fibrousCarbs,
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
                        ? { calories: raw.calories, protein_g: raw.protein_g, carbs_g: raw.carbs_g, fat_g: raw.fat_g }
                        : { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
                      const result = await lockDay({
                        dateISO: activeDayISO,
                        targets,
                        consumed,
                        slots,
                      }, effectiveUserId);
                      
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
                          description: `${formatDateDisplay(activeDayISO, { weekday: 'long', month: 'short', day: 'numeric' })} has been locked.`,
                        });
                        setLocation('/my-biometrics');
                      }
                    }}
                  />
            </div>
          );
        })()}

        </div>

        {/* Bottom spacing to clear fixed shopping bar */}
        <div className="h-18" />

        {/* MealPickerDrawer handles ALL meal slots (breakfast, lunch, dinner, snacks) */}
        <MealPickerDrawer
          open={pickerOpen}
          list={pickerList}
          useAntiInflammatory={true}
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
        {(
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

        {/* Meal Premade Picker Modal */}
        <MealPremadePicker
          open={premadePickerOpen}
          onClose={() => setPremadePickerOpen(false)}
          mealType={premadePickerSlot}
          dietType={clinicalMode}
          onMealSelect={handlePremadeSelect}
        />

        {/* Create With Chef Modal - with clinical mode guardrails */}
        <CreateWithChefModal
          open={createWithChefOpen}
          onOpenChange={setCreateWithChefOpen}
          mealType={createWithChefSlot}
          onMealGenerated={handleChefMealGenerated}
          dietType={clinicalMode}
          starchContext={starchContext}
          remainingMacros={remainingMacrosForChef}
          builderMode="targeted"
        />

        {/* Snack Creator Modal (Phase 2 - craving to healthy snack) - with clinical mode guardrails */}
        <SnackCreatorModal
          open={snackCreatorOpen}
          onOpenChange={setSnackCreatorOpen}
          onSnackGenerated={handleSnackSelect}
          dietType={clinicalMode}
          starchContext={starchContext}
        />

        {/* Shopping bar */}
        <BuilderShoppingBar
          board={board}
          activeDayISO={activeDayISO}
          weekDatesList={weekDatesList}
          sourceSlug="anti-inflammatory-meal-board"
        />

      {/* Quick Tour Modal */}
      <QuickTourModal
        isOpen={quickTour.shouldShow}
        onClose={quickTour.closeTour}
        title="Anti-Inflammatory Builder Guide"
        steps={ANTI_INFLAMMATORY_TOUR_STEPS}
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
          return Math.max(0, (resolved.protein_g || 0) - Math.round(totals.protein));
        })()}
        carbsDeficit={(() => {
          const resolved = getResolvedTargets(effectiveUserId);
          return Math.max(0, (resolved.carbs_g || 0) - Math.round(totals.carbs));
        })()}
      />
      </div>
    </motion.div>
    </>
  );
}
