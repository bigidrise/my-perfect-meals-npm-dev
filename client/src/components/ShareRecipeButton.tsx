/**
 * ShareRecipeButton
 *
 * Sharing priority:
 *  1. Native app (Capacitor)  → @capacitor/share → native iOS/Android share sheet
 *  2. Web + navigator.share   → Web Share API    → native macOS/mobile sheet
 *  3. Desktop fallback        → SharePanel modal → Copy Link / Email / Copy Recipe
 *
 * Before sharing, calls POST /api/meals/share to create a public preview link.
 * If the current user is an active Rewardful affiliate, the server automatically
 * appends ?via=TOKEN so attribution survives the signup → checkout journey.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Lock } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { normalizeInstructions } from "@/utils/normalizeInstructions";
import { formatAmount } from "@/utils/formatAmount";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import SharePanel from "@/components/SharePanel";

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
    image?: string;
  };
  className?: string;
  locked?: boolean;
  onLockedClick?: () => void;
}

export default function ShareRecipeButton({
  recipe,
  className,
  locked,
  onLockedClick,
}: ShareRecipeButtonProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [shareUrl, setShareUrl]   = useState<string | null>(null);
  const [sharing, setSharing]     = useState(false);

  if (!recipe) return null;

  const title       = recipe.name || "My Perfect Meal";
  const description = recipe.description || "";

  const macroSummary = recipe.nutrition
    ? `${recipe.nutrition.calories || 0} cal | ${recipe.nutrition.protein || 0}g protein | ${recipe.nutrition.carbs || 0}g carbs | ${recipe.nutrition.fat || 0}g fat`
    : "";

  const ingredientsList =
    recipe.ingredients
      ?.map((i) => {
        const amount = formatAmount(i.amount);
        const parts  = [amount, i.unit, i.name].filter(Boolean);
        return `• ${parts.join(" ")}`;
      })
      .join("\n") || "";

  const instructionSteps = normalizeInstructions(recipe.instructions);
  const instructionsList = instructionSteps
    .map((step, i) => `${i + 1}. ${step.trim()}`)
    .join("\n");

  // Plain text body used for Copy Recipe and native share text
  const buildShareText = (url?: string) => {
    const lines = [
      `🍽️ ${title}`,
      "",
      description ? description : null,
      "",
      macroSummary ? `📊 ${macroSummary}` : null,
      "",
      ingredientsList ? `Ingredients:\n${ingredientsList}` : null,
      "",
      instructionsList ? `Instructions:\n${instructionsList}` : null,
      "",
      url ? `View the full recipe: ${url}` : null,
      "",
      "Created with My Perfect Meals · https://app.myperfectmeals.com",
    ];
    return lines.filter((l) => l !== null).join("\n").trim();
  };

  // ─── Create a public share link ───────────────────────────────────────────
  async function getOrCreateShareUrl(): Promise<string> {
    if (shareUrl) return shareUrl;

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...((await getAuthHeaders()) as Record<string, string>),
      };

      const body: Record<string, unknown> = {
        mealName:        title,
        mealDescription: description || undefined,
        mealImage:       recipe.image || undefined,
        calories:        recipe.nutrition?.calories,
        protein:         recipe.nutrition?.protein,
        carbs:           recipe.nutrition?.carbs,
        fat:             recipe.nutrition?.fat,
      };

      const res = await fetch(apiUrl("/api/meals/share"), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        const url = data.shareUrl as string;
        setShareUrl(url);
        return url;
      }
    } catch (err) {
      console.error("[ShareRecipeButton] Failed to create share URL:", err);
    }

    // Fallback: use the app root if share-link creation fails
    return "https://app.myperfectmeals.com";
  }

  // ─── Main handler ─────────────────────────────────────────────────────────
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (locked) {
      onLockedClick?.();
      return;
    }

    if (sharing) return;
    setSharing(true);

    try {
      const url      = await getOrCreateShareUrl();
      const text     = buildShareText(url);

      if (Capacitor.isNativePlatform()) {
        // ① Native iOS/Android share sheet
        await Share.share({ title, text, url, dialogTitle: "Share Recipe" });
        return;
      }

      if (typeof navigator !== "undefined" && navigator.share) {
        // ② Web Share API — fires the native share sheet on macOS Safari,
        //    Android Chrome, iOS Safari, etc.
        try {
          await navigator.share({ title, text, url });
          return;
        } catch (err: any) {
          // AbortError = user dismissed — that's fine, don't fall through to panel
          if (err?.name === "AbortError") return;
          // Other errors fall through to the panel
        }
      }

      // ③ Desktop fallback — open our own share panel
      setPanelOpen(true);
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        className={`flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg active:scale-95 transition-all duration-200 ${className || ""}`}
        onClick={handleShare}
        disabled={sharing}
      >
        {locked ? <Lock className="h-3 w-3 mr-1" /> : <Share2 className="h-4 w-4 mr-1" />}
        {sharing ? "Sharing…" : "Share"}
      </Button>

      {panelOpen && shareUrl && (
        <SharePanel
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          shareUrl={shareUrl}
          mealName={title}
          shareText={buildShareText(shareUrl)}
        />
      )}
    </>
  );
}
