import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PillButton } from "@/components/ui/pill-button";
import { JustDescribeItModal } from "@/components/JustDescribeItModal";
import { StarchGuardIntercept } from "@/components/StarchGuardIntercept";
import { useStarchGuardPrecheck, StarchGuardDecision } from "@/hooks/useStarchGuardPrecheck";
import { mapEstimateToBoardMeal, MacroEstimate } from "@/lib/mapEstimateToBoardMeal";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

type MealSlot = "breakfast" | "lunch" | "dinner" | "snacks" | "meal4" | "meal5" | "meal6";

interface AddOwnMealButtonProps {
  slot: MealSlot;
  onSave: (meal: any) => void;
  onImageReady?: (mealId: string, imageUrl: string) => void;
  variant?: "icon" | "full";
  disabled?: boolean;
}

type Phase = "idle" | "describing" | "starch_blocked";

function slotToMealType(s: MealSlot): string {
  if (s === "breakfast") return "breakfast";
  if (s === "lunch") return "lunch";
  if (s === "snacks") return "snack";
  return "dinner";
}

export function AddOwnMealButton({ slot, onSave, onImageReady, variant = "icon", disabled = false }: AddOwnMealButtonProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [pendingMacros, setPendingMacros] = useState<MacroEstimate | null>(null);

  const { alert, checkStarch, clearAlert, setDecision } = useStarchGuardPrecheck();

  const fetchImageInBackground = useCallback((meal: { id: string; name: string }) => {
    if (!onImageReady) return;
    fetch(apiUrl("/api/meals/generate-image"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({
        mealName: meal.name,
        mealType: slotToMealType(slot),
        ingredients: [],
      }),
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.imageUrl) onImageReady(meal.id, data.imageUrl);
      })
      .catch(() => {});
  }, [slot, onImageReady]);

  const insertMeal = useCallback((macros: MacroEstimate) => {
    const meal = mapEstimateToBoardMeal(macros, null);
    onSave(meal);
    setPhase("idle");
    setPendingMacros(null);
    clearAlert();
    fetchImageInBackground({ id: meal.id, name: meal.name });
  }, [onSave, clearAlert, fetchImageInBackground]);

  const handleEstimateComplete = useCallback((macros: MacroEstimate) => {
    setPendingMacros(macros);

    if (macros.starchyCarbs > 0) {
      const allowed = checkStarch(macros.description);
      if (!allowed) {
        setPhase("starch_blocked");
        return;
      }
    }

    insertMeal(macros);
  }, [checkStarch, insertMeal]);

  const handleStarchDecision = useCallback((decision: StarchGuardDecision) => {
    setDecision(decision);
    clearAlert();

    if (decision === "continue_anyway" && pendingMacros) {
      insertMeal(pendingMacros);
    } else {
      setPhase("describing");
      setPendingMacros(null);
    }
  }, [pendingMacros, insertMeal, clearAlert, setDecision]);

  if (variant === "full") {
    return (
      <>
        <Button
          onClick={() => setPhase("describing")}
          className="bg-black hover:bg-zinc-900 text-white border border-white/30"
          disabled={disabled}
          data-testid={`button-add-own-${slot}`}
        >
          <>
            <Plus className="h-4 w-4 mr-2" />
            Describe What You Ate
          </>
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
      <div className="inline-flex flex-col items-center gap-1">
        <PillButton
          onClick={() => setPhase("describing")}
          disabled={disabled}
          data-testid={`button-add-own-${slot}`}
          active={true}
          variant="violet"
          className="px-3"
        >
          <Plus className="h-3 w-3" />
        </PillButton>
        <span className="text-xs font-semibold text-white/70 tracking-wide">Just Describe It</span>
      </div>

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
  return createPortal(
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
    </>,
    document.body
  );
}
