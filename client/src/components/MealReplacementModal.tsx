import React from "react";
import { ConfirmationModal } from "@/components/ui/universal-modal";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { EngineMeal } from "@/lib/mealEngineApi";

interface MealReplacementModalProps {
  open: boolean;
  meal: EngineMeal | null;
  onClose: () => void;
  onReplace: () => void;
  isLoading?: boolean;
}

export default function MealReplacementModal({ 
  open, 
  meal, 
  onClose, 
  onReplace, 
  isLoading = false 
}: MealReplacementModalProps) {
  if (!meal) return null;

  return (
    <ConfirmationModal
      open={open}
      onOpenChange={onClose}
      title={
        <span className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5" />
          Replace Meal
        </span>
      }
      description={
        <span className="text-gray-600 dark:text-gray-300">
          Replace <strong>"{meal.name}"</strong> with a brand new recipe?
          The new meal will maintain your dietary preferences and medical safety requirements.
        </span>
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={onReplace}
            disabled={isLoading}
            className="bg-purple-500 hover:bg-purple-600 text-white"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              "Replace Meal"
            )}
          </Button>
        </>
      }
    >
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-3">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>What happens:</strong> You'll get a completely different meal with new ingredients,
          cooking instructions, and recipe while keeping your health profile safe.
        </p>
      </div>
    </ConfirmationModal>
  );
}