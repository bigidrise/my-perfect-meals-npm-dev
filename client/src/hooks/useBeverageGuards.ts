/**
 * useBeverageGuards — shared guard orchestrator for beverage builders.
 * Wraps safety, diet, and starch guard hooks in a single composable unit.
 * Used by BeverageCreator and AthleteBeverageCreator (and any future beverage wrapper).
 */
import { useSafetyGuardPrecheck } from "@/hooks/useSafetyGuardPrecheck";
import { useDietGuardPrecheck } from "@/hooks/useDietGuardPrecheck";
import { useStarchGuardPrecheck } from "@/hooks/useStarchGuardPrecheck";
import { useEffect } from "react";

export function useBeverageGuards(generatedBeverage: any) {
  const safety = useSafetyGuardPrecheck();
  const diet = useDietGuardPrecheck();
  const starch = useStarchGuardPrecheck();

  // Post-generation starch scan — runs whenever a new drink comes in
  useEffect(() => {
    if (!generatedBeverage) return;
    const ingredientTexts = (generatedBeverage.ingredients || [])
      .map((ing: any) => (typeof ing === "string" ? ing : ing?.name || ""))
      .filter(Boolean);
    starch.checkStarch(
      ingredientTexts.length
        ? ingredientTexts
        : [generatedBeverage.name || ""]
    );
  }, [generatedBeverage]);

  return { safety, diet, starch };
}
