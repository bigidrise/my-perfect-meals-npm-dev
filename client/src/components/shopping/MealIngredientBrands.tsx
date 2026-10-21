import { useEffect, useRef, useState } from "react";
import { post } from "@/lib/api";
import type { GroceryIngredient } from "@/lib/groceryCoachPackagedIngredients";
import type { CatalogProductMatch } from "./GroceryStoreCoachSheet";
import ProductCatalogChoices from "./ProductCatalogChoices";

interface Props {
  ingredient: GroceryIngredient;
  servings: number;
  selectedLabel?: string;
  onSelect: (product: CatalogProductMatch | null) => void;
}

/** Existing Grocery Coach picker behavior; review-needed choices remain selectable here. */
export default function MealIngredientBrands({ ingredient, servings, selectedLabel, onSelect }: Props) {
  const [products, setProducts] = useState<CatalogProductMatch[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [excluded, setExcluded] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const active = useRef(true);
  const busy = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  async function lookup() {
    if (busy.current) return;
    setExpanded(true);
    setError("");
    busy.current = true;
    setLoading(true);
    try {
      const data = await post("/api/grocery-coach/product-advisor", {
        ingredients: [ingredient.item], mode: "find_product",
      });
      if (!active.current) return;
      if (!Array.isArray(data?.catalogMatches)) throw new Error("Invalid catalog response");
      setProducts(data.catalogMatches.slice(0, 3));
      setNotice(data.catalogNotice || "");
      setExcluded(data.excludedReasons || []);
    } catch {
      if (active.current) setError(`Couldn't look up brands for ${ingredient.item}. Try again. Your meal and quantities have not changed.`);
    } finally {
      busy.current = false;
      if (active.current) setLoading(false);
    }
  }

  const buttonStyle = { background: "transparent", color: "#fdba74", border: "1px solid #9a5425", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 12 } as const;
  return (
    <div style={{ width: "100%", fontSize: 12, lineHeight: 1.5 }}>
      <button style={buttonStyle} disabled={loading} onClick={() => {
        if (products && !error) setExpanded(!expanded);
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
        {products && <>
          <p>{notice || "Catalog information is not a guarantee of medical or allergen safety. Check the current package label."}</p>
          {!!excluded.length && <p>Excluded for known conflicts: {excluded.join(" ")}</p>}
          {!products.length && <p>No suitable catalog options were found. Your ingredient is unchanged. Try a more specific search in Find a Product.</p>}
          <ProductCatalogChoices products={products} selectedLabel={selectedLabel} onSelect={onSelect} />
          <p>Choosing a product changes only your shopping choice. Recipe quantities, servings, and nutrition remain unchanged; the finished meal has not been medically revalidated.</p>
        </>}
      </div>}
    </div>
  );
}
