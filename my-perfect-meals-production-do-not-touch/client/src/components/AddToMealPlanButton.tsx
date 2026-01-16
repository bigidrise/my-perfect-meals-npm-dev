import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CalendarPlus } from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

interface AddToMealPlanButtonProps {
  meal: any;
  onSuccess?: () => void;
}

function getTodayChicago(): string {
  const now = new Date();
  const chicagoTime = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return chicagoTime;
}

const SLOT_OPTIONS = [
  { value: "breakfast", label: "Breakfast", emoji: "🌅" },
  { value: "lunch", label: "Lunch", emoji: "☀️" },
  { value: "dinner", label: "Dinner", emoji: "🌙" },
  { value: "snacks", label: "Snack", emoji: "🍎" },
] as const;

export default function AddToMealPlanButton({ meal, onSuccess }: AddToMealPlanButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  if (!meal) return null;

  const handleAddToMealPlan = async (slot: string) => {
    setSelectedSlot(slot);
    setIsAdding(true);

    try {
      const todayISO = getTodayChicago();

      const response = await fetch(apiUrl("/api/weekly-board/add-meal"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          dateISO: todayISO,
          slot,
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
            starchyCarbs: meal.starchyCarbs || meal.nutrition?.starchyCarbs,
            fibrousCarbs: meal.fibrousCarbs || meal.nutrition?.fibrousCarbs,
            cookingTime: meal.cookingTime,
            difficulty: meal.difficulty,
            medicalBadges: meal.medicalBadges || [],
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add meal");
      }

      const slotLabel = SLOT_OPTIONS.find((s) => s.value === slot)?.label || slot;
      
      const event = new CustomEvent("show-toast", {
        detail: {
          title: "Added to Meal Plan!",
          description: `${meal.name || meal.title} added to Today's ${slotLabel}`,
        },
      });
      window.dispatchEvent(event);

      setIsOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to add meal to plan:", error);
      const event = new CustomEvent("show-toast", {
        detail: {
          title: "Error",
          description: "Failed to add meal to your plan. Please try again.",
          variant: "destructive",
        },
      });
      window.dispatchEvent(event);
    } finally {
      setIsAdding(false);
      setSelectedSlot(null);
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger asChild>
        <Button
          size="sm"
          className="flex-1 text-xs bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg active:scale-95 transition-all duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <CalendarPlus className="h-4 w-4 mr-1" />
          Add to Plan
        </Button>
      </DrawerTrigger>
      <DrawerContent className="bg-black/95 border-t border-white/20">
        <DrawerHeader className="text-center">
          <DrawerTitle className="text-white text-lg">
            Add to Today's Meal Plan
          </DrawerTitle>
          <p className="text-sm text-white/70 mt-1">
            {meal.name || meal.title}
          </p>
        </DrawerHeader>
        <div className="p-4 pb-8 space-y-3">
          {SLOT_OPTIONS.map((slot) => (
            <Button
              key={slot.value}
              variant="outline"
              className={`w-full h-14 text-lg justify-start gap-3 bg-white/5 border-white/20 text-white hover:bg-white/10 ${
                selectedSlot === slot.value && isAdding
                  ? "opacity-70 pointer-events-none"
                  : ""
              }`}
              onClick={() => handleAddToMealPlan(slot.value)}
              disabled={isAdding}
            >
              <span className="text-2xl">{slot.emoji}</span>
              <span>{slot.label}</span>
              {selectedSlot === slot.value && isAdding && (
                <span className="ml-auto text-sm text-white/60">Adding...</span>
              )}
            </Button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
