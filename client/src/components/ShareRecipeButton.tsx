import { Button } from "@/components/ui/button";
import { Share2, Lock } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { normalizeInstructions } from "@/utils/normalizeInstructions";
import { formatAmount } from "@/utils/formatAmount";

interface ShareRecipeButtonProps {
  recipe: {
    name: string;
    description?: string;
    nutrition?: {
      calories?: number;
      protein?: number;
      carbs?: number;
      fat?: number;
    };
    ingredients?: Array<{ name: string; amount?: string; unit?: string }>;
    instructions?: string[] | string;
  };
  className?: string;
  locked?: boolean;
  onLockedClick?: () => void;
}

export default function ShareRecipeButton({ recipe, className, locked, onLockedClick }: ShareRecipeButtonProps) {
  if (!recipe) return null;

  const title = recipe.name || "My Perfect Meal";
  const description = recipe.description || "";

  const macroSummary = recipe.nutrition
    ? `${recipe.nutrition.calories || 0} cal | ${recipe.nutrition.protein || 0}g protein | ${recipe.nutrition.carbs || 0}g carbs | ${recipe.nutrition.fat || 0}g fat`
    : "";

  const ingredientsList = recipe.ingredients
    ?.map((i) => {
      const amount = formatAmount(i.amount);
      const parts = [amount, i.unit, i.name].filter(Boolean);
      return `• ${parts.join(" ")}`;
    })
    .join("\n") || "";

  const instructionSteps = normalizeInstructions(recipe.instructions);
  const instructionsList = instructionSteps
    .map((step, i) => `${i + 1}. ${step.trim()}`)
    .join("\n");

  const shareText = [
    `🍽️ ${title}`,
    "",
    description ? description : "",
    "",
    macroSummary ? `📊 ${macroSummary}` : "",
    "",
    ingredientsList ? `Ingredients:\n${ingredientsList}` : "",
    "",
    instructionsList ? `Instructions:\n${instructionsList}` : "",
    "",
    "Created with My Perfect Meals",
  ].filter(Boolean).join("\n").trim();

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (locked) {
      onLockedClick?.();
      return;
    }

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: title,
          text: shareText,
          dialogTitle: "Share Recipe",
        });
      } else if (navigator.share) {
        await navigator.share({
          title: title,
          text: shareText,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        const event = new CustomEvent("show-toast", {
          detail: {
            title: "Copied to Clipboard",
            description: `${recipe.name} has been copied.`,
          },
        });
        window.dispatchEvent(event);
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Share failed:", err);
        try {
          await navigator.clipboard.writeText(shareText);
          const event = new CustomEvent("show-toast", {
            detail: {
              title: "Copied to Clipboard",
              description: `${recipe.name} has been copied.`,
            },
          });
          window.dispatchEvent(event);
        } catch (clipboardErr) {
          console.error("Clipboard fallback failed:", clipboardErr);
        }
      }
    }
  };

  return (
    <Button
      size="sm"
      className={`flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg active:scale-95 transition-all duration-200 ${className || ""}`}
      onClick={handleShare}
    >
      {locked ? <Lock className="h-3 w-3 mr-1" /> : <Share2 className="h-4 w-4 mr-1" />}
      Share
    </Button>
  );
}
