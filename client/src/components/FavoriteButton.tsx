import { Heart, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToggleSavedMeal, useSavedMealsCheck, isMealSaved } from "@/hooks/useSavedMeals";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useMealShopping } from "@/hooks/useMealShopping";
import { withShoppingProvenance } from "@/lib/mealShoppingApi";
import { useAuth } from "@/contexts/AuthContext";
import { hasActivePaidSubscription } from "@/lib/subscriptionCheck";
import { useUpgradeModal } from "@/contexts/UpgradeModalContext";
import { readRecipePackage } from "@shared/recipePackage";
import { recipePackagesEnabled } from "@/lib/recipePackageGate";

interface FavoriteButtonProps {
  title: string;
  sourceType: string;
  mealData: any;
  className?: string;
  size?: number;
  /** An explicit Save control must not remove an already-saved package. */
  saveOnly?: boolean;
  showLabel?: boolean;
  disabled?: boolean;
}

export default function FavoriteButton({ title, sourceType, mealData, className = "", size = 20, saveOnly = false, showLabel = false, disabled = false }: FavoriteButtonProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { requestUpgrade } = useUpgradeModal();
  const toggle = useToggleSavedMeal();
  const shopping = useMealShopping();
  const { data: keys } = useSavedMealsCheck();
  const [optimisticSaved, setOptimisticSaved] = useState<boolean | null>(null);

  const isFree = !hasActivePaidSubscription(user);
  const packageId = recipePackagesEnabled ? readRecipePackage(mealData)?.id : undefined;

  useEffect(() => {
    setOptimisticSaved(null);
  }, [keys, packageId]);

  const serverSaved = isMealSaved(keys, title, sourceType, packageId);
  const saved = optimisticSaved !== null ? optimisticSaved : serverSaved;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isFree) {
      requestUpgrade({ requiredTier: "essential", featureName: "Saved Meals" });
      return;
    }
    if (disabled || (packageId && toggle.isPending) || (saveOnly && saved)) return;

    const willBeSaved = !saved;
    setOptimisticSaved(willBeSaved);

    toggle.mutate(
      { title, sourceType, mealData: shopping.available ? withShoppingProvenance(mealData, sourceType) : mealData },
      {
        onSuccess: (result) => {
          toast({
            title: result.saved ? "Meal saved" : "Meal removed",
            description: result.saved ? `"${title}" added to your favorites.` : `"${title}" removed from favorites.`,
          });
        },
        onError: () => {
          setOptimisticSaved(null);
          toast({ title: t("common.error"), description: t("savedMeals.couldNotUpdateFavorites") });
        },
      }
    );
  };

  return (
    <button
      onClick={handleToggle}
      disabled={disabled || (!!packageId && toggle.isPending)}
      className={`p-1.5 rounded-full transition-colors ${showLabel ? "inline-flex items-center gap-2" : ""} ${isFree ? "text-white/30" : saved ? "text-red-500" : "text-white/50"} active:scale-[0.98] relative ${className}`}
      aria-label={isFree ? "Upgrade to save favorites" : saved ? (saveOnly ? "Saved to Favorites" : "Remove from favorites") : "Save to favorites"}
    >
      <Heart
        style={{ width: size, height: size }}
        fill={!isFree && saved ? "currentColor" : "none"}
        strokeWidth={2.5}
        stroke={isFree ? "#9ca3af" : saved ? "currentColor" : "#ef4444"}
      />
      {isFree && (
        <Lock
          className="absolute -bottom-0.5 -right-0.5 text-orange-400/70"
          style={{ width: size * 0.5, height: size * 0.5 }}
        />
      )}
      {showLabel && <span className="text-sm">{saved ? "Saved to Favorites" : "Save to Favorites"}</span>}
    </button>
  );
}
