import { useMemo } from "react";
import { setQuickView } from "@/lib/macrosQuickView";
import { useLocation } from "wouter";
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
  const [, nav] = useLocation();
  const total = useMemo(() => sumItems(items), [items.length]);
  const count = items.length;

  function click() {
    setQuickView({
      protein: total.protein,
      carbs: total.carbs,
      starchyCarbs: total.starchyCarbs,
      fibrousCarbs: total.fibrousCarbs,
      fat: total.fat,
      calories: total.calories,
      dateISO: dateISO ?? new Date().toISOString().slice(0, 10),
      mealSlot: mealSlot ?? null,
    });
    const url = source 
      ? `/biometrics?from=${source}&view=macros`
      : "/biometrics?view=macros";
    nav(url);
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
          className="w-full sm:w-auto px-3 py-2 rounded-2xl bg-black hover:bg-zinc-900 text-white text-center text-sm border border-white/30 shadow-sm active:scale-[0.98]"
          data-testid={`button-send-${variant}`}
          data-wt="wmb-send-to-macros"
        >
          {variant === "week"
            ? "Send Entire Week to Macros"
            : "Send Entire Day to Macros"}
        </button>
      </div>
    </div>
  );
}
