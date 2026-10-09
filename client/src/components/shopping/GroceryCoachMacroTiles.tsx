import React from "react";
import { groceryCoachCarbBreakdown } from "@shared/groceryCoachCarbs";

export interface GroceryCoachMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  starchyCarbs?: number | null;
  fibrousCarbs?: number | null;
}

export function GroceryCoachMacroTiles({ macros, servings = 1, labels }: { macros: GroceryCoachMacros; servings?: number; labels?: Record<string, string> }) {
  const { fibrousCarbs, starchyCarbs } = groceryCoachCarbBreakdown(macros);
  const tiles = [
    { label: "Calories", value: macros.calories, unit: "" },
    { label: "Protein", value: macros.protein, unit: "g" },
    { label: "Starchy Carbs", value: starchyCarbs, unit: "g" },
    { label: "Fat", value: macros.fat, unit: "g" },
    { label: "Fibrous Carbs", value: fibrousCarbs, unit: "g" },
  ];
  return (
    <div>
      <div data-testid="grocery-coach-macro-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        {tiles.map(({ label, value, unit }) => (
          <div key={label} style={{ gridColumn: label === "Fibrous Carbs" ? "1 / -1" : undefined, minWidth: 0, borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: 12, textAlign: "center" }}>
            <div style={{ color: "white", fontWeight: 700, fontSize: 18, lineHeight: 1 }}>{value == null ? "—" : `${Math.round(value)}${unit}`}</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 4, fontWeight: 500 }}>{labels?.[label] ?? label}</div>
          </div>
        ))}
      </div>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, margin: "8px 0 0", lineHeight: 1.4 }}>
        Per serving{servings > 1 ? ` • Recipe serves ${servings}` : ""}. Total carbs: {Math.round(macros.carbs)}g.{" "}
        {fibrousCarbs === null || starchyCarbs === null ? "Carb breakdown partly unavailable. " : "Estimated nutrition. "}
        {starchyCarbs !== null && fibrousCarbs !== null && macros.carbs > starchyCarbs + fibrousCarbs + 1 ? "Some total carbs are unclassified. " : ""}
        Fibrous carbs are not dietary fiber grams.
      </p>
    </div>
  );
}
