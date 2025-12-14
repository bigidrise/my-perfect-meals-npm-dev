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

export interface CulturalRecipePayload { 
  title: string; 
  story?: string; 
  servings: number; 
  ingredients: IngredientRow[]; 
  steps: StepRow[]; 
  dietaryTags?: string[]; 
  allergens?: string[]; 
  imageUrl?: string;
  cuisineCode?: string;
  menuSlug?: string;
}

interface CulturalRecipeEditorProps {
  open: boolean;
  onClose: () => void;
  onSaved: (recipe: any) => void;
  cuisineCode?: string;
  menuSlug?: string;
  initial?: Partial<CulturalRecipePayload>;
}

export function CulturalRecipeEditor({ 
  open, 
  onClose, 
  onSaved, 
  cuisineCode,
  menuSlug,
  initial 
}: CulturalRecipeEditorProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, control, handleSubmit, watch, reset, setValue } = useForm<CulturalRecipePayload>({
    defaultValues: {
      title: initial?.title || "",
      story: initial?.story || "",
      servings: initial?.servings || 4,
      ingredients: initial?.ingredients || [{ qty: 1, unit: "cup", item: "", notes: "" }],
      steps: initial?.steps || [{ text: "" }],
      dietaryTags: initial?.dietaryTags || [],
      allergens: initial?.allergens || [],
      imageUrl: initial?.imageUrl || "",
      cuisineCode: cuisineCode || "general",
      menuSlug: menuSlug || undefined,
    },
  });

  const ingredients = useFieldArray({ control, name: "ingredients" });
  const steps = useFieldArray({ control, name: "steps" });
  const servings = watch("servings");

  const onSubmit = async (data: CulturalRecipePayload) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(apiUrl("/api/cultural-cuisines/recipes"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          cuisineCode: cuisineCode || "general",
          menuSlug,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save cultural recipe");
      }

      const result = await response.json();
      
      toast({
        title: "Recipe Saved!",
        description: "Your cultural recipe has been saved successfully.",
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-purple-900 to-indigo-900 text-white border-purple-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <ChefHat className="w-6 h-6 text-purple-400" />
            Add Cultural Recipe
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-white font-medium">Recipe Title</Label>
              <Input
                {...register("title", { required: "Title is required" })}
                placeholder="e.g., Grandma's Tamales"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="servings" className="text-white font-medium">Servings</Label>
              <Input
                type="number"
                min="1"
                {...register("servings", { required: true, valueAsNumber: true })}
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
          </div>

          {/* Cuisine Context */}
          {cuisineCode && (
            <Card className="bg-purple-800/30 border-purple-600/30">
              <CardContent className="p-4">
                <div className="text-sm text-purple-200">
                  <strong>Cuisine:</strong> <span className="capitalize">{cuisineCode.replaceAll("-", " ")}</span>
                  {menuSlug && <> • <strong>Menu:</strong> {menuSlug}</>}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recipe Story */}
          <div className="space-y-2">
            <Label htmlFor="story" className="text-white font-medium">Recipe Story (Optional)</Label>
            <Textarea
              {...register("story")}
              placeholder="Share the story behind this recipe - family traditions, memories, or special occasions..."
              rows={3}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
            />
          </div>

          {/* Ingredients */}
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span>Ingredients</span>
                  <span className="text-sm text-white/60">({servings} servings)</span>
                </h3>
                <Button
                  type="button"
                  onClick={addIngredient}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Ingredient
                </Button>
              </div>
              
              <div className="space-y-3">
                {ingredients.fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-2">
                      <Input
                        type="number"
                        step="0.25"
                        placeholder="1"
                        {...register(`ingredients.${index}.qty`, { valueAsNumber: true })}
                        className="bg-white/10 border-white/20 text-white text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        placeholder="cup"
                        {...register(`ingredients.${index}.unit`)}
                        className="bg-white/10 border-white/20 text-white text-sm"
                      />
                    </div>
                    <div className="col-span-5">
                      <Input
                        placeholder="ingredient name"
                        {...register(`ingredients.${index}.item`)}
                        className="bg-white/10 border-white/20 text-white text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        placeholder="notes"
                        {...register(`ingredients.${index}.notes`)}
                        className="bg-white/10 border-white/20 text-white text-sm"
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

          {/* Cooking Steps */}
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Cooking Instructions</h3>
                <Button
                  type="button"
                  onClick={addStep}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Step
                </Button>
              </div>
              
              <div className="space-y-3">
                {steps.fields.map((field, index) => (
                  <div key={field.id} className="flex gap-3 items-start">
                    <div className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium mt-1">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <Textarea
                        placeholder={`Step ${index + 1}: Describe what to do...`}
                        {...register(`steps.${index}.text`)}
                        rows={2}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                      />
                    </div>
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

          {/* Photo Upload */}
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Recipe Photo (Optional)</h3>
              <TinyUploader
                onImageUploaded={(url) => setValue("imageUrl", url)}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Photo
              </TinyUploader>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button
              type="button"
              onClick={onClose}
              variant="ghost"
              className="text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
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