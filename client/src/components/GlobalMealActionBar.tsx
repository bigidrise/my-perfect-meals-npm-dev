import { Button } from "@/components/ui/button";
import { Sparkles, Star } from "lucide-react";
import { CreateWithChefButton } from "@/components/CreateWithChefButton";
import { SnackCreatorButton } from "@/components/SnackCreatorButton";
import { PillButton } from "@/components/ui/pill-button";
import { AddOwnMealButton } from "@/components/pickers/AddOwnMealButton";
import { FEATURES } from "@/featureFlags";

type MealSlot = "breakfast" | "lunch" | "dinner" | "snacks" | "meal4" | "meal5" | "meal6";

interface GlobalMealActionBarProps {
  slot: MealSlot;
  onCreateWithAI: () => void;
  onCreateWithChef: () => void;
  onSnackCreator?: () => void;
  onSave: (meal: any) => void;
  onImageReady?: (mealId: string, imageUrl: string) => void;
  onLogSnack?: () => void;
  onFavorites?: () => void;
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
  onSave,
  onImageReady,
  onLogSnack,
  onFavorites,
  disabled = false,
  showCreateWithChef = true,
  showSnackCreator = true,
  showLogSnack = false,
}: GlobalMealActionBarProps) {
  const isSnackSlot = slot === "snacks";
  const isMealSlot = slot === "breakfast" || slot === "lunch" || slot === "dinner" || slot === "meal4" || slot === "meal5" || slot === "meal6";

  return (
    <div className="flex gap-2">
      {FEATURES.showCreateWithAI && isMealSlot && (
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

      {onFavorites && (
        <div className="inline-flex flex-col items-center gap-1">
          <PillButton
            onClick={onFavorites}
            disabled={disabled}
            title="Pick from My Favorites"
            className="px-3"
            glow="rose"
          >
            <Star className="h-3 w-3 fill-red-500 text-red-500" />
          </PillButton>
          <span className="text-xs font-semibold text-white/70 tracking-wide">My Favorites</span>
        </div>
      )}

      <AddOwnMealButton
        slot={slot}
        onSave={onSave}
        onImageReady={onImageReady}
        variant="icon"
        disabled={disabled}
      />

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
