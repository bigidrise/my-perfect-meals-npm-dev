import { groceryCoachCarbBreakdown } from "@shared/groceryCoachCarbs";

export interface GroceryCoachMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  starchyCarbs?: number | null;
  fibrousCarbs?: number | null;
}

export function GroceryCoachMacroTiles({ macros }: { macros: GroceryCoachMacros }) {
  const { fibrousCarbs } = groceryCoachCarbBreakdown(macros);
  const tiles = [
    { label: "Calories", value: macros.calories, unit: "" },
    { label: "Protein", value: macros.protein, unit: "g" },
    { label: "Total Carbs", value: macros.carbs, unit: "g" },
    { label: "Fat", value: macros.fat, unit: "g" },
    { label: "Fibrous Carbs", value: fibrousCarbs, unit: "g" },
  ];
  return (
    <div>
      <div data-testid="grocery-coach-macro-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        {tiles.map(({ label, value, unit }) => (
          <div key={label} style={{ gridColumn: label === "Fibrous Carbs" ? "1 / -1" : undefined, minWidth: 0, borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: 12, textAlign: "center" }}>
            <div style={{ color: "white", fontWeight: 700, fontSize: 18, lineHeight: 1 }}>{value == null ? "—" : `${Math.round(value)}${unit}`}</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 4, fontWeight: 500 }}>{label}</div>
          </div>
        ))}
      </div>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, margin: "8px 0 0", lineHeight: 1.4 }}>
        {fibrousCarbs === null ? "Fibrous carb breakdown unavailable for this meal. " : "Estimated nutrition. "}
        Fibrous carbs are not dietary fiber grams.
      </p>
    </div>
  );
}
