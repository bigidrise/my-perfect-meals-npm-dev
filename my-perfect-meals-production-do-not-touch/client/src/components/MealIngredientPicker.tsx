
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2 } from "lucide-react";

interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
}

interface MealIngredientPickerProps {
  ingredients: Ingredient[];
  onChange: (ingredients: Ingredient[]) => void;
}

export default function MealIngredientPicker({
  ingredients,
  onChange,
}: MealIngredientPickerProps) {
  const [newIngredient, setNewIngredient] = useState({
    name: "",
    quantity: 0,
    unit: "g",
  });

  const handleAdd = () => {
    if (newIngredient.name && newIngredient.quantity > 0) {
      onChange([...(ingredients || []), newIngredient]);
      setNewIngredient({ name: "", quantity: 0, unit: "g" });
    }
  };

  const handleRemove = (index: number) => {
    onChange((ingredients || []).filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <input
          type="text"
          placeholder="Ingredient name"
          value={newIngredient.name}
          onChange={(e) =>
            setNewIngredient({ ...newIngredient, name: e.target.value })
          }
          className="col-span-1 px-3 py-2 border rounded"
        />
        <input
          type="number"
          placeholder="Qty"
          value={newIngredient.quantity || ""}
          onChange={(e) =>
            setNewIngredient({
              ...newIngredient,
              quantity: parseFloat(e.target.value) || 0,
            })
          }
          className="px-3 py-2 border rounded"
        />
        <input
          type="text"
          placeholder="Unit"
          value={newIngredient.unit}
          onChange={(e) =>
            setNewIngredient({ ...newIngredient, unit: e.target.value })
          }
          className="px-3 py-2 border rounded"
        />
      </div>

      <Button onClick={handleAdd} className="w-full">
        Add Ingredient
      </Button>

      <div className="space-y-2">
        {(ingredients || []).map((ingredient, index) => (
          <Card key={index} className="p-3">
            <div className="flex items-center justify-between">
              <span>
                {ingredient.quantity} {ingredient.unit} {ingredient.name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
