import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { useMeasurementSystem } from "@/hooks/useMeasurementSystem";
import { ingredientLine, type DisplayIngredient } from "@/lib/ingredientDisplay";
import { localizedIngredientDisplayEnabled } from "@/lib/ingredientDisplayGate";

/** Shared by cards, Favorites and cooking views; never modifies recipe data. */
export function IngredientDisplay({ ingredient, legacyText }: {
  ingredient: DisplayIngredient; legacyText: ReactNode;
}) {
  return localizedIngredientDisplayEnabled
    ? <LocalizedIngredient ingredient={ingredient} />
    : <>{legacyText}</>;
}

function LocalizedIngredient({ ingredient }: { ingredient: DisplayIngredient }) {
  const { i18n } = useTranslation();
  const system = useMeasurementSystem();
  return <>{ingredientLine(ingredient, system, i18n.resolvedLanguage || i18n.language || "en")}</>;
}
