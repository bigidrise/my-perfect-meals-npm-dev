import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

interface QuickAddMacrosModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  userId?: string;
}

export default function QuickAddMacrosModal({
  open,
  onOpenChange,
  trigger,
  userId = "00000000-0000-0000-0000-000000000001",
}: QuickAddMacrosModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined && onOpenChange !== undefined;
  const modalOpen = isControlled ? open : internalOpen;
  const setModalOpen = isControlled ? onOpenChange : setInternalOpen;

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    protein: "",
    starchyCarbs: "",
    fibrousCarbs: "",
    fat: "",
    alcohol: "",
    kcal: "",
    glp1MealType: "",
    glp1Duration: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const hasData = Object.values(formData).some((v) => v.trim() !== "");
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
      const loggedAt = new Date().toISOString();

      const protein = formData.protein ? parseFloat(formData.protein) : 0;
      const starchyCarbs = formData.starchyCarbs ? parseFloat(formData.starchyCarbs) : 0;
      const fibrousCarbs = formData.fibrousCarbs ? parseFloat(formData.fibrousCarbs) : 0;
      const fat = formData.fat ? parseFloat(formData.fat) : 0;
      const alcohol = formData.alcohol ? parseFloat(formData.alcohol) : 0;
      
      // Total carbs = starchy + fibrous (for backward compatibility)
      const totalCarbs = starchyCarbs + fibrousCarbs;

      // 🔧 FIX: detect single-macro quick-add intent
      const macroEntries = [
        { type: "protein", value: protein },
        { type: "starchyCarbs", value: starchyCarbs },
        { type: "fibrousCarbs", value: fibrousCarbs },
        { type: "fat", value: fat },
        { type: "alcohol", value: alcohol },
      ].filter((m) => m.value > 0);

      const quickAddMacro = macroEntries.length === 1 ? macroEntries[0] : null;

      // Calorie calculation: 4 cal per gram for all carbs (starchy + fibrous)
      const autoCalories = Math.round(
        4 * protein + 4 * totalCarbs + 9 * fat + 7 * alcohol,
      );
      const finalCalories = formData.kcal
        ? parseFloat(formData.kcal)
        : autoCalories;

      const payload = {
        userId,
        loggedAt,
        mealType: formData.glp1MealType || "unspecified",
        source: "manual" as const,

        // ✅ FIXED: explicit intent
        mode: quickAddMacro ? "quick-add" : "manual",
        macroType: quickAddMacro?.type,
        grams: quickAddMacro?.value,

        // New starchy/fibrous carb fields
        starchyCarbs,
        fibrousCarbs,

        nutrition: {
          calories: finalCalories,
          protein_g: protein,
          carbs_g: totalCarbs,
          fat_g: fat,
        },

        meta: formData.glp1Duration
          ? { glp1Duration: formData.glp1Duration }
          : undefined,

        idempotencyKey: crypto.randomUUID(),
      };

      await apiRequest(`/api/macros/log`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      queryClient.invalidateQueries({
        queryKey: ["/api/users", userId, "macros", "today"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/users", userId, "macros-daily"],
      });

      window.dispatchEvent(new Event("macros:updated"));

      toast({
        title: "Macros added successfully",
        description: "Your manual macro entry has been logged",
      });

      setFormData({
        protein: "",
        starchyCarbs: "",
        fibrousCarbs: "",
        fat: "",
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
    if (
      ["protein", "starchyCarbs", "fibrousCarbs", "fat", "alcohol", "kcal"].includes(field)
    ) {
      if (value === "" || /^\d*\.?\d*$/.test(value)) {
        setFormData((prev) => ({ ...prev, [field]: value }));
      }
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const calculateEstimatedCalories = () => {
    const p = parseFloat(formData.protein) || 0;
    const sc = parseFloat(formData.starchyCarbs) || 0;
    const fc = parseFloat(formData.fibrousCarbs) || 0;
    const f = parseFloat(formData.fat) || 0;
    const a = parseFloat(formData.alcohol) || 0;
    return Math.round(4 * p + 4 * (sc + fc) + 9 * f + 7 * a);
  };

  const dialogContent = (
    <DialogContent className="sm:max-w-md bg-black/90 backdrop-blur-xl border border-white/20 text-white">
      <DialogHeader>
        <DialogTitle>Quick Add Macros</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: "protein", label: "Protein grams" },
            { key: "starchyCarbs", label: "Starchy Carbs grams" },
            { key: "fibrousCarbs", label: "Fibrous Carbs grams" },
            { key: "fat", label: "Fat grams" },
            { key: "alcohol", label: "Alcohol grams" },
            { key: "kcal", label: "Calories" },
          ].map(({ key, label }) => (
              <div key={key}>
                <Label className="text-white/80">{label}</Label>
                <Input
                  value={(formData as any)[key]}
                  onChange={(e) =>
                    handleInputChange(key as any, e.target.value)
                  }
                  placeholder={
                    key === "kcal" ? `~${calculateEstimatedCalories()}` : "0"
                  }
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
            ),
          )}
        </div>

        <div className="flex gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setModalOpen(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? "Adding..." : "Add Macros"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );

  return (
    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      {dialogContent}
    </Dialog>
  );
}

export { QuickAddMacrosModal };
