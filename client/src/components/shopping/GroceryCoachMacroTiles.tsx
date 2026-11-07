import React from "react";
import { groceryCoachCarbBreakdown } from "@shared/groceryCoachCarbs";
import type { GroceryCoachCarbReview } from "@shared/groceryCoachCarbReview";

export function GroceryCoachCarbStatus({ review, ingredients }: { review?: GroceryCoachCarbReview; ingredients?: any[] }) {
  // A later ingredient edit must not inherit verification from the old recipe.
  const identity = (row: any) => JSON.stringify([
    String(row?.name ?? row?.item ?? "").trim().toLowerCase(),
    String(row?.quantity ?? row?.amount ?? "").trim(),
    String(row?.unit ?? "").trim().toLowerCase(),
  ]);
  const evidenceMatches = !review?.evidence || !ingredients ||
    JSON.stringify(ingredients.map(identity).sort()) === JSON.stringify(review.evidence.map(identity).sort());
  return <p role="status" className="mt-2 text-xs text-white/70" data-testid="grocery-coach-carb-status">
    {review?.status === "validated" && evidenceMatches
      ? "Carbohydrate breakdown verified from ingredient nutrition data."
      : "Carbohydrate breakdown unresolved — nutrition review incomplete. Available estimates are retained; no missing values have been invented."}
  </p>;
}

export interface GroceryCoachMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  starchyCarbs?: number | null;
  fibrousCarbs?: number | null;
}

export function GroceryCoachMacroTiles({ macros, servings = 1, labels, showReview = false, review, ingredients }: { macros: GroceryCoachMacros; servings?: number; labels?: Record<string, string>; showReview?: boolean; review?: GroceryCoachCarbReview; ingredients?: any[] }) {
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
      {showReview && <GroceryCoachCarbStatus
        ingredients={ingredients}
        review={starchyCarbs !== null && fibrousCarbs !== null ? review : undefined} />}
    </div>
  );
}
