import { Heart, Lock } from "lucide-react";
import { useToggleSavedMeal, useSavedMealsCheck, isMealSaved } from "@/hooks/useSavedMeals";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useFreeLock } from "@/hooks/useFreeLock";
import { UpgradeLockModal } from "@/components/upgrade/UpgradeLockModal";

interface FavoriteButtonProps {
  title: string;
  sourceType: string;
  mealData: any;
  className?: string;
  size?: number;
}

export default function FavoriteButton({ title, sourceType, mealData, className = "", size = 20 }: FavoriteButtonProps) {
  const { toast } = useToast();
  const toggle = useToggleSavedMeal();
  const { data: keys } = useSavedMealsCheck();
  const [optimisticSaved, setOptimisticSaved] = useState<boolean | null>(null);
  const { isFree, showLockModal, lockMessage, guardAction, closeLockModal } = useFreeLock();

  useEffect(() => {
    setOptimisticSaved(null);
  }, [keys]);

  const serverSaved = isMealSaved(keys, title, sourceType);
  const saved = optimisticSaved !== null ? optimisticSaved : serverSaved;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();

    guardAction("Save meals and build your personal recipe board with Premium.", () => {
      const willBeSaved = !saved;
      setOptimisticSaved(willBeSaved);

      toggle.mutate(
        { title, sourceType, mealData },
        {
          onSuccess: (result) => {
            toast({
              title: result.saved ? "Meal saved" : "Meal removed",
              description: result.saved ? `"${title}" added to your favorites.` : `"${title}" removed from favorites.`,
            });
          },
          onError: () => {
            setOptimisticSaved(null);
            toast({ title: "Error", description: "Could not update favorites. Try again." });
          },
        }
      );
    });
  };

  return (
    <>
      <button
        onClick={handleToggle}
        className={`p-1.5 rounded-full transition-colors ${isFree ? "text-white/30" : saved ? "text-red-500" : "text-white/50"} active:scale-[0.98] relative ${className}`}
        aria-label={isFree ? "Upgrade to save favorites" : saved ? "Remove from favorites" : "Save to favorites"}
      >
        <Heart style={{ width: size, height: size }} fill={!isFree && saved ? "currentColor" : "none"} strokeWidth={2.5} stroke={isFree ? "#9ca3af" : saved ? "currentColor" : "#ef4444"} />
        {isFree && (
          <Lock className="absolute -bottom-0.5 -right-0.5 text-orange-400/70" style={{ width: size * 0.5, height: size * 0.5 }} />
        )}
      </button>
      <UpgradeLockModal open={showLockModal} onClose={closeLockModal} message={lockMessage} />
    </>
  );
}
