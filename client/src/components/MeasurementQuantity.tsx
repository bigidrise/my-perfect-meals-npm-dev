import { useMeasurementSystem } from "@/hooks/useMeasurementSystem";
import { formatQuantity } from "@/lib/formatQuantity";
import { useTranslation } from "react-i18next";
import { ingredientQuantity } from "@/lib/ingredientDisplay";
import { localizedIngredientDisplayEnabled } from "@/lib/ingredientDisplayGate";

/** Recipe/list display only; never use its rounded text as an input or payload. */
export function MeasurementQuantity({ amount, unit }: {
  amount: string | number | null | undefined;
  unit?: string | null;
}) {
  const system = useMeasurementSystem();
  const { i18n } = useTranslation();
  return <>{localizedIngredientDisplayEnabled
    ? ingredientQuantity(amount, unit, system, i18n.resolvedLanguage || i18n.language || "en")
    : formatQuantity(amount, unit, system)}</>;
}
