import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import {
  Activity,
  Apple,
  ArrowLeft,
  Coffee,
  Cookie,
  Loader2,
  Sparkles,
  Soup,
  UtensilsCrossed,
} from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { handleDefinitiveAuthFailure, SESSION_EXPIRED_MESSAGE } from "@/lib/authRequired";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { useCreateWithChefRequest } from "@/hooks/useCreateWithChefRequest";
import { useSnackCreatorRequest } from "@/hooks/useSnackCreatorRequest";
import {
  MealPlanDestinationPicker,
  type MealPlanDestination,
} from "@/components/MealPlanDestinationPicker";
import MealGenerationProgress from "@/components/MealGenerationProgress";
import { CopilotBrain } from "@/components/copilot/CopilotBrain";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { useLogGlucose, type GlucoseContext } from "@/hooks/useDiabetes";
import { usePageTitle } from "@/contexts/PageTitleContext";
import GLP1MealPreflight from "@/components/glp1/GLP1MealPreflight";
import { glp1HubReturnTarget, shouldRequireGlp1MealPreflight } from "@/lib/glp1MenuFlow";
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
import type { MyPerfectMenuBuilderContext } from "@shared/builderNamespaces";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PerformanceNutritionSetupForm from "@/components/performance/PerformanceNutritionSetupForm";
import { getTodayISOSafe } from "@/utils/midnight";

type IdeaType = "breakfast" | "lunch" | "dinner" | "snack";

interface MenuConcept {
  id: string;
  ideaType: IdeaType;
  title: string;
  description: string;
  primaryIngredients?: string[];
  cuisine?: string;
  signature?: string;
}

type ConceptSets = Partial<Record<IdeaType, MenuConcept[]>>;
type MenuContextStatus = {
  subject: { id: string; label?: string | null };
  builder: MyPerfectMenuBuilderContext;
  diabetes: {
    applicable: boolean;
    state: "LOW" | "IN_RANGE" | "HIGH" | "STALE" | "NONE";
    needsRefresh: boolean;
    ageMinutes: number | null;
    criticalLow: boolean;
    criticalHigh: boolean;
  };
  glp1: {
    active: boolean;
    shouldEscalate: boolean;
    hasCurrentAdaptations: boolean;
  };
};

function responseError(response: Response, payload: any, fallback: string): Error {
  if (handleDefinitiveAuthFailure(response, payload)) {
    return new Error(SESSION_EXPIRED_MESSAGE);
  }
  return new Error(payload?.error || fallback);
}

const IDEA_TYPES: Array<{
  value: IdeaType;
  title: string;
  description: string;
  icon: typeof Coffee;
  color: string;
}> = [
  { value: "breakfast", title: "Breakfast Ideas", description: "Comforting, energizing ways to start any meal.", icon: Coffee, color: "from-amber-500/25 to-orange-950/20" },
  { value: "lunch", title: "Lunch Ideas", description: "Fresh, satisfying choices for any time of day.", icon: Soup, color: "from-emerald-500/25 to-emerald-950/20" },
  { value: "dinner", title: "Dinner Ideas", description: "Complete, flavorful meals without the decision fatigue.", icon: UtensilsCrossed, color: "from-violet-500/25 to-violet-950/20" },
  { value: "snack", title: "Snack Ideas", description: "Simple choices for when you need something smaller.", icon: Apple, color: "from-rose-500/25 to-rose-950/20" },
];

function completedMealPayload(meal: any) {
  return {
    id: meal.id,
    name: meal.name || meal.title,
    title: meal.name || meal.title,
    description: meal.description,
    imageUrl: meal.imageUrl,
    ingredients: meal.ingredients,
    instructions: meal.instructions,
    calories: meal.calories || meal.nutrition?.calories,
    protein: meal.protein || meal.nutrition?.protein,
    carbs: meal.carbs || meal.nutrition?.carbs,
    fat: meal.fat || meal.nutrition?.fat,
    starchyCarbs: meal.starchyCarbs ?? meal.nutrition?.starchyCarbs,
    fibrousCarbs: meal.fibrousCarbs ?? meal.nutrition?.fibrousCarbs,
    cookingTime: meal.cookingTime,
    difficulty: meal.difficulty,
    medicalBadges: meal.medicalBadges || [],
    dietClassification: meal.dietClassification,
    builderType: meal.builderType,
  };
}

export default function MyPerfectMenu() {
  usePageTitle("My Perfect Menu");
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { user } = useAuth();
  const { activeProfile } = useHousehold();
  const subjectUserId = activeProfile?.id;
  const requestedBuilderKey = useMemo(
    () => new URLSearchParams(search).get("builder") || undefined,
    [search],
  );
  const returnedIdeaType = useMemo(() => {
    const value = new URLSearchParams(search).get("category");
    return IDEA_TYPES.some((item) => item.value === value) ? value as IdeaType : null;
  }, [search]);
  const returnedSettingsChanged = useMemo(
    () => new URLSearchParams(search).get("glp1SettingsChanged") === "1",
    [search],
  );
  const [ideaType, setIdeaType] = useState<IdeaType | null>(null);
  const [conceptSets, setConceptSets] = useState<ConceptSets>({});
  const [selectedConcept, setSelectedConcept] = useState<MenuConcept | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [savingMeal, setSavingMeal] = useState(false);
  const [pendingIdeaType, setPendingIdeaType] = useState<IdeaType | null>(null);
  const [contextStatus, setContextStatus] = useState<MenuContextStatus | null>(null);
  const [builderContext, setBuilderContext] = useState<MyPerfectMenuBuilderContext | null>(null);
  const [glucoseValue, setGlucoseValue] = useState("");
  const [glucoseContext, setGlucoseContext] = useState<GlucoseContext>("PRE_MEAL");
  const [error, setError] = useState<string | null>(null);
  const [glp1CheckinOpen, setGlp1CheckinOpen] = useState(false);
  const [glp1ReturnNotice, setGlp1ReturnNotice] = useState<string | null>(null);
  const [tryMoreOpen, setTryMoreOpen] = useState(false);
  const [performanceDestination, setPerformanceDestination] = useState<MealPlanDestination | null>(null);
  const [performanceDate, setPerformanceDate] = useState(() => getTodayISOSafe("America/Chicago"));
  const [performanceSlot, setPerformanceSlot] = useState<MealPlanDestination["slot"] | null>(null);
  const [performanceSetupOpen, setPerformanceSetupOpen] = useState(false);
  const handledReturnRef = useRef(false);
  const subjectRef = useRef(subjectUserId ?? user?.id ?? null);
  const subjectEpochRef = useRef(0);
  const glp1PreflightEpochRef = useRef(-1);
  const { generateMeal, cancel: cancelMeal } = useCreateWithChefRequest(user?.id, undefined, subjectUserId);
  const { generateSnack, cancel: cancelSnack } = useSnackCreatorRequest(user?.id, subjectUserId);
  const logGlucose = useLogGlucose();
  const concepts = ideaType ? conceptSets[ideaType] ?? [] : [];

  useEffect(() => {
    subjectEpochRef.current += 1;
    glp1PreflightEpochRef.current = -1;
    subjectRef.current = subjectUserId ?? user?.id ?? null;
    cancelMeal();
    cancelSnack();
    setConceptSets({});
    setIdeaType(null);
    setLoadingIdeas(false);
    setLoadingContext(false);
    setPendingIdeaType(null);
    setContextStatus(null);
    setBuilderContext(null);
    setSelectedConcept(null);
    setPerformanceDestination(null);
    setPerformanceDate(getTodayISOSafe("America/Chicago"));
    setPerformanceSlot(null);
    setPerformanceSetupOpen(false);
    setPickerOpen(false);
    setTryMoreOpen(false);
    let cancelled = false;
    const params = new URLSearchParams();
    if (subjectUserId) params.set("subjectUserId", subjectUserId);
    if (requestedBuilderKey) params.set("requestedBuilderKey", requestedBuilderKey);
    const query = params.toString() ? `?${params.toString()}` : "";
    void (async () => {
      try {
        const builderResponse = await fetch(apiUrl(`/api/my-perfect-menu/effective-builder${query}`), {
          credentials: "include",
          headers: getAuthHeaders(),
        });
        const builderPayload = await builderResponse.json().catch(() => ({}));
        if (!builderResponse.ok) throw responseError(builderResponse, builderPayload, "We couldn't resolve your Menu Builder.");
        if (cancelled) return;
        const effectiveBuilder = builderPayload.builder as MyPerfectMenuBuilderContext;
        setBuilderContext(effectiveBuilder);
        if (effectiveBuilder.key === "performance_competition") return;

        const response = await fetch(apiUrl(`/api/my-perfect-menu/concepts${query}`), {
          credentials: "include",
          headers: getAuthHeaders(),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw responseError(response, payload, "We couldn't restore your menu ideas.");
        if (cancelled) return;
        const expectedSubject = subjectUserId ?? user?.id;
        if (payload.subject?.id && payload.subject.id !== expectedSubject) return;
        setConceptSets(payload.categories ?? {});
        if (payload.builder) setBuilderContext(payload.builder);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "We couldn't restore your menu ideas.");
      }
    })();
    return () => { cancelled = true; };
  }, [subjectUserId, user?.id, requestedBuilderKey, cancelMeal, cancelSnack]);

  const requestIdeas = async (nextType: IdeaType, destination = performanceDestination) => {
    const requestedSubject = subjectUserId ?? user?.id ?? null;
    const requestedEpoch = subjectEpochRef.current;
    setIdeaType(nextType);
    setError(null);
    setLoadingIdeas(true);
    try {
      const response = await fetch(apiUrl("/api/my-perfect-menu/concepts"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          ideaType: nextType,
          subjectUserId,
          requestedBuilderKey,
          ...(builderContext?.key === "performance_competition" && destination
            ? { destinationDate: destination.dateISO, mealSlot: destination.slot }
            : {}),
        }),
      });
      const payload = await response.json().catch(() => ({}));
       if (!response.ok) throw responseError(response, payload, "We couldn't create your ideas.");
      if (
        subjectEpochRef.current !== requestedEpoch ||
        subjectRef.current !== requestedSubject ||
        (payload.subject?.id && payload.subject.id !== requestedSubject)
      ) return;
      setConceptSets((current) => ({ ...current, [nextType]: payload.concepts || [] }));
      if (payload.builder) setBuilderContext(payload.builder);
    } catch (cause) {
      if (subjectEpochRef.current !== requestedEpoch || subjectRef.current !== requestedSubject) return;
      setError(cause instanceof Error ? cause.message : "We couldn't create your ideas.");
    } finally {
      if (subjectEpochRef.current === requestedEpoch && subjectRef.current === requestedSubject) {
        setLoadingIdeas(false);
      }
    }
  };

  const loadContextStatus = async (
    expectedEpoch = subjectEpochRef.current,
    expectedSubject = subjectUserId ?? user?.id ?? null,
    destination = performanceDestination,
  ): Promise<MenuContextStatus | null> => {
    const params = new URLSearchParams();
    if (subjectUserId) params.set("subjectUserId", subjectUserId);
    if (requestedBuilderKey) params.set("requestedBuilderKey", requestedBuilderKey);
    if (builderContext?.key === "performance_competition" && destination) {
      params.set("destinationDate", destination.dateISO);
      params.set("mealSlot", destination.slot);
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    const response = await fetch(apiUrl(`/api/my-perfect-menu/context-status${query}`), {
      credentials: "include",
      headers: getAuthHeaders(),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw responseError(response, payload, "We couldn't check the current food context.");
    if (
      subjectEpochRef.current !== expectedEpoch ||
      subjectRef.current !== expectedSubject ||
      (payload.subject?.id && payload.subject.id !== expectedSubject)
    ) return null;
    setContextStatus(payload);
    if (payload.builder) setBuilderContext(payload.builder);
    return payload;
  };

  const hasGlp1CheckinToday = async () => {
    const response = await fetch(apiUrl("/api/glp1/hub-checkin/today"), {
      credentials: "include",
      headers: getAuthHeaders(),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw responseError(response, payload, "We couldn't check today's GLP-1 status.");
    return Boolean(payload.checkin);
  };

  const prepareIdeaRequest = async (nextType: IdeaType, destination = performanceDestination) => {
    const requestedEpoch = subjectEpochRef.current;
    const requestedSubject = subjectUserId ?? user?.id ?? null;
    setIdeaType(nextType);
    setError(null);
    setLoadingContext(true);
    try {
      if (builderContext?.key === "performance_competition" && !destination) {
        setPendingIdeaType(nextType);
        return;
      }
      const status = await loadContextStatus(requestedEpoch, requestedSubject, destination);
      if (!status) return;
      if (status.glp1.shouldEscalate) {
        setPendingIdeaType(nextType);
        setError("Your current GLP-1 guidance needs attention before creating meal ideas. Review it in the GLP-1 Hub.");
        return;
      }
      const hasToday = status.glp1.active && !subjectUserId
        ? await hasGlp1CheckinToday()
        : false;
      if (subjectEpochRef.current !== requestedEpoch || subjectRef.current !== requestedSubject) return;
      if (shouldRequireGlp1MealPreflight(status.glp1, hasToday, Boolean(subjectUserId))) {
        glp1PreflightEpochRef.current = requestedEpoch;
        setPendingIdeaType(nextType);
        setGlp1CheckinOpen(true);
        return;
      }
      if (status.diabetes.applicable && status.diabetes.needsRefresh) {
        setPendingIdeaType(nextType);
        return;
      }
      setPendingIdeaType(null);
      await requestIdeas(nextType, destination);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't check the current food context.");
    } finally {
      setLoadingContext(false);
    }
  };

  const continueAfterGlp1Checkin = async () => {
    const expectedEpoch = glp1PreflightEpochRef.current;
    const expectedSubject = subjectRef.current;
    if (expectedEpoch < 0 || subjectEpochRef.current !== expectedEpoch) return;
    const status = await loadContextStatus(expectedEpoch, expectedSubject);
    if (!status) return;
    if (status.glp1.shouldEscalate) {
      setError("Your current GLP-1 guidance needs attention before creating meal ideas. Review the safety guidance in the GLP-1 Hub.");
      return;
    }
    const nextType = pendingIdeaType;
    setPendingIdeaType(null);
    if (nextType) await requestIdeas(nextType);
  };

  const openGlp1Settings = () => {
    const category = ideaType ?? pendingIdeaType;
    setLocation(`/glp1-hub?returnTo=${encodeURIComponent(glp1HubReturnTarget(category))}`);
  };

  useEffect(() => {
    if (!returnedIdeaType || handledReturnRef.current || !builderContext) return;
    handledReturnRef.current = true;
    setIdeaType(returnedIdeaType);
    if (returnedSettingsChanged) {
      setGlp1ReturnNotice(`Your GLP-1 settings changed, so we refreshed these ${returnedIdeaType} ideas.`);
      void prepareIdeaRequest(returnedIdeaType);
    }
  }, [returnedIdeaType, returnedSettingsChanged, builderContext]);

  const openCategory = (nextType: IdeaType) => {
    setIdeaType(nextType);
    setError(null);
    if (builderContext?.key === "performance_competition" && !performanceDestination) {
      setPendingIdeaType(nextType);
      return;
    }
    if (!conceptSets[nextType]?.length) void prepareIdeaRequest(nextType);
  };

  const startPerformanceIdeas = async () => {
    if (!ideaType || !performanceDate || !performanceSlot || !builderContext) return;
    const destination: MealPlanDestination = {
      dateISO: performanceDate,
      slot: performanceSlot,
      builderType: builderContext.namespace,
    };
    setPerformanceDestination(destination);
    setPendingIdeaType(null);
    await prepareIdeaRequest(ideaType, destination);
  };

  const saveGlucoseAndContinue = async () => {
    if (!pendingIdeaType || subjectUserId) return;
    const valueMgdl = Number(glucoseValue);
    if (!Number.isFinite(valueMgdl)) {
      setError("Enter your current blood glucose reading.");
      return;
    }
    setError(null);
    try {
      await logGlucose.mutateAsync({
        userId: user?.id,
        valueMgdl,
        context: glucoseContext,
      });
      setGlucoseValue("");
      const nextType = pendingIdeaType;
      setPendingIdeaType(null);
      await loadContextStatus();
      await requestIdeas(nextType);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't save your blood glucose reading.");
    }
  };

  const clearCategory = async () => {
    if (!ideaType || loadingIdeas) return;
    const requestedType = ideaType;
    const requestedSubject = subjectUserId ?? user?.id ?? null;
    const requestedEpoch = subjectEpochRef.current;
    setError(null);
    try {
      const response = await fetch(apiUrl("/api/my-perfect-menu/concepts"), {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ ideaType: requestedType, subjectUserId, requestedBuilderKey }),
      });
      const payload = await response.json().catch(() => ({}));
       if (!response.ok) throw responseError(response, payload, "We couldn't clear these ideas.");
      if (
        subjectEpochRef.current !== requestedEpoch ||
        subjectRef.current !== requestedSubject ||
        (payload.subject?.id && payload.subject.id !== requestedSubject)
      ) return;
      setConceptSets((current) => {
        const next = { ...current };
        delete next[requestedType];
        return next;
      });
      setIdeaType(null);
      setPendingIdeaType(null);
    } catch (cause) {
      if (subjectEpochRef.current !== requestedEpoch || subjectRef.current !== requestedSubject) return;
      setError(cause instanceof Error ? cause.message : "We couldn't clear these ideas.");
    }
  };

  const chooseConcept = (concept: MenuConcept) => {
    setSelectedConcept(concept);
    if (builderContext?.key === "performance_competition" && performanceDestination) {
      void generateForDestination(performanceDestination, concept);
      return;
    }
    setPickerOpen(true);
    setError(null);
  };

  const confirmTryMore = () => {
    if (!ideaType) return;
    setTryMoreOpen(false);
    void prepareIdeaRequest(ideaType);
  };

  const addCompletedMeal = async (
    destination: MealPlanDestination,
    meal: any,
    resolvedBuilder: MyPerfectMenuBuilderContext,
  ) => {
    const response = await fetch(apiUrl("/api/weekly-board/add-meal"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({
        dateISO: destination.dateISO,
        slot: destination.slot,
        mpmBuilderKey: resolvedBuilder.key,
        householdProfileId: subjectUserId,
        meal: completedMealPayload(meal),
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw responseError(response, result, "The meal couldn't be added to your plan.");
    window.dispatchEvent(new CustomEvent("mpm:board-slot-added", {
      detail: {
        weekStartISO: result.weekStartISO,
        dateISO: result.dateISO,
        slot: result.slot,
        updatedDay: result.updatedDay,
        boardNamespace: result.boardNamespace,
      },
    }));
  };

  const finalizeMeal = async (meal: any, mealType: string) => {
    try {
      const response = await fetch(apiUrl("/api/meals/finalize"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ meal, mealType }),
      });
       const payload = await response.json().catch(() => ({}));
       if (!response.ok) {
         if (handleDefinitiveAuthFailure(response, payload)) throw new Error(SESSION_EXPIRED_MESSAGE);
         return meal;
       }
      return payload.meal || meal;
    } catch {
      return meal;
    }
  };

  const generateForDestination = async (destination: MealPlanDestination, selectedConceptOverride?: MenuConcept) => {
    const conceptToGenerate = selectedConceptOverride ?? selectedConcept;
    if (!conceptToGenerate || savingMeal) return;
    setSavingMeal(true);
    setError(null);
    const requestedSubject = subjectRef.current;
    try {
      const validationResponse = await fetch(apiUrl("/api/my-perfect-menu/validate-selection"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          ideaType: conceptToGenerate.ideaType,
          conceptId: conceptToGenerate.id,
          subjectUserId,
          requestedBuilderKey,
          destinationDate: destination.dateISO,
          mealSlot: destination.slot,
        }),
      });
      const validationPayload = await validationResponse.json().catch(() => ({}));
      if (!validationResponse.ok) {
        if (validationResponse.status === 409 && validationPayload?.code === "MY_PERFECT_MENU_CONTEXT_STALE") {
          setConceptSets((current) => {
            const next = { ...current };
            delete next[conceptToGenerate.ideaType];
            return next;
          });
          setSelectedConcept(null);
          setIdeaType(null);
        }
        throw responseError(
          validationResponse,
          validationPayload,
          "Your food context changed. Refresh your choices before creating this meal.",
        );
      }
      const resolvedBuilder = validationPayload.builder as MyPerfectMenuBuilderContext | undefined;
      if (!resolvedBuilder) throw new Error("We couldn't resolve the assigned Meal Builder. Please try again.");
      const performance = validationPayload.performance as any;
      const performanceAuthorityToken = validationPayload.performanceAuthorityToken as string | null;
      setBuilderContext(resolvedBuilder);
      const conceptIntent = [
        "My Perfect Menu selected concept. Preserve this dish and cuisine identity.",
        `Resolved builder: ${resolvedBuilder.key}. Use its established generation contract.`,
        `Title: ${conceptToGenerate.title}`,
        `Description: ${conceptToGenerate.description}`,
        conceptToGenerate.cuisine ? `Required cuisine: ${conceptToGenerate.cuisine}` : "",
        conceptToGenerate.primaryIngredients?.length
          ? `Concept ingredients: ${conceptToGenerate.primaryIngredients.join(", ")}`
          : "",
        conceptToGenerate.signature ? `Concept signature: ${conceptToGenerate.signature}` : "",
        performance
          ? `Performance authority: ${performance.dateISO} ${performance.slot}; ${performance.sessionLabel || performance.sessionType || "scheduled session"}; remaining ${performance.nutrition.remaining.calories} kcal, ${performance.nutrition.remaining.protein}g protein, ${performance.nutrition.remaining.carbs}g carbs, ${performance.nutrition.remaining.fat}g fat, ${performance.nutrition.remaining.starchyCarbs}g starchy carbs.`
          : "",
      ].filter(Boolean).join("\n");
      const performanceStarchContext = performance ? {
        strategy: "flex" as const,
        starchMealsAllowed: performance.nutrition.remaining.starchMealsRemaining,
        starchyCarbsRemaining: performance.nutrition.remaining.starchyCarbs,
        gramsPerRemainingStarchMeal: performance.nutrition.starch.gramsPerRemainingMeal ?? undefined,
        distributionStrategy: performance.nutrition.starch.distributionStrategy,
        isZeroStarchDay: performance.nutrition.starch.isZeroStarchDay,
        dateISO: performance.dateISO,
      } : undefined;
      const performanceSessionContext = performance ? {
        sessionType: performance.sessionType || "off",
        sessionLabel: performance.sessionLabel || performance.sessionType || "Rest day",
        reasoning: `Server-resolved Performance prescription for ${performance.dateISO} and ${performance.slot}.`,
        starchyCarbs_g: performance.nutrition.targets.starchyCarbs,
        fibrousCarbs_g: performance.nutrition.targets.fibrousCarbs,
      } : undefined;
      const meal = destination.slot === "snacks" && !performance
        ? await generateSnack(
            `${conceptToGenerate.title}. ${conceptToGenerate.description}`,
            resolvedBuilder.dietType,
            undefined,
            undefined,
            undefined,
            true,
            undefined,
            false,
            destination.dateISO,
            conceptIntent,
          )
        : await generateMeal(
            `${conceptToGenerate.title}. ${conceptToGenerate.description}`,
            destination.slot === "snacks" ? "snack" : destination.slot,
            resolvedBuilder.dietType,
            undefined,
            performanceStarchContext ?? ({ dateISO: destination.dateISO } as any),
            undefined,
            true,
            undefined,
            false,
            undefined,
            performance?.nutrition.remaining,
            resolvedBuilder.builderMode,
            performanceSessionContext,
            conceptIntent,
            undefined,
            1,
            performanceAuthorityToken ?? undefined,
            resolvedBuilder.key === "performance_competition" ? conceptToGenerate.id : undefined,
            resolvedBuilder.key === "performance_competition",
          );
      if (!meal) throw new Error("We couldn't finish this meal. Please choose it again.");
      if (subjectRef.current !== requestedSubject) throw new Error("The active food profile changed. Please choose the meal again.");
      const finalMeal = await finalizeMeal(meal, destination.slot === "snacks" ? "snack" : destination.slot);
      if (subjectRef.current !== requestedSubject) throw new Error("The active food profile changed. Please choose the meal again.");
      await addCompletedMeal(destination, finalMeal, resolvedBuilder);
      setPickerOpen(false);
      window.dispatchEvent(new CustomEvent("show-toast", {
        detail: {
          title: "Your meal is ready",
          description: `${finalMeal.name || finalMeal.title} was added to your plan.`,
        },
      }));
      const routeParams = new URLSearchParams();
      if (subjectUserId) routeParams.set("householdProfileId", subjectUserId);
      if (resolvedBuilder.key === "performance_competition") {
        routeParams.set("destinationDate", destination.dateISO);
        routeParams.set("destinationSlot", destination.slot);
      }
      const routeQuery = routeParams.toString();
      setLocation(`${resolvedBuilder.route}${routeQuery ? `?${routeQuery}` : ""}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't finish this meal.");
      setPickerOpen(false);
    } finally {
      setSavingMeal(false);
    }
  };

  const activeType = IDEA_TYPES.find((item) => item.value === ideaType);
  const handleBack = () => {
    if (ideaType) {
      setIdeaType(null);
      setError(null);
      setPendingIdeaType(null);
      return;
    }
    setLocation("/dashboard");
  };

  return (
    <main className="min-h-100dvh overflow-y-auto bg-gradient-to-br from-black via-violet-950/80 to-black pb-safe-nav text-white">
      <CopilotBrain
        screenId="MY_PERFECT_MENU"
        persona="default"
        tags={["personalized-menu", "three-choices", ideaType ?? "choose-category"]}
      />
      <MobileHeaderGuard>
        <div
          className="fixed inset-x-0 top-0 z-50 border-b border-violet-300/20 bg-black/80 backdrop-blur-xl"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="flex min-h-14 items-center gap-3 px-4">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/80"
              aria-label={ideaType ? "Back to menu categories" : "Back to dashboard"}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Sparkles className="h-5 w-5 text-violet-300" />
            <p className="text-base font-black tracking-tight">My Perfect Menu</p>
          </div>
        </div>
      </MobileHeaderGuard>
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-28 top-20 h-80 w-80 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="absolute -right-28 top-[35rem] h-96 w-96 rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-5xl px-4 pb-28 pt-[calc(env(safe-area-inset-top,0px)+5rem)] sm:px-8 lg:pt-10">
        <div className="flex items-center gap-3">
          <button type="button" onClick={handleBack} className="hidden min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-black/45 px-4 text-sm font-semibold text-white/75 lg:inline-flex">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>

        <header className="mt-5 rounded-[2rem] border border-violet-300/20 bg-black/55 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="flex items-center gap-3 text-violet-200">
            <div className="rounded-2xl border border-violet-300/30 bg-violet-400/15 p-3"><Sparkles className="h-6 w-6" /></div>
            <p className="text-xs font-black uppercase tracking-[0.22em]">Personalized for you</p>
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">My Perfect Menu</h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/65">
            Not sure what to eat? Pick a meal and we’ll give you 3 personalized ideas.
          </p>
          {builderContext?.displayName && (
            <div className="mt-4 inline-flex items-center rounded-full border border-violet-300/25 bg-violet-400/10 px-3 py-1.5 text-xs font-bold text-violet-100">
              Using your {builderContext.displayName}
            </div>
          )}
          {activeProfile && <p className="mt-3 text-sm font-semibold text-violet-200">Choosing for {activeProfile.displayName}</p>}
          {builderContext?.key === "performance_competition" && (
            <button type="button" onClick={() => setPerformanceSetupOpen(true)} className="mt-3 block text-xs font-semibold text-orange-200 underline-offset-2 hover:underline">
              Edit Performance setup
            </button>
          )}
        </header>

        <details className="group mt-4 rounded-2xl border border-white/15 bg-black/45 px-5 py-4 shadow-xl backdrop-blur-xl">
          <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-violet-100 [&::-webkit-details-marker]:hidden">
            <span>How It Works</span>
            <span className="text-lg leading-none text-violet-300 transition-transform group-open:rotate-45" aria-hidden="true">+</span>
          </summary>
          <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
            {[
              ["1. Pick an idea type", "Choose Breakfast, Lunch, Dinner, or Snack."],
              ["2. Pick what sounds good", "Choose from 3 personalized ideas. Don’t see one you want? Try 3 More."],
              ["3. Choose when you want it", "Pick a date and Meal 1–6 or Snack."],
              ["4. We’ll create it for you", "My Perfect Meals creates the completed meal and adds it to your meal plan."],
            ].map(([title, description]) => (
              <div key={title} className="rounded-xl bg-white/[0.04] p-3">
                <p className="text-sm font-bold text-white">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/55">{description}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-white/50">
            Breakfast, Lunch, and Dinner describe the kind of food you’re looking for. Meal 1–6 is simply where you want it placed in your plan.
          </p>
        </details>

        {!ideaType ? (
          <section className="mt-8">
            <h2 className="text-xl font-bold">What sounds good?</h2>
             <p className="mt-1 text-sm text-white/50">
               {builderContext?.key === "performance_competition"
                 ? "Choose the day and intended meal slot first so your Performance prescription guides the ideas."
                 : "Choose a food style now. Pick the actual meal slot afterward."}
             </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {IDEA_TYPES.map(({ value, title, description, icon: Icon, color }) => (
                <button key={value} type="button" onClick={() => openCategory(value)} className={`group rounded-2xl border border-white/15 bg-gradient-to-br ${color} p-5 text-left shadow-xl backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-violet-300/45`}>
                  <div className="flex items-center gap-4">
                    <div className="rounded-xl border border-white/15 bg-black/35 p-3"><Icon className="h-6 w-6 text-white/85" /></div>
                    <div><h3 className="font-bold text-white">{title}</h3><p className="mt-1 text-sm text-white/55">{description}</p></div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">Three choices</p>
                <h2 className="mt-1 text-2xl font-black">{activeType?.title}</h2>
                 {builderContext?.key === "performance_competition" && performanceDestination && (
                   <p className="mt-2 text-xs font-semibold text-orange-200">
                     For {performanceDestination.dateISO} · {performanceDestination.slot}
                   </p>
                 )}
              </div>
               {!loadingIdeas && (
                 <div className="flex gap-2">
                    {builderContext?.key === "performance_competition" && (
                      <button
                        type="button"
                        onClick={() => {
                          setConceptSets((current) => ({ ...current, [ideaType!]: [] }));
                          setPerformanceDestination(null);
                          setPendingIdeaType(ideaType);
                          setSelectedConcept(null);
                        }}
                        className="min-h-10 rounded-xl border border-orange-300/20 bg-orange-950/25 px-4 text-sm font-semibold text-orange-100/80"
                      >
                        Change date or slot
                      </button>
                    )}
                   <button type="button" onClick={clearCategory} className="min-h-10 rounded-xl border border-red-300/20 bg-red-950/25 px-4 text-sm font-semibold text-red-100/75">Clear</button>
                    <button type="button" onClick={() => setTryMoreOpen(true)} className="min-h-10 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white/70">Try 3 More</button>
                 </div>
               )}
            </div>

            {!loadingContext && concepts.length > 0 && (
              <div className="mt-4 rounded-2xl border border-violet-300/20 bg-violet-950/20 p-4">
                <p className="text-sm font-bold text-violet-100">Want to explore more than one?</p>
                <p className="mt-1 text-sm leading-relaxed text-white/60">
                  Choose an idea to create the full meal. If you like the finished meal, save it to Favorites before replacing or deleting it from your plan. You can return here to try another of these ideas.
                </p>
              </div>
            )}

             {builderContext?.key === "performance_competition" && pendingIdeaType && !performanceDestination && (
               <div className="mt-5 rounded-3xl border border-orange-300/25 bg-orange-950/25 p-5">
                 <h3 className="font-black text-white">When are you planning this meal?</h3>
                 <p className="mt-1 text-sm text-white/60">Your Performance Builder can change fuel and starch guidance by day and meal slot.</p>
                 <div className="mt-4 grid gap-3 sm:grid-cols-2">
                   <label className="text-xs font-bold text-white/70">
                     Date
                     <input
                       type="date"
                        value={performanceDate}
                        onChange={(event) => setPerformanceDate(event.target.value)}
                       className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-black/45 px-3 text-sm text-white"
                     />
                   </label>
                   <label className="text-xs font-bold text-white/70">
                     Intended meal slot
                     <select
                        value={performanceSlot ?? ""}
                        onChange={(event) => setPerformanceSlot(event.target.value as MealPlanDestination["slot"])}
                       className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-black/45 px-3 text-sm text-white"
                     >
                       <option value="" disabled>Select a slot</option>
                       <option value="breakfast">Meal 1</option>
                       <option value="lunch">Meal 2</option>
                       <option value="dinner">Meal 3</option>
                       <option value="meal4">Meal 4</option>
                       <option value="meal5">Meal 5</option>
                       <option value="meal6">Meal 6</option>
                       <option value="snacks">Snack</option>
                     </select>
                   </label>
                 </div>
                  <button type="button" disabled={!performanceDate || !performanceSlot} onClick={() => void startPerformanceIdeas()} className="mt-4 min-h-11 rounded-xl bg-orange-600 px-4 text-sm font-black text-white disabled:opacity-40">
                   Use this Performance prescription
                 </button>
               </div>
             )}

            {loadingContext && (
              <div className="mt-6 flex min-h-32 flex-col items-center justify-center rounded-3xl border border-violet-300/20 bg-black/45">
                <Loader2 className="h-7 w-7 animate-spin text-violet-300" />
                <p className="mt-3 text-sm font-semibold">Checking your current food context…</p>
              </div>
            )}

            {!loadingContext && pendingIdeaType && contextStatus?.diabetes.applicable && contextStatus.diabetes.needsRefresh && !subjectUserId && (
              <div className="mt-6 rounded-3xl border border-sky-300/25 bg-sky-950/25 p-5">
                <div className="flex items-start gap-3">
                  <Activity className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />
                  <div>
                    <h3 className="font-black text-white">Update Blood Glucose</h3>
                    <p className="mt-1 text-sm leading-relaxed text-white/65">
                      Your latest reading is {contextStatus.diabetes.state === "STALE" ? "older than the current freshness window" : "not available"}.
                      You can update it here using the same history as the Diabetes Hub, or continue with the information currently available.
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <label className="text-xs font-bold text-white/70">
                    Blood glucose (mg/dL)
                    <input
                      type="number"
                      inputMode="numeric"
                      min="20"
                      max="600"
                      value={glucoseValue}
                      onChange={(event) => setGlucoseValue(event.target.value)}
                      className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-black/45 px-3 text-base text-white outline-none focus:border-sky-300/60"
                    />
                  </label>
                  <label className="text-xs font-bold text-white/70">
                    Reading context
                    <select
                      value={glucoseContext}
                      onChange={(event) => setGlucoseContext(event.target.value as GlucoseContext)}
                      className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-black/45 px-3 text-sm text-white outline-none focus:border-sky-300/60"
                    >
                      <option value="FASTED">Fasted</option>
                      <option value="PRE_MEAL">Before meal</option>
                      <option value="POST_MEAL_1H">1 hour after meal</option>
                      <option value="POST_MEAL_2H">2 hours after meal</option>
                      <option value="RANDOM">Other time</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => void saveGlucoseAndContinue()}
                    disabled={logGlucose.isPending}
                    className="min-h-11 self-end rounded-xl bg-sky-500 px-4 text-sm font-black text-white disabled:opacity-60"
                  >
                    {logGlucose.isPending ? "Saving…" : "Save & Continue"}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const nextType = pendingIdeaType;
                      setPendingIdeaType(null);
                      void requestIdeas(nextType);
                    }}
                    className="min-h-10 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white/75"
                  >
                    Continue with available information
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocation("/diabetic-hub?returnTo=%2Ffoods-i-enjoy%3Fbuilder%3Ddiabetic")}
                    className="min-h-10 rounded-xl px-3 text-sm font-semibold text-sky-200"
                  >
                    Open Diabetes Hub
                  </button>
                </div>
              </div>
            )}

            {!loadingContext && contextStatus?.diabetes.applicable && !contextStatus.diabetes.needsRefresh && (
              <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-950/20 px-4 py-3 text-sm font-semibold text-emerald-100">
                Using your current diabetes settings
              </div>
            )}

            {!loadingContext && (contextStatus?.glp1.active || builderContext?.key === "glp1") && !subjectUserId && (
              <>
                {glp1ReturnNotice && (
                  <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-950/20 px-4 py-3 text-sm font-semibold text-emerald-100">
                    {glp1ReturnNotice}
                  </div>
                )}
                <GLP1MealPreflight
                  open={glp1CheckinOpen}
                  onOpenChange={(open) => {
                    setGlp1CheckinOpen(open);
                    if (open && ideaType) {
                      glp1PreflightEpochRef.current = subjectEpochRef.current;
                      setPendingIdeaType(ideaType);
                    }
                    if (!open) setPendingIdeaType(null);
                  }}
                  onSaved={continueAfterGlp1Checkin}
                  onOpenSettings={openGlp1Settings}
                />
              </>
            )}

            {!loadingContext && !pendingIdeaType && loadingIdeas && concepts.length === 0 ? (
              <div className="mt-6 flex min-h-56 flex-col items-center justify-center rounded-3xl border border-violet-300/20 bg-black/45">
                <Loader2 className="h-8 w-8 animate-spin text-violet-300" />
                <p className="mt-4 font-semibold">Creating three ideas for you…</p>
                <p className="mt-1 text-sm text-white/45">Using your food preferences and current nutrition context.</p>
              </div>
            ) : !loadingContext && !pendingIdeaType ? (
              <div className="mt-5 grid gap-4">
                {concepts.map((concept, index) => (
                  <article key={concept.id} className="overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-r from-black via-violet-950/35 to-black shadow-2xl">
                    <div className="flex gap-4 p-5 sm:p-6">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-300/25 bg-violet-400/15 text-lg font-black text-violet-200">{index + 1}</div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-black text-white">{concept.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-white/60">{concept.description}</p>
                        <button type="button" onClick={() => chooseConcept(concept)} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-500 px-5 text-sm font-black text-white shadow-lg shadow-violet-950/50 transition-all hover:bg-violet-400">
                          Choose This
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
            {loadingIdeas && concepts.length > 0 && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-violet-200">
                <Loader2 className="h-4 w-4 animate-spin" /> Creating three new ideas to replace these choices…
              </div>
            )}
          </section>
        )}

        {error && <div role="alert" className="mt-5 rounded-2xl border border-red-300/25 bg-red-950/45 p-4 text-sm font-semibold text-red-100">{error}</div>}
        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/50">
          <Cookie className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
          <p>These are simple ideas, not full recipes yet. Your complete meal is created only after you choose where it belongs in your plan.</p>
        </div>
      </div>

      {selectedConcept && (
        <MealPlanDestinationPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          title={selectedConcept.title}
          busy={savingMeal}
          builderKey={builderContext?.key}
          householdProfileId={subjectUserId}
          busyContent={
            <MealGenerationProgress
              active={savingMeal}
              context="general"
              mode="single"
              intervalMs={4000}
            />
          }
          onSelect={generateForDestination}
        />
      )}

      <AlertDialog open={tryMoreOpen} onOpenChange={setTryMoreOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Try 3 new ideas?</AlertDialogTitle>
            <AlertDialogDescription>
              These three ideas will be replaced with three new personalized choices. If you already created a meal you want to keep, save the finished meal to Favorites first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep These Ideas</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTryMore}>Replace with 3 New Ideas</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={performanceSetupOpen} onOpenChange={setPerformanceSetupOpen}>
        <DialogContent className="max-h-[90vh] overflow-hidden border-orange-300/20 bg-black/95 p-0 text-white sm:max-w-2xl">
          <DialogHeader className="border-b border-white/10 px-5 py-4">
            <DialogTitle className="text-white">Performance setup</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-5rem)] overflow-y-auto">
            <PerformanceNutritionSetupForm
              embedded
              onCancel={() => setPerformanceSetupOpen(false)}
              onSave={async () => {
                setPerformanceSetupOpen(false);
                const params = subjectUserId ? `?subjectUserId=${encodeURIComponent(subjectUserId)}` : "";
                const response = await fetch(apiUrl(`/api/my-perfect-menu/effective-builder${params}`), {
                  credentials: "include",
                  headers: getAuthHeaders(),
                });
                if (response.ok) {
                  const payload = await response.json();
                  if (payload.builder) setBuilderContext(payload.builder);
                }
                window.dispatchEvent(new CustomEvent("mpm:builderUpdated"));
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}