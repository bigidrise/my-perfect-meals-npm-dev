import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Meal } from "@/components/MealCard";

interface ManualMealModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (meal: Meal) => void;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function ManualMealModal({ open, onClose, onSave }: ManualMealModalProps) {
  const [title, setTitle] = React.useState("");
  const [ingredients, setIngredients] = React.useState("");
  const [instructions, setInstructions] = React.useState("");
  const [calories, setCalories] = React.useState("");
  const [protein, setProtein] = React.useState("");
  const [carbs, setCarbs] = React.useState("");
  const [fat, setFat] = React.useState("");

  const handleSave = () => {
    if (!title.trim()) return;

    // Parse ingredients (one per line, format: "item - amount")
    const parsedIngredients = ingredients.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const parts = line.split(' - ');
        return {
          item: parts[0]?.trim() || line.trim(),
          amount: parts[1]?.trim() || "1 serving"
        };
      });

    // Parse instructions (one per line)
    const parsedInstructions = instructions.split('\n')
      .filter(line => line.trim());

    // Stable ID based on meal content
    const stableId = simpleHash(`manual_${title.trim()}_${ingredients}`);
    const meal: Meal = {
      id: `manual_${stableId.toString(36)}`,
      title: title.trim(),
      servings: 1,
      ingredients: parsedIngredients,
      instructions: parsedInstructions,
      nutrition: {
        calories: parseInt(calories) || 0,
        protein: parseInt(protein) || 0,
        carbs: parseInt(carbs) || 0,
        fat: parseInt(fat) || 0
      },
      badges: []
    };

    onSave(meal);
    handleClose();
  };

  const handleClose = () => {
    setTitle("");
    setIngredients("");
    setInstructions("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Custom Meal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Meal Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter meal name"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>

          <div>
            <Label htmlFor="ingredients">Ingredients (one per line, format: "item - amount")</Label>
            <Textarea
              id="ingredients"
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              placeholder="chicken breast - 6 oz&#10;olive oil - 1 tbsp&#10;salt - 1/2 tsp"
              className="bg-zinc-800 border-zinc-700 text-white min-h-[100px]"
            />
          </div>

          <div>
            <Label htmlFor="instructions">Instructions (one per line)</Label>
            <Textarea
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Heat oil in pan over medium heat&#10;Season chicken with salt&#10;Cook 6-7 minutes per side until done"
              className="bg-zinc-800 border-zinc-700 text-white min-h-[100px]"
            />
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label htmlFor="calories">Calories</Label>
              <Input
                id="calories"
                type="number"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="450"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div>
              <Label htmlFor="protein">Protein grams</Label>
              <Input
                id="protein"
                type="number"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                placeholder="35"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div>
              <Label htmlFor="carbs">Carb grams</Label>
              <Input
                id="carbs"
                type="number"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                placeholder="12"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div>
              <Label htmlFor="fat">Fat grams</Label>
              <Input
                id="fat"
                type="number"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                placeholder="18"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Add Meal
            </Button>
            <Button variant="ghost" onClick={handleClose} className="text-white/80 hover:bg-white/10">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}