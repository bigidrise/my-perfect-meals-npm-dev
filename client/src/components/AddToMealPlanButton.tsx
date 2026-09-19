import { useState } from "react";
import { CalendarPlus, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useFreeLock } from "@/hooks/useFreeLock";
import { UpgradeLockModal } from "@/components/upgrade/UpgradeLockModal";
import {
  MealPlanDestinationPicker,
  type MealPlanDestination,
} from "@/components/MealPlanDestinationPicker";

interface AddToMealPlanButtonProps {
  meal: any;
  onSuccess?: () => void;
}

export default function AddToMealPlanButton({ meal, onSuccess }: AddToMealPlanButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const { isFree, showLockModal, lockMessage, guardAction, closeLockModal } = useFreeLock();

  if (!meal) return null;

  const openPicker = (event: React.MouseEvent) => {
    event.stopPropagation();
    guardAction("Add meals to your weekly plan and track your nutrition with Essential.", () => {
      setIsOpen(true);
    });
  };

  const addToSelectedDestination = async (destination: MealPlanDestination) => {
    setIsAdding(true);
    try {
      const response = await fetch(apiUrl("/api/weekly-board/add-meal"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({
          dateISO: destination.dateISO,
          slot: destination.slot,
          bt: destination.builderType,
          meal: {
            id: meal.id,
            name: meal.name || meal.title,
            title: meal.name || meal.title,
            description: meal.description,
            imageUrl: meal.imageUrl,
            ingredients: meal.ingredients,
            instructions: meal.instructions,
            calories: meal.calories || meal.nutrition?.calories,
            protein: meal.protein || meal.nutrition?.protein,
            carbs: meal.carbs || meal.nutrition?.carbs,
            fat: meal.fat || meal.nutrition?.fat,
            starchyCarbs: meal.starchyCarbs ?? meal.nutrition?.starchyCarbs,
            fibrousCarbs: meal.fibrousCarbs ?? meal.nutrition?.fibrousCarbs,
            cookingTime: meal.cookingTime,
            difficulty: meal.difficulty,
            medicalBadges: meal.medicalBadges || [],
            builderType: meal.builderType,
          },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Failed to add meal");

      window.dispatchEvent(new CustomEvent("mpm:board-slot-added", {
        detail: {
          weekStartISO: result.weekStartISO,
          dateISO: result.dateISO,
          slot: result.slot,
          updatedDay: result.updatedDay,
        },
      }));
      window.dispatchEvent(new CustomEvent("show-toast", {
        detail: {
          title: result.wasOccupied ? "Meal Replaced!" : "Added to Meal Plan!",
          description: `${meal.name || meal.title} was added to your plan.`,
        },
      }));
      setIsOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to add meal to plan:", error);
      window.dispatchEvent(new CustomEvent("show-toast", {
        detail: {
          title: "Error",
          description: "Failed to add meal to your plan. Please try again.",
          variant: "destructive",
        },
      }));
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        className={`flex-1 text-xs shadow-md transition-all duration-200 hover:shadow-lg active:scale-95 ${
          isFree ? "bg-green-600/50 text-white/60" : "bg-green-600 text-white hover:bg-green-700"
        }`}
        onClick={openPicker}
      >
        <CalendarPlus className="mr-1 h-4 w-4" />
        Add to Plan
        {isFree && <Lock className="ml-1 h-3 w-3 opacity-60" />}
      </Button>
      <MealPlanDestinationPicker
        open={isOpen}
        onOpenChange={setIsOpen}
        title={meal.name || meal.title}
        busy={isAdding}
        busyLabel="Adding…"
        onSelect={addToSelectedDestination}
      />
      <UpgradeLockModal open={showLockModal} onClose={closeLockModal} message={lockMessage} />
    </>
  );
}