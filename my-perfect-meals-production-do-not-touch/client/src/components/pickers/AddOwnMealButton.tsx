import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManualMealModal } from "./ManualMealModal";
import type { Meal } from "@/components/MealCard";

type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

interface AddOwnMealButtonProps {
  slot: MealSlot;
  onSave: (meal: any) => void;
  variant?: "icon" | "full";
}

export function AddOwnMealButton({ slot, onSave, variant = "icon" }: AddOwnMealButtonProps) {
  const [open, setOpen] = useState(false);

  const handleSave = (meal: Meal) => {
    // Convert ManualMealModal's Meal to builder format
    const converted = {
      id: meal.id,
      name: meal.title || meal.name || "Custom Meal",
      badges: [],
      macros: {
        calories: meal.nutrition?.calories || 0,
        protein_g: meal.nutrition?.protein || 0,
        carbs_g: meal.nutrition?.carbs || 0,
        fat_g: meal.nutrition?.fat || 0,
      },
      ingredients: meal.ingredients || [],
      instructions: meal.instructions || [],
    };
    onSave(converted);
    setOpen(false);
  };

  if (variant === "icon") {
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          className="h-6 w-6 p-0 bg-black hover:bg-zinc-900 text-white border border-white/30"
          data-testid={`button-add-own-${slot}`}
        >
          <Plus className="h-3 w-3" />
        </Button>
        <ManualMealModal
          open={open}
          onClose={() => setOpen(false)}
          onSave={handleSave}
        />
      </>
    );
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-black hover:bg-zinc-900 text-white border border-white/30"
        data-testid={`button-add-own-${slot}`}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Your Own Meal
      </Button>
      <ManualMealModal
        open={open}
        onClose={() => setOpen(false)}
        onSave={handleSave}
      />
    </>
  );
}
