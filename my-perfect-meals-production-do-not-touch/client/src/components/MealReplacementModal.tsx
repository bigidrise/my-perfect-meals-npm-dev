import React from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { Meal } from "@/lib/mealEngineApi";

interface MealReplacementModalProps {
  open: boolean;
  meal: Meal | null;
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5" />
          Replace Meal
        </DialogTitle>
        <DialogDescription className="text-gray-600 dark:text-gray-300">
          Replace <strong>"{meal.name}"</strong> with a brand new recipe? 
          The new meal will maintain your dietary preferences and medical safety requirements.
        </DialogDescription>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-3">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>What happens:</strong> You'll get a completely different meal with new ingredients, 
            cooking instructions, and recipe while keeping your health profile safe.
          </p>
        </div>

        <DialogFooter className="flex gap-3 mt-4">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}