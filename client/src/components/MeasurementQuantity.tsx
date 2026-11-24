import { useMeasurementSystem } from "@/hooks/useMeasurementSystem";
import { useTranslation } from "react-i18next";
import { ingredientQuantity } from "@/lib/ingredientDisplay";

/** Recipe/list display only; never use its rounded text as an input or payload. */
export function MeasurementQuantity({ amount, unit }: {
  amount: string | number | null | undefined;
  unit?: string | null;
}) {
  const system = useMeasurementSystem();
  const { i18n } = useTranslation();
  return <>{ingredientQuantity(amount, unit, system, i18n.resolvedLanguage || i18n.language || "en")}</>;
}
