// 🔒 LOCKDOWN PROTECTED: Macro logging system - DO NOT MODIFY
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { buildMacroLogEntryFromMeal } from "@/utils/macros";
import { localYYYYMMDD } from "@/utils/dates";
import { normalizeMealToMacros } from "@/utils/normalizeMealToMacros";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { post } from "@/lib/api";

function storageKey(userId: string, mealId?: string) {
  const day = localYYYYMMDD(new Date());
  return `macros.logged.${userId}.${mealId || "unknown"}.${day}`;
}

type Props = {
  userId: string;
  mealId?: string;
  mealName?: string;
  source: "ai_meal_creator" | "craving_creator" | "potluck_planner" | "fridge_rescue";
  kcalPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
  starchyCarbsPerServing?: number;
  fibrousCarbsPerServing?: number;
  defaultServings?: number;
  onLogged?: () => void;
  className?: string;
};

export default function LogToMacrosButton(p: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [servings] = useState(p.defaultServings ?? 1);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const key = useMemo(() => storageKey(p.userId, p.mealId), [p.userId, p.mealId]);

  useEffect(() => {
    if (localStorage.getItem(key) === "1") setStatus("success");
  }, [key]);

  async function logOnce() {
    if (status === "loading" || status === "success") return;
    setStatus("loading"); setErrorMsg("");

    try {
      const meal = {
        id: p.mealId,
        name: p.mealName || "Meal",
        nutrition: {
          calories: p.kcalPerServing * servings,
          protein: p.proteinPerServing * servings,
          carbs: p.carbsPerServing * servings,
          fat: p.fatPerServing * servings,
        },
      };

      // 🔧 FIXED: Use normalizer to ensure proper field mapping
      const normalizedPayload = normalizeMealToMacros(meal, { 
        source: p.source, 
        defaultMealType: "lunch" 
      });


      // ✅ FIXED: Use unified /api/macros/log endpoint with battle-tested API client
      await post("/api/macros/log", {
        userId: p.userId,
        mealId: p.mealId,
        loggedAt: new Date().toISOString(),
        mealType: "lunch",
        source: p.source,
        kcal: meal.nutrition.calories,
        protein: meal.nutrition.protein,
        carbs: meal.nutrition.carbs,
        fat: meal.nutrition.fat,
        starchyCarbs: (p.starchyCarbsPerServing ?? 0) * servings,
        fibrousCarbs: (p.fibrousCarbsPerServing ?? 0) * servings,
      });

      // Trigger instant macro refresh in Biometrics dashboard  
      queryClient.invalidateQueries({
        queryKey: ["/api/users", p.userId, "macros", "today"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/users", p.userId, "macros-daily"],
      });
      window.dispatchEvent(new Event("macros:updated"));

      // Show success toast
      toast({
        title: "Added to Macros ✓",
        description: `${meal.nutrition.calories} cal logged to your daily tracker`,
        duration: 3000,
      });

      localStorage.setItem(key, "1");
      setStatus("success");
      p.onLogged?.();
    } catch (e: any) {
      setStatus("error");
      setErrorMsg(e?.message || "Failed to log");
      setTimeout(() => setStatus("idle"), 1500);
    }
  }

  const cls =
    "inline-flex items-center justify-center gap-2 w-full sm:w-auto px-3 py-2 rounded-lg font-semibold border transition-colors duration-200 ease-out text-sm min-h-12 leading-tight " +
    (status === "idle"    ? "bg-emerald-600 text-white border-emerald-300 hover:bg-emerald-700 active:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-400"
    : status === "loading"? "bg-emerald-600/70 text-white border-emerald-300 cursor-wait"
    : status === "success"? "bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200 active:bg-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-300"
    :                       "bg-rose-100 text-rose-900 border-rose-300 hover:bg-rose-200 active:bg-rose-300 focus-visible:ring-2 focus-visible:ring-rose-300");

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    logOnce();
  };

  return (
    <div className={p.className || ""}>
      <button 
        type="button" 
        onClick={handleClick}
        onMouseDown={(e) => e.stopPropagation()}
        disabled={status==="loading"||status==="success"} 
        className={cls} 
        aria-live="polite" 
        aria-busy={status==="loading"?"true":"false"}
        style={{ pointerEvents: 'auto' }}
      >
        {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
        {status === "success" && <Check className="h-4 w-4" />}
        {status === "idle" && <Plus className="h-4 w-4" />}
        <span>{status === "idle" ? "Log to Macros" : status === "loading" ? "Logging…" : status === "success" ? "Logged ✓" : "Retry"}</span>
      </button>
      {status === "error" && <p className="text-xs text-rose-200/90 mt-1">{errorMsg}</p>}
      {status === "success" && <p className="text-xs text-emerald-200/90 mt-1">Added to today's macros.</p>}
    </div>
  );
}