import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";

interface CopyRecipeButtonProps {
  recipe: any;
}

export default function CopyRecipeButton({ recipe }: CopyRecipeButtonProps) {
  if (!recipe) return null;

  const title = recipe.name || "My Perfect Meal";

  const ingredientsText = recipe.ingredients
    ?.map((i: any) =>
      `• ${i.name}${
        i.amount ? ` — ${i.amount}${i.unit ? " " + i.unit : ""}` : ""
      }`
    )
    .join("\n") || "";

  const instructionsText = Array.isArray(recipe.instructions)
    ? recipe.instructions.map((step: string, index: number) => `${index + 1}. ${step}`).join("\n")
    : typeof recipe.instructions === "string"
      ? recipe.instructions
      : "";

  const fullText = `${title}\n\nIngredients:\n${ingredientsText}\n\nInstructions:\n${instructionsText}`;

  const handleCopy = async (e: any) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(fullText);

      const event = new CustomEvent("show-toast", {
        detail: {
          title: "Recipe Copied",
          description: `${recipe.name} has been copied to your clipboard.`,
        },
      });
      window.dispatchEvent(event);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  return (
    <Button
      size="sm"
      className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg active:scale-95 transition-all duration-200"
      onClick={handleCopy}
    >
      <Copy className="h-4 w-4 mr-1" />
      Copy Recipe
    </Button>
  );
}
