import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  Apple,
  ArrowLeft,
  Coffee,
  Cookie,
  Loader2,
  Settings2,
  Sparkles,
  Soup,
  UtensilsCrossed,
} from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { useCreateWithChefRequest } from "@/hooks/useCreateWithChefRequest";
import { useSnackCreatorRequest } from "@/hooks/useSnackCreatorRequest";
import {
  MealPlanDestinationPicker,
  type MealPlanDestination,
} from "@/components/MealPlanDestinationPicker";
import MealGenerationProgress from "@/components/MealGenerationProgress";

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
    builderType: meal.builderType,
  };
}

export default function MyPerfectMenu() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { activeProfile } = useHousehold();
  const subjectUserId = activeProfile?.id;
  const [ideaType, setIdeaType] = useState<IdeaType | null>(null);
  const [conceptSets, setConceptSets] = useState<ConceptSets>({});
  const [selectedConcept, setSelectedConcept] = useState<MenuConcept | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [savingMeal, setSavingMeal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subjectRef = useRef(subjectUserId ?? user?.id ?? null);
  const subjectEpochRef = useRef(0);
  const { generateMeal, cancel: cancelMeal } = useCreateWithChefRequest(user?.id, undefined, subjectUserId);
  const { generateSnack, cancel: cancelSnack } = useSnackCreatorRequest(user?.id, subjectUserId);
  const concepts = ideaType ? conceptSets[ideaType] ?? [] : [];

  useEffect(() => {
    subjectEpochRef.current += 1;
    subjectRef.current = subjectUserId ?? user?.id ?? null;
    cancelMeal();
    cancelSnack();
    setConceptSets({});
    setIdeaType(null);
    setLoadingIdeas(false);
    setSelectedConcept(null);
    setPickerOpen(false);
    let cancelled = false;
    const query = subjectUserId ? `?subjectUserId=${encodeURIComponent(subjectUserId)}` : "";
    fetch(apiUrl(`/api/my-perfect-menu/concepts${query}`), {
      credentials: "include",
      headers: getAuthHeaders(),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("We couldn't restore your menu ideas.");
        return response.json();
      })
      .then((payload) => {
        if (!cancelled) {
          const expectedSubject = subjectUserId ?? user?.id;
          if (payload.subject?.id && payload.subject.id !== expectedSubject) return;
          setConceptSets(payload.categories ?? {});
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "We couldn't restore your menu ideas.");
      });
    return () => { cancelled = true; };
  }, [subjectUserId, user?.id, cancelMeal, cancelSnack]);

  const requestIdeas = async (nextType: IdeaType) => {
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
        body: JSON.stringify({ ideaType: nextType, subjectUserId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "We couldn't create your ideas.");
      if (
        subjectEpochRef.current !== requestedEpoch ||
        subjectRef.current !== requestedSubject ||
        (payload.subject?.id && payload.subject.id !== requestedSubject)
      ) return;
      setConceptSets((current) => ({ ...current, [nextType]: payload.concepts || [] }));
    } catch (cause) {
      if (subjectEpochRef.current !== requestedEpoch || subjectRef.current !== requestedSubject) return;
      setError(cause instanceof Error ? cause.message : "We couldn't create your ideas.");
    } finally {
      if (subjectEpochRef.current === requestedEpoch && subjectRef.current === requestedSubject) {
        setLoadingIdeas(false);
      }
    }
  };

  const openCategory = (nextType: IdeaType) => {
    setIdeaType(nextType);
    setError(null);
    if (!conceptSets[nextType]?.length) requestIdeas(nextType);
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
        body: JSON.stringify({ ideaType: requestedType, subjectUserId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "We couldn't clear these ideas.");
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
    } catch (cause) {
      if (subjectEpochRef.current !== requestedEpoch || subjectRef.current !== requestedSubject) return;
      setError(cause instanceof Error ? cause.message : "We couldn't clear these ideas.");
    }
  };

  const chooseConcept = (concept: MenuConcept) => {
    setSelectedConcept(concept);
    setPickerOpen(true);
    setError(null);
  };

  const addCompletedMeal = async (destination: MealPlanDestination, meal: any) => {
    const response = await fetch(apiUrl("/api/weekly-board/add-meal"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({
        dateISO: destination.dateISO,
        slot: destination.slot,
        bt: destination.builderType,
        meal: completedMealPayload(meal),
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "The meal couldn't be added to your plan.");
    window.dispatchEvent(new CustomEvent("mpm:board-slot-added", {
      detail: {
        weekStartISO: result.weekStartISO,
        dateISO: result.dateISO,
        slot: result.slot,
        updatedDay: result.updatedDay,
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
      if (!response.ok) return meal;
      const payload = await response.json();
      return payload.meal || meal;
    } catch {
      return meal;
    }
  };

  const generateForDestination = async (destination: MealPlanDestination) => {
    if (!selectedConcept || savingMeal) return;
    setSavingMeal(true);
    setError(null);
    const requestedSubject = subjectRef.current;
    try {
      const conceptIntent = [
        "My Perfect Menu selected concept. Preserve this dish and cuisine identity.",
        `Title: ${selectedConcept.title}`,
        `Description: ${selectedConcept.description}`,
        selectedConcept.cuisine ? `Required cuisine: ${selectedConcept.cuisine}` : "",
        selectedConcept.primaryIngredients?.length
          ? `Concept ingredients: ${selectedConcept.primaryIngredients.join(", ")}`
          : "",
        selectedConcept.signature ? `Concept signature: ${selectedConcept.signature}` : "",
      ].filter(Boolean).join("\n");
      const meal = destination.slot === "snacks"
        ? await generateSnack(
            `${selectedConcept.title}. ${selectedConcept.description}`,
            "general-nutrition",
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
            `${selectedConcept.title}. ${selectedConcept.description}`,
            destination.slot,
            "general-nutrition",
            undefined,
            { dateISO: destination.dateISO } as any,
            undefined,
            true,
            undefined,
            false,
            undefined,
            undefined,
            "lifestyle",
            undefined,
            conceptIntent,
            undefined,
            1,
          );
      if (!meal) throw new Error("We couldn't finish this meal. Please choose it again.");
      if (subjectRef.current !== requestedSubject) throw new Error("The active food profile changed. Please choose the meal again.");
      const finalMeal = await finalizeMeal(meal, destination.slot === "snacks" ? "snack" : destination.slot);
      if (subjectRef.current !== requestedSubject) throw new Error("The active food profile changed. Please choose the meal again.");
      await addCompletedMeal(destination, finalMeal);
      setPickerOpen(false);
      window.dispatchEvent(new CustomEvent("show-toast", {
        detail: {
          title: "Your meal is ready",
          description: `${finalMeal.name || finalMeal.title} was added to your plan.`,
        },
      }));
      setLocation("/weekly-meal-board");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't finish this meal.");
      setPickerOpen(false);
    } finally {
      setSavingMeal(false);
    }
  };

  const activeType = IDEA_TYPES.find((item) => item.value === ideaType);

  return (
    <main className="min-h-100dvh overflow-y-auto bg-gradient-to-br from-black via-violet-950/80 to-black pb-safe-nav text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-28 top-20 h-80 w-80 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="absolute -right-28 top-[35rem] h-96 w-96 rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-5xl px-4 pb-28 pt-[calc(env(safe-area-inset-top)+1.5rem)] sm:px-8 sm:pt-10">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => ideaType ? (setIdeaType(null), setError(null)) : setLocation("/dashboard")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-black/45 px-4 text-sm font-semibold text-white/75">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button type="button" onClick={() => setLocation("/foods-i-enjoy/preferences")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-violet-300/25 bg-violet-400/10 px-4 text-sm font-semibold text-violet-100">
            <Settings2 className="h-4 w-4" /> Foods I Enjoy
          </button>
        </div>

        <header className="mt-5 rounded-[2rem] border border-violet-300/20 bg-black/55 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="flex items-center gap-3 text-violet-200">
            <div className="rounded-2xl border border-violet-300/30 bg-violet-400/15 p-3"><Sparkles className="h-6 w-6" /></div>
            <p className="text-xs font-black uppercase tracking-[0.22em]">Personalized for you</p>
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">My Perfect Menu</h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/65">
            Tell us what kind of food sounds good. We’ll give you three simple choices that fit your preferences and current plan.
          </p>
          {activeProfile && <p className="mt-3 text-sm font-semibold text-violet-200">Choosing for {activeProfile.displayName}</p>}
        </header>

        {!ideaType ? (
          <section className="mt-8">
            <h2 className="text-xl font-bold">What sounds good?</h2>
            <p className="mt-1 text-sm text-white/50">Choose a food style now. Pick the actual meal slot afterward.</p>
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
              </div>
               {!loadingIdeas && (
                 <div className="flex gap-2">
                   <button type="button" onClick={clearCategory} className="min-h-10 rounded-xl border border-red-300/20 bg-red-950/25 px-4 text-sm font-semibold text-red-100/75">Clear</button>
                   <button type="button" onClick={() => requestIdeas(ideaType)} className="min-h-10 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white/70">Try 3 More</button>
                 </div>
               )}
            </div>

            {loadingIdeas && concepts.length === 0 ? (
              <div className="mt-6 flex min-h-56 flex-col items-center justify-center rounded-3xl border border-violet-300/20 bg-black/45">
                <Loader2 className="h-8 w-8 animate-spin text-violet-300" />
                <p className="mt-4 font-semibold">Creating three ideas for you…</p>
                <p className="mt-1 text-sm text-white/45">Using your food preferences and current nutrition context.</p>
              </div>
            ) : (
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
            )}
            {loadingIdeas && concepts.length > 0 && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-violet-200">
                <Loader2 className="h-4 w-4 animate-spin" /> Creating three new ideas while these stay available…
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
    </main>
  );
}