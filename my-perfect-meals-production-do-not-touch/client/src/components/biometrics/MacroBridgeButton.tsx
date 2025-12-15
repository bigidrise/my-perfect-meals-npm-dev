import { setQuickView } from "@/lib/macrosQuickView";
import { useLocation } from "wouter";
import type { MacroSourceSlug } from "@/lib/macroSourcesConfig";

export type MacroSource = {
  protein: number;
  carbs: number;
  fat: number;
  calories?: number;
  dateISO?: string;
  mealSlot?: "breakfast" | "lunch" | "dinner" | "snack" | null;
  servings?: number;
};

export default function MacroBridgeButton({
  meal,
  label = "Add to Macros",
  source,
}: {
  meal: MacroSource;
  label?: string;
  source?: MacroSourceSlug;
}) {
  const [, nav] = useLocation();

  function click() {
    const s = Math.max(1, Math.round(meal.servings ?? 1));
    const p = Math.max(0, Math.round((meal.protein || 0) * s));
    const c = Math.max(0, Math.round((meal.carbs || 0) * s));
    const f = Math.max(0, Math.round((meal.fat || 0) * s));
    const cal = Math.max(
      0,
      Math.round(meal.calories ?? p * 4 + c * 4 + f * 9)
    );
    setQuickView({
      protein: p,
      carbs: c,
      fat: f,
      calories: cal,
      dateISO: meal.dateISO ?? new Date().toISOString().slice(0, 10),
      mealSlot: meal.mealSlot ?? null,
    });
    const url = source 
      ? `/biometrics?from=${source}&view=macros`
      : "/biometrics?view=macros";
    nav(url);
  }

  return (
    <button
      type="button"
      onClick={click}
      className="w-full px-3 py-2 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-800 to-black hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-900 text-white text-center text-sm border border-white/30 shadow-sm active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-white/30"
      aria-label={label}
      data-testid="button-macrobridge"
    >
      {label}
    </button>
  );
}
