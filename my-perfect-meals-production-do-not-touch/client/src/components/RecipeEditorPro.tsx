import { useForm, useFieldArray } from "react-hook-form";
import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Plus, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TinyUploader } from "@/components/TinyUploader";
import TrashButton from "@/components/ui/TrashButton";

const IngredientSchema = z.object({
  qty: z.number().min(0.01, "Quantity required"),
  unit: z.string().min(1, "Unit required"),
  item: z.string().min(1, "Ingredient required"),
  notes: z.string().optional(),
});

const StepSchema = z.object({
  text: z.string().min(1, "Step text required"),
});

const RecipeSchema = z.object({
  title: z.string().min(2, "Recipe title required"),
  story: z.string().optional(),
  servings: z.number().int().min(1, "At least 1 serving"),
  ingredients: z.array(IngredientSchema).min(1, "At least 1 ingredient"),
  steps: z.array(StepSchema).min(1, "At least 1 step"),
  imageUrl: z.string().optional(),
});

type ContextType = "holiday" | "cultural";
type RecipeFormData = z.infer<typeof RecipeSchema>;

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (recipe: any) => void;
  
  context: ContextType;
  prefillCode?: string;     // "christmas" or "mexican"
  prefillMenuSlug?: string; // optional menu slug

  theme: {
    headerGradient: string;      // e.g., "from-orange-500 to-indigo-500"
    borderColor: string;         // e.g., "border-orange-500/30"
    accentColor: string;         // e.g., "text-orange-400"
    buttonGradient: string;      // e.g., "from-orange-600 to-orange-700"
    icon: React.ReactNode;
    title: string;               // "Add Family Recipe" or "Add Cultural Recipe"
    contextLabel: string;        // "Holiday" or "Cuisine"
  };

  endpoints?: {
    createUrl?: string;
    presignKind?: string;
  };
};

export function RecipeEditorPro({
  open, onClose, onSaved, context, prefillCode, prefillMenuSlug, theme, endpoints,
}: Props) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const isHoliday = context === "holiday";
  const createUrl = endpoints?.createUrl || (isHoliday
    ? "/api/holiday-feast/family-recipes"
    : "/api/cultural-cuisines/recipes"
  );
  const presignKind = endpoints?.presignKind || (isHoliday
    ? "family-recipe-photo"
    : "cultural-recipe-photo"
  );

  const { register, control, handleSubmit, watch, reset, setValue } = useForm<RecipeFormData>({
    resolver: zodResolver(RecipeSchema),
    defaultValues: {
      title: "",
      story: "",
      servings: 4,
      ingredients: [{ qty: 1, unit: "cup", item: "", notes: "" }],
      steps: [{ text: "" }],
      imageUrl: "",
    },
  });

  const ingredients = useFieldArray({ control, name: "ingredients" });
  const steps = useFieldArray({ control, name: "steps" });
  const servings = watch("servings");

  const onSubmit = async (data: RecipeFormData) => {
    setIsSubmitting(true);
    try {
      // Build context-appropriate payload
      const payload: any = {
        name: data.title,
        servings: data.servings,
        ingredients: data.ingredients,
        instructions: data.steps.map(s => s.text).join('\n'),
        story: data.story,
        photo_url: data.imageUrl,
      };

      if (isHoliday) {
        payload.holidayCode = prefillCode || "";
      } else {
        payload.cuisineCode = prefillCode || "";
        if (prefillMenuSlug) payload.menuSlug = prefillMenuSlug;
      }

      const response = await fetch(createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to save recipe");
      }

      const result = await response.json();
      
      toast({
        title: "Recipe Saved!",
        description: `Your ${theme.contextLabel.toLowerCase()} recipe has been saved successfully.`,
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
      <DialogContent className={`max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br ${theme.headerGradient} text-white ${theme.borderColor}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            {theme.icon}
            {theme.title}
          </DialogTitle>
          <DialogDescription className="text-white/80">
            Save a custom recipe to this {theme.contextLabel.toLowerCase()}
            {prefillMenuSlug ? " menu." : "."}
          </DialogDescription>
        </DialogHeader>

        {/* Context Display */}
        {prefillCode && (
          <Card className="bg-white/10 border-white/20 mb-4">
            <CardContent className="p-4">
              <div className="text-sm text-white/90">
                <strong>{theme.contextLabel}:</strong>{" "}
                <span className="capitalize">{prefillCode.replaceAll("-", " ")}</span>
                {prefillMenuSlug && <> • <strong>Menu:</strong> {prefillMenuSlug}</>}
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-white font-medium">Recipe Title</Label>
              <Input
                {...register("title")}
                placeholder="e.g., Grandma's Famous Cornbread"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="servings" className="text-white font-medium">Servings</Label>
              <Input
                type="number"
                min="1"
                {...register("servings", { valueAsNumber: true })}
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
          </div>

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
                <h3 className={`text-lg font-semibold text-white flex items-center gap-2`}>
                  <span>Ingredients</span>
                  <span className="text-sm text-white/60">({servings} servings)</span>
                </h3>
                <Button
                  type="button"
                  onClick={addIngredient}
                  size="sm"
                  className={`${theme.buttonGradient} hover:opacity-90`}
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
                  className={`${theme.buttonGradient} hover:opacity-90`}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Step
                </Button>
              </div>
              
              <div className="space-y-3">
                {steps.fields.map((field, index) => (
                  <div key={field.id} className="flex gap-3 items-start">
                    <div className={`${theme.buttonGradient} text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium mt-1`}>
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
                className={`${theme.buttonGradient} hover:opacity-90`}
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
              className={`bg-gradient-to-r ${theme.buttonGradient} hover:opacity-90`}
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