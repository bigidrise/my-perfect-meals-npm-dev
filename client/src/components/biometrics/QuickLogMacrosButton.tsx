import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import type { MacroDraft } from "@/lib/macrosDraft";

type Props = {
  draft: MacroDraft;
  label?: string;
  className?: string;
};

export default function QuickLogMacrosButton({
  draft,
  label = "Add to Macros",
  className = "bg-emerald-600 hover:bg-emerald-700 text-white",
}: Props) {
  const { toast } = useToast();
  const [status, setStatus] = useState<"idle" | "loading" | "logged">("idle");

  async function handleClick() {
    if (status !== "idle") return;
    setStatus("loading");
    try {
      const p = Math.max(0, Math.round(draft.protein_g));
      const c = Math.max(0, Math.round(draft.carbs_g));
      const f = Math.max(0, Math.round(draft.fat_g));
      const cal = draft.calories && draft.calories > 0
        ? Math.round(draft.calories)
        : Math.round(p * 4 + c * 4 + f * 9);

      const { post } = await import("@/lib/api");
      await post("/api/macros/log", {
        loggedAt: draft.dateISO ? `${draft.dateISO}T12:00:00.000Z` : new Date().toISOString(),
        mealType: draft.mealSlot ?? "snack",
        kcal: cal,
        protein: p,
        carbs: c,
        fat: f,
        source: "quick-log",
      });
      setStatus("logged");
      window.dispatchEvent(new CustomEvent("macros:updated"));
      toast({ title: "Logged to Macros!", description: `${p}g protein · ${c}g carbs · ${f}g fat added to today's totals.` });
    } catch {
      setStatus("idle");
      toast({ title: "Logging failed", description: "Could not log macros. Please try again.", variant: "destructive" });
    }
  }

  return (
    <Button
      data-testid="button-quick-log-macros"
      onClick={handleClick}
      disabled={status !== "idle"}
      className={className}
      size="sm"
    >
      {status === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
      {status === "logged" && <Check className="w-3.5 h-3.5 mr-1" />}
      {status === "logged" ? "Logged ✓" : status === "loading" ? "Logging…" : label}
    </Button>
  );
}
