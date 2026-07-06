import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { canLogMealToMacros, markMealLogged } from "@/lib/macroLogGuard";
import type { MacroSourceSlug } from "@/lib/macroSourcesConfig";
import { Check, Loader2 } from "lucide-react";

export type MacroSource = {
  protein: number;
  carbs: number;
  starchyCarbs?: number;
  fibrousCarbs?: number;
  fat: number;
  calories?: number;
  dateISO?: string;
  mealSlot?: "breakfast" | "lunch" | "dinner" | "snacks" | null;
  servings?: number;
};

function buildFingerprint(p: number, c: number, f: number, cal: number): string {
  return `bridge_${p}p_${c}c_${f}f_${cal}cal`;
}

export default function MacroBridgeButton({
  meal,
  label = "Add to Macros",
  source,
}: {
  meal: MacroSource;
  label?: string;
  source?: MacroSourceSlug;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<"idle" | "loading" | "logged">("idle");

  const s = Math.max(1, Math.round(meal.servings ?? 1));
  const p = Math.max(0, Math.round((meal.protein || 0) * s));
  const c = Math.max(0, Math.round((meal.carbs || 0) * s));
  const sc = Math.max(0, Math.round((meal.starchyCarbs || 0) * s));
  const fc = Math.max(0, Math.round((meal.fibrousCarbs || 0) * s));
  const f = Math.max(0, Math.round((meal.fat || 0) * s));
  const cal = Math.max(0, Math.round(meal.calories ?? p * 4 + c * 4 + f * 9));

  const userId = user?.id ?? "";
  const fingerprint = buildFingerprint(p, c, f, cal);

  useEffect(() => {
    if (userId && !canLogMealToMacros(userId, fingerprint)) {
      setStatus("logged");
    }
  }, [userId, fingerprint]);

  async function click() {
    if (status !== "idle") return;
    setStatus("loading");
    try {
      const { post } = await import("@/lib/api");
      await post("/api/macros/log", {
        loggedAt: meal.dateISO ? `${meal.dateISO}T12:00:00.000Z` : new Date().toISOString(),
        mealType: meal.mealSlot ?? "snack",
        kcal: cal,
        protein: p,
        carbs: c,
        fat: f,
        starchyCarbs: sc,
        fibrousCarbs: fc,
        source: source ?? "meal-card",
      });
      markMealLogged(userId, fingerprint);
      setStatus("logged");
      window.dispatchEvent(new CustomEvent("macros:updated"));
      toast({ title: "Logged to Macros!", description: `${label} added to today's totals.` });
    } catch {
      setStatus("idle");
      toast({ title: "Logging failed", description: "Could not log macros. Please try again.", variant: "destructive" });
    }
  }

  return (
    <button
      type="button"
      onClick={click}
      disabled={status !== "idle"}
      className="w-full px-3 py-2 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-800 to-black text-white text-center text-sm border border-white/30 shadow-sm active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
      aria-label={label}
      data-testid="button-macrobridge"
    >
      {status === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {status === "logged" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
      {status === "logged" ? "Logged ✓" : status === "loading" ? "Logging…" : label}
    </button>
  );
}
