
import React, { useEffect, useMemo, useState, useImperativeHandle, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, BarChart3, ShoppingCart, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MacroBridgeFooter } from "@/components/biometrics/MacroBridgeFooter";
import { get, post, patch } from "@/lib/api";
import TrashButton from "@/components/ui/TrashButton";

/** ---------- Types ---------- */
type Meal = {
  id: string;
  name: string;
  servings?: number;
  ingredients?: Array<
    | string
    | { name: string; quantity?: number | string; unit?: string; item?: string; amount?: number | string }
  >;
  instructions?: string[];
  nutrition?: { calories?: number; protein?: number; carbs?: number; fat?: number } | null;
};

type PlanDay = {
  dayIndex: number;
  lists: { breakfast: Meal[]; lunch: Meal[]; dinner: Meal[]; snacks: Meal[] };
  totals?: { calories: number; protein: number; carbs: number; fat: number };
};

type BuilderPlanJSON = {
  source: "diabetic" | "smart" | "specialty" | "medical" | "glp1" | "clinical";
  days: PlanDay[];
  createdAtISO: string;
  targets?: { calories?: number; protein?: number; carbs?: number; fat?: number };
};

type DraftPlan = { days: PlanDay[]; createdAtISO?: string };

async function apiGetActivePlan(key: string) {
  return get<{ plan: BuilderPlanJSON | null; days: number }>(`/api/builders/${key}/plan`);
}

async function apiSavePlan(key: string, plan: BuilderPlanJSON, days: number) {
  return post(`/api/builders/${key}/plan`, { plan, days });
}

async function apiPatchPlan(key: string, plan: BuilderPlanJSON) {
  return patch(`/api/builders/${key}/plan`, { plan });
}

/** ---------- Helpers ---------- */
function computeDayTotals(day: PlanDay) {
  const all = [
    ...day.lists.breakfast,
    ...day.lists.lunch,
    ...day.lists.dinner,
    ...day.lists.snacks,
  ];
  return all.reduce(
    (acc, m) => {
      const n = m?.nutrition || {};
      acc.calories += Number(n.calories ?? 0);
      acc.protein += Number(n.protein ?? 0);
      acc.carbs += Number(n.carbs ?? 0);
      acc.fat += Number(n.fat ?? 0);
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

function normalizeIng(ing: any) {
  if (typeof ing === "string") {
    return { name: ing, quantity: "1", unit: "" };
  }
  return {
    name: ing?.name || ing?.item || "Ingredient",
    quantity: String(ing?.quantity ?? ing?.amount ?? "1"),
    unit: ing?.unit ?? "",
  };
}

async function logDayToMacros(day: PlanDay) {
  const all = [
    ...day.lists.breakfast,
    ...day.lists.lunch,
    ...day.lists.dinner,
    ...day.lists.snacks,
  ];
  let ok = 0;
  for (const meal of all) {
    const entry = {
      mealName: meal.name || "Meal",
      calories: Number(meal.nutrition?.calories ?? 0),
      protein: Number(meal.nutrition?.protein ?? 0),
      carbs: Number(meal.nutrition?.carbs ?? 0),
      fat: Number(meal.nutrition?.fat ?? 0),
      starchyCarbs: Number((meal as any).starchyCarbs ?? (meal.nutrition as any)?.starchyCarbs ?? 0),
      fibrousCarbs: Number((meal as any).fibrousCarbs ?? (meal.nutrition as any)?.fibrousCarbs ?? 0),
      servings: Number(meal.servings ?? 1),
      source: "builder-day-board",
    };
    const { post } = await import("@/lib/api");
    try {
      await post("/api/macros/log", entry);
      ok++;
    } catch (error) {
      console.error("Failed to log meal:", error);
    }
  }
  try {
    window.dispatchEvent(new Event("macros:updated"));
  } catch {}
  return ok;
}

async function sendDayToShopping(day: PlanDay) {
  const items = [
    ...day.lists.breakfast,
    ...day.lists.lunch,
    ...day.lists.dinner,
    ...day.lists.snacks,
  ]
    .flatMap((m) => m.ingredients || [])
    .map(normalizeIng);

  if (items.length === 0) return 0;

  const { post } = await import("@/lib/api");
  await post("/api/shopping-list", { items });
  return items.length;
}

/** ---------- Small meal chip ---------- */
function MealChip({
  meal,
  onDelete,
}: {
  meal: Meal;
  onDelete?: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/15 bg-white/5 px-3 py-2">
      <div className="min-w-0">
        <div className="text-sm text-white/90 truncate">{meal.name || "Meal"}</div>
        {meal.nutrition && (
          <div className="text-[11px] text-white/60">
            {meal.nutrition.calories ?? 0} kcal • {meal.nutrition.protein ?? 0}g P •{" "}
            {meal.nutrition.carbs ?? 0}g C • {meal.nutrition.fat ?? 0}g F
          </div>
        )}
      </div>
      {onDelete && (
        <TrashButton
          size="sm"
          onClick={onDelete}
          ariaLabel="Remove meal"
          title="Remove meal"
          confirm
          confirmMessage="Remove this meal from the plan?"
          className="ml-2"
        />
      )}
    </div>
  );
}

/** ---------- The shared board ---------- */
export interface BuilderDayBoardRef {
  sendActiveToMacros: () => Promise<void>;
  sendActiveToShopping: () => Promise<void>;
  getActiveDay: () => PlanDay | null;
}

const BuilderDayBoard = forwardRef<BuilderDayBoardRef, {
  builderKey: "diabetic" | "smart" | "specialty" | "medical" | "glp1" | "clinical";
  draft?: DraftPlan | null;
  draftLabel?: string;
  header?: string;
}>(({
  builderKey,
  draft,
  draftLabel = "Save Generated Plan",
  header = "Your Builder Plan",
}, ref) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<BuilderPlanJSON | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  async function load(resetIdx = true) {
    setLoading(true);
    try {
      const { plan } = await apiGetActivePlan(builderKey);
      setPlan(plan ?? null);
      if (resetIdx) {
        setActiveIdx(0);
      }
    } catch (error) {
      // Normalize
      const anyErr = error as any;
      const status = anyErr?.status ?? anyErr?.response?.status;
      const isHttpNotModified = status === 304;
      const isHttpOk = status >= 200 && status < 300;

      const hasMessage = typeof anyErr?.message === "string" && anyErr.message.length > 0;
      const isErrorObj = error instanceof Error;
      const isNonEmptyObject =
        anyErr && typeof anyErr === "object" && Object.keys(anyErr).length > 0;

      const isRealError = !isHttpNotModified && !isHttpOk && (isErrorObj || hasMessage || isNonEmptyObject);

      if (isRealError) {
        // Log richly without relying on JSON.stringify equality
        try {
          console.error("Failed to load builder plan:", anyErr, JSON.stringify(anyErr, null, 2));
        } catch {
          console.error("Failed to load builder plan:", anyErr);
        }

        setPlan(null);
        toast({
          title: "Load Failed",
          description: "Could not load your plan. Please refresh the page.",
          variant: "destructive",
        });
      }
      // Quiet: 304/OK/noise during hot reload
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [builderKey]);

  const days = plan?.days ?? [];
  const activeDay = days[activeIdx];

  const totals = useMemo(() => (activeDay ? computeDayTotals(activeDay) : { calories: 0, protein: 0, carbs: 0, fat: 0 }), [activeDay]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    sendActiveToMacros,
    sendActiveToShopping,
    getActiveDay: () => activeDay || null,
  }));

  async function handleSaveDraft() {
    if (!draft || !draft.days?.length) return;
    const payload: BuilderPlanJSON = {
      source: builderKey,
      days: draft.days.map((d, i) => ({ ...d, dayIndex: i })),
      createdAtISO: draft.createdAtISO ?? new Date().toISOString(),
    };
    try {
      await apiSavePlan(builderKey, payload, payload.days.length);
      await load();
      toast({
        title: "Plan Saved",
        description: `Saved ${payload.days.length} day${payload.days.length > 1 ? 's' : ''} to your ${builderKey} board.`,
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Could not save plan. Please try again.",
        variant: "destructive",
      });
    }
  }

  async function deleteDay(idx: number) {
    if (!plan) return;
    const nextDays = plan.days.filter((_, i) => i !== idx).map((d, i) => ({ ...d, dayIndex: i }));
    const next = { ...plan, days: nextDays };
    await apiPatchPlan(builderKey, next);
    const targetIdx = Math.max(0, Math.min(activeIdx, nextDays.length - 1));
    await load(false);
    setActiveIdx(targetIdx);
    toast({ title: "Day Deleted", description: `Day ${idx + 1} removed.` });
  }

  async function removeMeal(slot: keyof PlanDay["lists"], mealId: string) {
    if (!plan || !activeDay) return;
    const nextDays = plan.days.map((d, i) => {
      if (i !== activeIdx) return d;
      return {
        ...d,
        lists: {
          ...d.lists,
          [slot]: d.lists[slot].filter((m) => m.id !== mealId),
        },
      };
    });
    const next = { ...plan, days: nextDays };
    await apiPatchPlan(builderKey, next);
    await load(false);
    toast({ title: "Meal Removed", description: "Meal deleted from day." });
  }

  async function sendActiveToMacros() {
    if (!activeDay) return;
    try {
      const c = await logDayToMacros(activeDay);
      toast({
        title: "Logged to Macros",
        description: `${c} meal${c !== 1 ? 's' : ''} added to your food log.`,
      });
    } catch (error) {
      toast({
        title: "Log Failed",
        description: "Could not log meals to macros.",
        variant: "destructive",
      });
    }
  }

  async function sendActiveToShopping() {
    if (!activeDay) return;
    try {
      const c = await sendDayToShopping(activeDay);
      toast({
        title: c > 0 ? "Added to Shopping List" : "No Ingredients",
        description: c > 0 ? `${c} ingredient${c !== 1 ? 's' : ''} added.` : "This day has no ingredients to add.",
      });
    } catch (error) {
      toast({
        title: "Shopping List Failed",
        description: "Could not add to shopping list.",
        variant: "destructive",
      });
    }
  }

  if (loading) {
    return (
      <Card className="p-4 bg-black/60 backdrop-blur-lg border border-white/15">
        <div className="text-white/80">Loading {header}…</div>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-black/60 backdrop-blur-lg border border-white/15">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-white text-lg font-semibold">{header}</h2>
        <div className="flex items-center gap-2">
          {draft?.days?.length ? (
            <Button onClick={handleSaveDraft} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-4 w-4 mr-1" />
              {draftLabel}
            </Button>
          ) : null}
        </div>
      </div>

      {!plan || plan.days.length === 0 ? (
        builderKey !== "medical" ? (
          <div className="mt-4 text-white/70 text-sm">
            No active plan yet. Use your builder to generate 1–7 days, then "{draftLabel}".
          </div>
        ) : (
          <div className="mt-4 text-white/70 text-sm">
            No active plan yet.
          </div>
        )
      ) : (
        <>
          {/* Day selector */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <button
              className="rounded-md border border-white/20 text-white/80 px-2 py-1 hover:bg-white/10 disabled:opacity-50"
              onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
              disabled={activeIdx === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {plan.days.map((d, i) => (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                className={`rounded-xl px-3 py-1 text-sm border ${
                  i === activeIdx
                    ? "bg-white text-black border-white"
                    : "bg-white/5 text-white/80 border-white/20 hover:bg-white/10"
                }`}
              >
                Day {i + 1}
              </button>
            ))}
            <button
              className="rounded-md border border-white/20 text-white/80 px-2 py-1 hover:bg-white/10 disabled:opacity-50"
              onClick={() => setActiveIdx((i) => Math.min(plan.days.length - 1, i + 1))}
              disabled={activeIdx === plan.days.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day detail */}
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            {(["breakfast","lunch","dinner","snacks"] as const).map((slot) => {
              const meals = activeDay?.lists?.[slot] ?? [];
              return (
                <section key={slot} className="rounded-2xl border border-white/15 bg-white/5 p-3">
                  <div className="text-white/90 font-semibold mb-2 capitalize">{slot}</div>
                  <div className="space-y-2">
                    {meals.length === 0 ? (
                      <div className="text-white/50 text-sm">No items</div>
                    ) : (
                      meals.map((m) => (
                        <MealChip key={m.id} meal={m} onDelete={() => removeMeal(slot, m.id)} />
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          {/* MacroBridge Footer - Send Day to Macros */}
          <div className="mt-4">
            <MacroBridgeFooter
              items={[
                ...activeDay.lists.breakfast,
                ...activeDay.lists.lunch,
                ...activeDay.lists.dinner,
                ...activeDay.lists.snacks,
              ].map(meal => ({
                protein: meal.nutrition?.protein || 0,
                carbs: meal.nutrition?.carbs || 0,
                fat: meal.nutrition?.fat || 0,
                calories: meal.nutrition?.calories || 0,
              }))}
              dateISO={(() => {
                const today = new Date();
                today.setDate(today.getDate() + activeIdx);
                return today.toISOString().slice(0, 10);
              })()}
              mealSlot={null}
              variant="day"
            />
          </div>
        </>
      )}
    </Card>
  );
});

BuilderDayBoard.displayName = "BuilderDayBoard";

export default BuilderDayBoard;
