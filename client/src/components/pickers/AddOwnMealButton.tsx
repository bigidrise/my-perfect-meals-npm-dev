import { useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JustDescribeItModal } from "@/components/JustDescribeItModal";
import { StarchGuardIntercept } from "@/components/StarchGuardIntercept";
import { useStarchGuardPrecheck, StarchGuardDecision } from "@/hooks/useStarchGuardPrecheck";
import { mapEstimateToBoardMeal, MacroEstimate } from "@/lib/mapEstimateToBoardMeal";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

type MealSlot = "breakfast" | "lunch" | "dinner" | "snacks";

interface AddOwnMealButtonProps {
  slot: MealSlot;
  onSave: (meal: any) => void;
  variant?: "icon" | "full";
  disabled?: boolean;
}

type Phase = "idle" | "describing" | "starch_blocked" | "generating";

function slotToMealType(s: MealSlot): string {
  if (s === "breakfast") return "breakfast";
  if (s === "lunch") return "lunch";
  if (s === "snacks") return "snack";
  return "dinner";
}

export function AddOwnMealButton({ slot, onSave, variant = "icon", disabled = false }: AddOwnMealButtonProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [pendingMacros, setPendingMacros] = useState<MacroEstimate | null>(null);

  const { alert, checkStarch, clearAlert, setDecision } = useStarchGuardPrecheck();

  const generateImageAndInsert = useCallback(async (macros: MacroEstimate) => {
    setPhase("generating");
    let imageUrl: string | null = null;

    try {
      const res = await fetch(apiUrl("/api/meals/generate-image"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          mealName: macros.description,
          mealType: slotToMealType(slot),
          ingredients: [],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        imageUrl = data.imageUrl ?? null;
      }
    } catch {
      // silent — insert without image
    }

    const meal = mapEstimateToBoardMeal(macros, imageUrl);
    onSave(meal);
    setPhase("idle");
    setPendingMacros(null);
    clearAlert();
  }, [slot, onSave, clearAlert]);

  const handleEstimateComplete = useCallback((macros: MacroEstimate) => {
    setPendingMacros(macros);

    // Starch guard: only trigger when starchyCarbs > 0 AND user is at limit (keyword detected)
    if (macros.starchyCarbs > 0) {
      const allowed = checkStarch(macros.description);
      if (!allowed) {
        setPhase("starch_blocked");
        return;
      }
    }

    generateImageAndInsert(macros);
  }, [checkStarch, generateImageAndInsert]);

  const handleStarchDecision = useCallback((decision: StarchGuardDecision) => {
    setDecision(decision);
    clearAlert();

    if (decision === "continue_anyway" && pendingMacros) {
      generateImageAndInsert(pendingMacros);
    } else {
      // "order_something_else" — go back to describe flow
      setPhase("describing");
      setPendingMacros(null);
    }
  }, [pendingMacros, generateImageAndInsert, clearAlert, setDecision]);

  const isGenerating = phase === "generating";

  if (variant === "full") {
    return (
      <>
        <Button
          onClick={() => setPhase("describing")}
          className="bg-black hover:bg-zinc-900 text-white border border-white/30"
          disabled={disabled || isGenerating}
          data-testid={`button-add-own-${slot}`}
        >
          {isGenerating ? (
            <span className="flex items-center gap-2">
              <span className="flex items-center space-x-1">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:0s]" />
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:0.3s]" />
              </span>
              Generating…
            </span>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Describe What You Ate
            </>
          )}
        </Button>

        <Overlays
          phase={phase}
          alert={alert}
          onDescribeClose={() => setPhase("idle")}
          onEstimateComplete={handleEstimateComplete}
          onStarchDecision={handleStarchDecision}
        />
      </>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setPhase("describing")}
        className="h-6 w-6 p-0 bg-black hover:bg-zinc-900 text-white border border-white/30"
        disabled={disabled || isGenerating}
        data-testid={`button-add-own-${slot}`}
      >
        {isGenerating ? (
          <span className="flex items-center space-x-px">
            <span className="w-1 h-1 bg-amber-400 rounded-full animate-bounce [animation-delay:0s]" />
            <span className="w-1 h-1 bg-amber-400 rounded-full animate-bounce [animation-delay:0.15s]" />
            <span className="w-1 h-1 bg-amber-400 rounded-full animate-bounce [animation-delay:0.3s]" />
          </span>
        ) : (
          <Plus className="h-3 w-3" />
        )}
      </Button>

      <Overlays
        phase={phase}
        alert={alert}
        onDescribeClose={() => setPhase("idle")}
        onEstimateComplete={handleEstimateComplete}
        onStarchDecision={handleStarchDecision}
      />
    </>
  );
}

function Overlays({
  phase,
  alert,
  onDescribeClose,
  onEstimateComplete,
  onStarchDecision,
}: {
  phase: Phase;
  alert: ReturnType<typeof useStarchGuardPrecheck>["alert"];
  onDescribeClose: () => void;
  onEstimateComplete: (macros: MacroEstimate) => void;
  onStarchDecision: (d: StarchGuardDecision) => void;
}) {
  return (
    <>
      <JustDescribeItModal
        open={phase === "describing"}
        onClose={onDescribeClose}
        onAdd={onEstimateComplete}
      />

      {phase === "starch_blocked" && alert.show && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm">
            <StarchGuardIntercept
              alert={alert}
              onDecision={onStarchDecision}
              showContinueAnyway={true}
              continueAnywayLabel="Add It Anyway"
              chooseAnotherLabel="Describe Something Else"
            />
          </div>
        </div>
      )}

      {phase === "generating" && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-gray-900 to-black border border-white/20 rounded-2xl p-8 text-center w-full max-w-xs">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <span className="w-3 h-3 bg-amber-400 rounded-full animate-bounce [animation-delay:0s]" />
              <span className="w-3 h-3 bg-amber-400 rounded-full animate-bounce [animation-delay:0.15s]" />
              <span className="w-3 h-3 bg-amber-400 rounded-full animate-bounce [animation-delay:0.3s]" />
            </div>
            <p className="text-white font-semibold text-base">Crafting your meal…</p>
            <p className="text-white/50 text-sm mt-1">Building your card, just a sec</p>
          </div>
        </div>
      )}
    </>
  );
}
