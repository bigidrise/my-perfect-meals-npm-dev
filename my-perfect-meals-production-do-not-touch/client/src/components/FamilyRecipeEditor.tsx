import { useForm, useFieldArray } from "react-hook-form";
import { useState } from "react";
import { apiUrl } from '@/lib/resolveApiBase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Plus, Save, ChefHat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TinyUploader } from "@/components/TinyUploader";
import TrashButton from "@/components/ui/TrashButton";

export type IngredientRow = { 
  qty: number; 
  unit: string; 
  item: string; 
  notes?: string 
};

export type StepRow = { 
  text: string 
};

export interface FamilyRecipePayload { 
  title: string; 
  story?: string; 
  servings: number; 
  ingredients: IngredientRow[]; 
  steps: StepRow[]; 
  dietaryTags?: string[]; 
  allergens?: string[]; 
  imageUrl?: string 
}

interface FamilyRecipeEditorProps {
  open: boolean;
  onClose: () => void;
  onSaved: (recipe: any) => void;
  initial?: Partial<FamilyRecipePayload>;
}

export function FamilyRecipeEditor({ 
  open, 
  onClose, 
  onSaved, 
  initial 
}: FamilyRecipeEditorProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, control, handleSubmit, watch, reset, setValue } = useForm<FamilyRecipePayload>({
    defaultValues: {
      title: initial?.title || "",
      story: initial?.story || "",
      servings: initial?.servings || 4,
      ingredients: initial?.ingredients || [{ qty: 1, unit: "cup", item: "", notes: "" }],
      steps: initial?.steps || [{ text: "" }],
      dietaryTags: initial?.dietaryTags || [],
      allergens: initial?.allergens || [],
      imageUrl: initial?.imageUrl || "",
    },
  });

  const ingredients = useFieldArray({ control, name: "ingredients" });
  const steps = useFieldArray({ control, name: "steps" });
  const servings = watch("servings");

  const onSubmit = async (data: FamilyRecipePayload) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(apiUrl("/api/family-recipes"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to save family recipe");
      }

      const result = await response.json();
      
      toast({
        title: "Recipe Saved!",
        description: "Your family recipe has been saved successfully.",
      });

      onSaved({ ...data, id: result.id });
      reset();
      onClose();
    } catch (error) {
      console.error("Error saving recipe:", error);
      toast({
        title: "Error",
        description: "Failed to save recipe. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addIngredient = () => {
    ingredients.append({ qty: 1, unit: "cup", item: "", notes: "" });
  };

  const addStep = () => {
    steps.append({ text: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-900 to-indigo-900 text-white border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <ChefHat className="w-6 h-6 text-orange-400" />
            Add Family Recipe
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-white font-medium">Recipe Title</Label>
              <Input
                id="title"
                {...register("title", { required: true })}
                placeholder="My Famous Dish"
                className="bg-slate-800 border-slate-600 text-white placeholder-slate-400"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="servings" className="text-white font-medium">Servings</Label>
              <Input
                id="servings"
                type="number"
                min="1"
                max="100"
                {...register("servings", { required: true, valueAsNumber: true })}
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
          </div>

          {/* Story */}
          <div className="space-y-2">
            <Label htmlFor="story" className="text-white font-medium">Recipe Story (Optional)</Label>
            <Textarea
              id="story"
              {...register("story")}
              placeholder="Tell the story behind this recipe..."
              rows={3}
              className="bg-slate-800 border-slate-600 text-white placeholder-slate-400 resize-none"
            />
          </div>

          {/* Image Upload */}
          <TinyUploader 
            value={watch("imageUrl")} 
            onChange={(url) => setValue("imageUrl", url, { shouldDirty: true })} 
          />

          {/* Ingredients */}
          <Card className="bg-slate-800/50 border-slate-600">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Ingredients</h3>
                <Button
                  type="button"
                  onClick={addIngredient}
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
              
              <div className="space-y-3">
                {ingredients.fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-2">
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="1"
                        {...register(`ingredients.${index}.qty`, { valueAsNumber: true })}
                        className="bg-slate-700 border-slate-600 text-white text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        placeholder="cup"
                        {...register(`ingredients.${index}.unit`)}
                        className="bg-slate-700 border-slate-600 text-white text-sm"
                      />
                    </div>
                    <div className="col-span-6">
                      <Input
                        placeholder="ingredient name"
                        {...register(`ingredients.${index}.item`)}
                        className="bg-slate-700 border-slate-600 text-white text-sm"
                      />
                    </div>
                    <div className="col-span-1">
                      <TrashButton
                        size="sm"
                        onClick={() => ingredients.remove(index)}
                        disabled={ingredients.fields.length === 1}
                        ariaLabel="Remove ingredient"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card className="bg-slate-800/50 border-slate-600">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Instructions</h3>
                <Button
                  type="button"
                  onClick={addStep}
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Step
                </Button>
              </div>
              
              <div className="space-y-3">
                {steps.fields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 items-start">
                    <div className="flex-shrink-0 w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center text-white text-sm font-bold mt-1">
                      {index + 1}
                    </div>
                    <Textarea
                      {...register(`steps.${index}.text`)}
                      placeholder="Describe this step..."
                      rows={2}
                      className="flex-1 bg-slate-700 border-slate-600 text-white placeholder-slate-400 resize-none"
                    />
                    <TrashButton
                      size="sm"
                      onClick={() => steps.remove(index)}
                      disabled={steps.fields.length === 1}
                      ariaLabel="Remove step"
                      className="mt-1"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-medium"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting ? "Saving..." : "Save Recipe"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}