import { Heart } from "lucide-react";
import { useToggleSavedMeal, useSavedMealsCheck, isMealSaved } from "@/hooks/useSavedMeals";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

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

  useEffect(() => {
    setOptimisticSaved(null);
  }, [keys]);

  const serverSaved = isMealSaved(keys, title, sourceType);
  const saved = optimisticSaved !== null ? optimisticSaved : serverSaved;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
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
  };

  return (
    <button
      onClick={handleToggle}
      className={`p-1.5 rounded-full transition-colors ${saved ? "text-red-500" : "text-white/50"} active:scale-[0.98] ${className}`}
      aria-label={saved ? "Remove from favorites" : "Save to favorites"}
    >
      <Heart style={{ width: size, height: size }} fill={saved ? "currentColor" : "none"} />
    </button>
  );
}
