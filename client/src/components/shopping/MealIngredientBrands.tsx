import { useEffect, useRef, useState } from "react";
import { post } from "@/lib/api";
import { recipeShoppingQuantity, type GroceryIngredient } from "@/lib/groceryCoachPackagedIngredients";
import type { IngredientScanResult } from "@/lib/photoIngredientCapture";
import { IngredientIntelligenceSheet } from "@/components/biometrics/IngredientIntelligenceSheet";

interface Props {
  ingredient: GroceryIngredient;
  servings: number;
  selectedLabel?: string;
  onSelect: (product: null) => void;
  onAddProduct: (name: string, result: IngredientScanResult) => void;
}

/** Reuse Product Scan guidance, scoped to this recipe ingredient. */
export default function MealIngredientBrands({ ingredient, servings, selectedLabel, onSelect, onAddProduct }: Props) {
  const [analysis, setAnalysis] = useState<IngredientScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const generation = useRef(0);
  const busy = useRef(false);
  useEffect(() => {
    generation.current += 1;
    setAnalysis(null);
    setExpanded(false);
    setError("");
    setLoading(false);
    busy.current = false;
    return () => { generation.current += 1; };
  }, [ingredient.item]);

  async function lookup() {
    if (busy.current) return;
    setExpanded(true);
    setError("");
    busy.current = true;
    setLoading(true);
    const requestGeneration = generation.current;
    try {
      const data = await post("/api/biometrics/ingredient-scan-by-name", {
        productName: ingredient.item,
      });
      if (requestGeneration !== generation.current) return;
      if (!data?.ok || data?.result?.analysisMethod !== "by_name" || data.result.fallbackUsed) {
        throw new Error("Product analysis unavailable");
      }
      setAnalysis(data.result);
    } catch {
      if (requestGeneration === generation.current) setError(`Couldn't look up brands for ${ingredient.item}. Try again. Your meal and quantities have not changed.`);
    } finally {
      if (requestGeneration === generation.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }

  const buttonStyle = { background: "transparent", color: "#fdba74", border: "1px solid #9a5425", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 12 } as const;
  return (
    <div style={{ width: "100%", fontSize: 12, lineHeight: 1.5 }}>
      <button style={buttonStyle} disabled={loading} onClick={() => {
        if (analysis && !error) setExpanded(!expanded);
        else void lookup();
      }} aria-expanded={expanded}>
        {loading ? "Finding brands…" : "Find brands"}
      </button>
      {selectedLabel && <div style={{ color: "#fdba74" }}>
        Shopping choice: {selectedLabel}{" "}
        <button style={buttonStyle} onClick={() => onSelect(null)}>Clear choice</button>
      </div>}
      {expanded && <div style={{ marginTop: 8, color: "#ddd" }}>
        <p>Recipe amount: {ingredient.quantity} {ingredient.unit} · {servings} {servings === 1 ? "serving" : "servings"}. Package counts are not calculated.</p>
        {error && <p role="alert" style={{ color: "#fca5a5" }}>{error}</p>}
        {analysis && recipeShoppingQuantity(ingredient.quantity) === null &&
          <p role="alert">Review the recipe amount before adding a product. No package quantity has been assumed.</p>}
        {analysis && <IngredientIntelligenceSheet
          key={ingredient.item}
          open embedded result={analysis}
          saveSource="grocery-coach"
          onClose={() => setExpanded(false)}
          onAddProduct={recipeShoppingQuantity(ingredient.quantity) === null ? undefined : (name) => onAddProduct(name, analysis)}
        />}
      </div>}
    </div>
  );
}
