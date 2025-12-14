import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

interface QuickAddMacrosModalProps {
  // Controlled mode
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Trigger mode (headless pattern)
  trigger?: React.ReactNode;
  // Optional user ID
  userId?: string;
}

export default function QuickAddMacrosModal({ 
  open, 
  onOpenChange, 
  trigger,
  userId = "00000000-0000-0000-0000-000000000001" 
}: QuickAddMacrosModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined && onOpenChange !== undefined;
  const modalOpen = isControlled ? open : internalOpen;
  const setModalOpen = isControlled ? onOpenChange : setInternalOpen;

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    protein: "",
    carbs: "",
    fat: "",
    fiber: "",
    alcohol: "",
    kcal: "",
    // Add GLP-1 specific fields
    glp1MealType: "", // e.g., "breakfast", "lunch", "dinner", "snack"
    glp1Duration: "", // e.g., "30min", "1hr", "2hr"
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    // Validate at least one macro is entered
    const hasData = Object.values(formData).some(value => value.trim() !== "");
    if (!hasData) {
      toast({
        title: "No data entered",
        description: "Please enter at least one macro value",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Use proper UTC timestamp (no manual timezone offset) 
      const loggedAt = new Date().toISOString(); // Store as UTC timestamp

      const protein = formData.protein ? parseFloat(formData.protein) : 0;
      const carbs = formData.carbs ? parseFloat(formData.carbs) : 0;
      const fat = formData.fat ? parseFloat(formData.fat) : 0;
      const alcohol = formData.alcohol ? parseFloat(formData.alcohol) : 0;

      // Calculate calories if not manually entered
      const autoCalories = Math.round(4 * protein + 4 * carbs + 9 * fat + 7 * alcohol);
      const finalCalories = formData.kcal ? parseFloat(formData.kcal) : autoCalories;

      // Use unified macro logging endpoint
      const payload = {
        userId,
        loggedAt,
        mealType: formData.glp1MealType || "unspecified",
        source: "manual" as const,
        nutrition: {
          calories: finalCalories,
          protein_g: protein,
          carbs_g: carbs,
          fat_g: fat,
        },
        meta: formData.glp1Duration ? { glp1Duration: formData.glp1Duration } : undefined,
        idempotencyKey: crypto.randomUUID(),
      };

      console.log("🔸 Quick Add payload:", payload);

      await apiRequest(`/api/macros/log`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // Refresh today's macros and history (match working system query keys)
      queryClient.invalidateQueries({
        queryKey: ["/api/users", userId, "macros", "today"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/users", userId, "macros-daily"],
      });

      // Trigger macro refresh event for real-time updates
      window.dispatchEvent(new Event("macros:updated"));

      toast({
        title: "Macros added successfully",
        description: "Your manual macro entry has been logged",
      });

      // Reset form and close modal
      setFormData({
        protein: "",
        carbs: "",
        fat: "",
        fiber: "",
        alcohol: "",
        kcal: "",
        glp1MealType: "",
        glp1Duration: "",
      });
      setModalOpen(false);

    } catch (error) {
      console.error("Failed to add macros:", error);
      toast({
        title: "Failed to add macros",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    // Allow only numbers and decimal points for macro fields
    if (field === "protein" || field === "carbs" || field === "fat" || field === "fiber" || field === "alcohol" || field === "kcal") {
      if (value === "" || /^\d*\.?\d*$/.test(value)) {
        setFormData(prev => ({ ...prev, [field]: value }));
      }
    } else {
      // For other fields like meal type or duration, just set the value
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const calculateEstimatedCalories = () => {
    const p = parseFloat(formData.protein) || 0;
    const c = parseFloat(formData.carbs) || 0;
    const f = parseFloat(formData.fat) || 0;
    const a = parseFloat(formData.alcohol) || 0;
    return Math.round(4 * p + 4 * c + 9 * f + 7 * a);
  };

  const dialogContent = (
    <DialogContent className="sm:max-w-md bg-black/90 backdrop-blur-xl border border-white/20 text-white">
      <DialogHeader>
        <DialogTitle className="text-white">Quick Add Macros</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="protein" className="text-white/80">
              Protein grams
            </Label>
            <Input
              id="protein"
              value={formData.protein}
              onChange={(e) => handleInputChange("protein", e.target.value)}
              placeholder="0"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              data-testid="input-protein"
            />
          </div>

          <div>
            <Label htmlFor="carbs" className="text-white/80">
              Carb grams
            </Label>
            <Input
              id="carbs"
              value={formData.carbs}
              onChange={(e) => handleInputChange("carbs", e.target.value)}
              placeholder="0"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              data-testid="input-carbs"
            />
          </div>

          <div>
            <Label htmlFor="fat" className="text-white/80">
              Fat grams
            </Label>
            <Input
              id="fat"
              value={formData.fat}
              onChange={(e) => handleInputChange("fat", e.target.value)}
              placeholder="0"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              data-testid="input-fat"
            />
          </div>

          <div>
            <Label htmlFor="alcohol" className="text-white/80">
              Alcohol grams
            </Label>
            <Input
              id="alcohol"
              value={formData.alcohol}
              onChange={(e) => handleInputChange("alcohol", e.target.value)}
              placeholder="0"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              data-testid="input-alcohol"
            />
          </div>

          <div>
            <Label htmlFor="fiber" className="text-white/80">
              Fiber grams <span className="text-white/50">(optional)</span>
            </Label>
            <Input
              id="fiber"
              value={formData.fiber}
              onChange={(e) => handleInputChange("fiber", e.target.value)}
              placeholder="0"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              data-testid="input-fiber"
            />
          </div>

          <div>
            <Label htmlFor="kcal" className="text-white/80">
              Calories (optional)
            </Label>
            <Input
              id="kcal"
              value={formData.kcal}
              onChange={(e) => handleInputChange("kcal", e.target.value)}
              placeholder={`~${calculateEstimatedCalories()}`}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              data-testid="input-calories"
            />
          </div>
        </div>

        {/* GLP-1 Specific Fields */}
        <div className="grid grid-cols-2 gap-4 pt-4">
          <div>
            <Label htmlFor="glp1MealType" className="text-white/80">
              Meal Type (GLP-1)
            </Label>
            <Input
              id="glp1MealType"
              value={formData.glp1MealType}
              onChange={(e) => handleInputChange("glp1MealType", e.target.value)}
              placeholder="e.g., Breakfast"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              data-testid="input-glp1-meal-type"
            />
          </div>

          <div>
            <Label htmlFor="glp1Duration" className="text-white/80">
              Duration (GLP-1)
            </Label>
            <Input
              id="glp1Duration"
              value={formData.glp1Duration}
              onChange={(e) => handleInputChange("glp1Duration", e.target.value)}
              placeholder="e.g., 1hr"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              data-testid="input-glp1-duration"
            />
          </div>
        </div>

        <div className="text-sm text-white/60">
          {!formData.kcal && "Calories will be auto-calculated: "}
          <span className="text-white/80">
            {calculateEstimatedCalories()} kcal estimated
          </span>
        </div>

        <div className="flex gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setModalOpen(false)}
            className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            data-testid="button-add-macros"
          >
            {isSubmitting ? "Adding..." : "Add Macros"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );

  if (trigger) {
    return (
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
      {dialogContent}
    </Dialog>
  );
}

// Named export for compatibility
export { QuickAddMacrosModal };