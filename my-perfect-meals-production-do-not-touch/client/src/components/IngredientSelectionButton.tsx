import { Button } from "@/components/ui/button";

interface IngredientSelectionButtonProps {
  ingredient: string;
  selectedIngredients: string[];
  toggleIngredient: (ingredient: string) => void;
}

export default function IngredientSelectionButton({
  ingredient,
  selectedIngredients,
  toggleIngredient
}: IngredientSelectionButtonProps) {
  const isSelected = selectedIngredients.includes(ingredient);
  
  return (
    <Button
      variant={isSelected ? "default" : "outline"}
      size="sm"
      onClick={() => toggleIngredient(ingredient)}
      className={`w-full h-auto p-3 text-sm ${
        isSelected
          ? 'bg-green-600 hover:bg-green-700 text-white border-green-600'
          : 'bg-white hover:bg-green-50 text-green-800 border-green-200 hover:border-green-300'
      }`}
    >
      {ingredient}
    </Button>
  );
}