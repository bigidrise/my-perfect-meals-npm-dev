import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMealShopping } from "@/hooks/useMealShopping";
import { canonicalShoppingRecipe } from "@/lib/mealShoppingApi";
import { selectionForRecipe, stableShoppingJson } from "@shared/mealShoppingSelection";
import { useRef } from "react";

export default function MealShoppingAction({ recipe, source, options }: {
  recipe: any; source: string;
  options?: { recipeYield?: number; shoppingServings?: number; subjectKind?: "human" | "pet" };
}) {
  const transfer = useMealShopping();
  const canonical = canonicalShoppingRecipe(recipe, options?.recipeYield);
  const { selection, reason } = selectionForRecipe(canonical, source, options);
  const signature = stableShoppingJson(selection);
  const lastSent = useRef("");
  const lastResultCurrent = lastSent.current === signature;
  const update = lastResultCurrent && transfer.result?.committed === false;
  const label = transfer.pending ? "Saving…" : update ? "Update Shopping"
    : lastResultCurrent && transfer.result?.committed ? "Added" : "Shopping";
  return <div data-meal-action="shopping" className="min-w-0">
    <Button type="button" className="w-full min-h-[44px]" disabled={transfer.pending || !transfer.available || !selection}
      aria-label={`${label}: ${recipe?.name || recipe?.recipeName || recipe?.title || "recipe"}`}
      title={reason || transfer.reason}
      onClick={() => { if (selection) { lastSent.current = signature; void transfer.send([selection], update); } }}>
      <ShoppingCart className="h-4 w-4 mr-1 shrink-0" />{label}
    </Button>
    {(reason || !transfer.available && transfer.checked && transfer.reason || lastResultCurrent && transfer.message) &&
      <p role="status" className="mt-1 text-xs text-white/70 break-words">
        {reason || !transfer.available && transfer.reason || (lastResultCurrent ? transfer.message : "")}
      </p>}
  </div>;
}
