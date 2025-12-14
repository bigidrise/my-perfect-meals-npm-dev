import { Button } from "@/components/ui/button";
import { Sparkles, Plus } from "lucide-react";
import { CreateWithChefButton } from "@/components/CreateWithChefButton";
import { SnackCreatorButton } from "@/components/SnackCreatorButton";

type MealSlot = "breakfast" | "lunch" | "dinner" | "snacks";

interface GlobalMealActionBarProps {
  slot: MealSlot;
  onCreateWithAI: () => void;
  onCreateWithChef: () => void;
  onSnackCreator?: () => void;
  onManualAdd: () => void;
  onLogSnack?: () => void;
  disabled?: boolean;
  showCreateWithChef?: boolean;
  showSnackCreator?: boolean;
  showLogSnack?: boolean;
}

export function GlobalMealActionBar({
  slot,
  onCreateWithAI,
  onCreateWithChef,
  onSnackCreator,
  onManualAdd,
  onLogSnack,
  disabled = false,
  showCreateWithChef = true,
  showSnackCreator = true,
  showLogSnack = false,
}: GlobalMealActionBarProps) {
  const isSnackSlot = slot === "snacks";
  const isMealSlot = slot === "breakfast" || slot === "lunch" || slot === "dinner";

  return (
    <div className="flex gap-2">
      {/* For meal slots: Show Create with AI */}
      {isMealSlot && (
        <Button
          size="sm"
          variant="ghost"
          className="text-white/80 hover:bg-black/50 border border-pink-400/30 text-xs font-medium flex items-center gap-1 flash-border"
          onClick={onCreateWithAI}
          disabled={disabled}
          data-wt="wmb-create-ai-button"
        >
          <Sparkles className="h-3 w-3" />
          Create with AI
        </Button>
      )}

      {/* For snack slots: Show Snack Creator ONLY (replaces Create with AI) */}
      {showSnackCreator && isSnackSlot && onSnackCreator && (
        <SnackCreatorButton
          onClick={onSnackCreator}
          disabled={disabled}
        />
      )}

      {showCreateWithChef && isMealSlot && (
        <CreateWithChefButton
          onClick={onCreateWithChef}
          disabled={disabled}
        />
      )}

      <Button
        size="sm"
        variant="ghost"
        data-wt="weekly-empty-slot"
        className="text-white/80 hover:bg-white/10"
        onClick={onManualAdd}
        disabled={disabled}
      >
        <Plus className="h-4 w-4" />
      </Button>

      {showLogSnack && isSnackSlot && onLogSnack && (
        <Button
          size="sm"
          variant="ghost"
          className="text-white/70 hover:bg-white/10 text-xs font-medium"
          onClick={onLogSnack}
          disabled={disabled}
        >
          📸 Log Snack
        </Button>
      )}
    </div>
  );
}
