import { useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check } from "lucide-react";
import type { MacroSourceSlug } from "@/lib/macroSourcesConfig";

export type MacroItem = {
  protein: number;
  carbs: number;
  fat: number;
  calories?: number;
  starchyCarbs?: number;
  fibrousCarbs?: number;
};

function sumItems(items: MacroItem[]): { protein: number; carbs: number; fat: number; calories: number; starchyCarbs: number; fibrousCarbs: number } {
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalCalories = 0;
  let totalStarchyCarbs = 0;
  let totalFibrousCarbs = 0;

  for (const m of items) {
    totalProtein += m.protein || 0;
    const starchy = m.starchyCarbs || 0;
    const fibrous = m.fibrousCarbs || 0;
    totalCarbs += m.carbs || (starchy + fibrous);
    totalFat += m.fat || 0;
    totalCalories += m.calories ?? Math.round((m.protein || 0) * 4 + (m.carbs || 0) * 4 + (m.fat || 0) * 9);
    totalStarchyCarbs += starchy;
    totalFibrousCarbs += fibrous;
  }

  return {
    protein: Math.round(totalProtein),
    carbs: Math.round(totalCarbs),
    fat: Math.round(totalFat),
    calories: Math.round(totalCalories),
    starchyCarbs: Math.round(totalStarchyCarbs),
    fibrousCarbs: Math.round(totalFibrousCarbs),
  };
}

export function MacroBridgeFooter({
  items,
  dateISO,
  mealSlot,
  variant = "day",
  source,
}: {
  items: MacroItem[];
  dateISO?: string;
  mealSlot?: "breakfast" | "lunch" | "dinner" | "snacks" | null;
  variant?: "day" | "week";
  source?: MacroSourceSlug;
}) {
  const { toast } = useToast();
  const [status, setStatus] = useState<"idle" | "loading" | "logged">("idle");
  const total = useMemo(() => sumItems(items), [items.length]);
  const count = items.length;

  async function click() {
    if (status !== "idle") return;
    setStatus("loading");
    try {
      const { post } = await import("@/lib/api");
      await post("/api/macros/log", {
        loggedAt: dateISO ? `${dateISO}T12:00:00.000Z` : new Date().toISOString(),
        mealType: mealSlot ?? "snack",
        kcal: total.calories,
        protein: total.protein,
        carbs: total.carbs,
        fat: total.fat,
        starchyCarbs: total.starchyCarbs,
        fibrousCarbs: total.fibrousCarbs,
        source: source ?? "meal-plan",
      });
      setStatus("logged");
      window.dispatchEvent(new CustomEvent("macros:updated"));
      toast({
        title: variant === "week" ? "Week logged to Macros!" : "Day logged to Macros!",
        description: `${count} meal${count !== 1 ? "s" : ""} · ${total.protein}g protein · ${total.calories} kcal added to your totals.`,
      });
    } catch {
      setStatus("idle");
      toast({ title: "Logging failed", description: "Could not log macros. Please try again.", variant: "destructive" });
    }
  }

  if (!count) return null;

  return (
    <div className="sticky bottom-0 z-40 bg-gradient-to-r from-zinc-900/95 via-zinc-800/95 to-black/95 backdrop-blur border-t border-white/20 px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-white">
      <div className="text-xs sm:text-sm text-white/80">
        {variant === "week" ? "Week total" : "Day total"} · {count} meal
        {count !== 1 ? "s" : ""} · P {total.protein}g · Starchy {total.starchyCarbs}g · Fibrous {total.fibrousCarbs}g · Fat{" "}
        {total.fat}g
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={click}
          disabled={status !== "idle"}
          className="w-full sm:w-auto px-3 py-2 rounded-2xl bg-black hover:bg-zinc-900 text-white text-center text-sm border border-white/30 shadow-sm active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          data-testid={`button-send-${variant}`}
          data-wt="wmb-send-to-macros"
        >
          {status === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {status === "logged" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
          {status === "logged"
            ? "Logged ✓"
            : status === "loading"
            ? "Logging…"
            : variant === "week"
            ? "Send Entire Week to Macros"
            : "Send Entire Day to Macros"}
        </button>
      </div>
    </div>
  );
}
