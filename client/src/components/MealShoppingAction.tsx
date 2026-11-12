import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMealShopping } from "@/hooks/useMealShopping";
import { canonicalShoppingRecipe, shoppingAccount } from "@/lib/mealShoppingApi";
import { selectionForRecipe, stableShoppingJson } from "@shared/mealShoppingSelection";
import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { sendSavedMealToShopping } from "@/lib/savedMealShopping";
import { shoppingMetadataEnabled } from "@/lib/shoppingMetadataGate";
import { useToast } from "@/hooks/use-toast";

export default function MealShoppingAction({ recipe, source, options, addAndView = false }: {
  recipe: any; source: string;
  options?: { recipeYield?: number; shoppingServings?: number; subjectKind?: "human" | "pet" };
  addAndView?: boolean;
}) {
  const transfer = useMealShopping();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const savedSignature = useRef("");
  const canonical = canonicalShoppingRecipe(recipe, options?.recipeYield);
  const { selection, reason } = selectionForRecipe(canonical, source, options);
  const signature = stableShoppingJson(selection);
  const lastSent = useRef("");
  const lastResultCurrent = lastSent.current === signature;
  const update = lastResultCurrent && transfer.result?.committed === false;
  const available = transfer.available || addAndView && Boolean(shoppingAccount()) && transfer.checked && transfer.legacyAllowed;
  const availabilityReason = available ? undefined : transfer.reason;
  const pending = saving || transfer.pending;
  const label = pending ? "Saving…" : update ? "Update Shopping"
    : addAndView && savedSignature.current === signature ? "Added"
    : lastResultCurrent && transfer.result?.committed ? "Added" : "Shopping";
  async function onShopping() {
    if (!selection || !available || lock.current) return;
    lastSent.current = signature;
    if (!addAndView) { void transfer.send([selection], update); return; }
    lock.current = true; setSaving(true); setError("");
    try {
      if (transfer.available) {
        const response = await transfer.send([selection], update);
        if (!response?.committed) return;
      } else {
        await sendSavedMealToShopping(selection, shoppingMetadataEnabled);
      }
      savedSignature.current = signature;
      toast({ title: "Saved to Shopping List", description: `${selection.recipeName} ingredients were added.` });
      setLocation("/shopping-list-v2?from=saved-meals");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Shopping was not saved. Please try again.");
    } finally {
      lock.current = false; setSaving(false);
    }
  }
  return <div data-meal-action="shopping" className="min-w-0">
    <Button type="button" className="w-full min-h-[44px]" disabled={pending || !available || !selection || addAndView && savedSignature.current === signature}
      aria-label={`${label}: ${recipe?.name || recipe?.recipeName || recipe?.title || "recipe"}`}
      title={reason || availabilityReason}
      onClick={onShopping}>
      <ShoppingCart className="h-4 w-4 mr-1 shrink-0" />{label}
    </Button>
    {(reason || error || !available && transfer.checked && availabilityReason || lastResultCurrent && transfer.message) &&
      <p role="status" className="mt-1 text-xs text-white/70 break-words">
        {reason || error || !available && availabilityReason || (lastResultCurrent ? transfer.message : "")}
      </p>}
  </div>;
}
