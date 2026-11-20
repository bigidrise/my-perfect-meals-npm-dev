import { useTranslation } from "react-i18next";
import { convertServingDisplay, parseMeasurementNumber } from "@shared/units";
import { useMeasurementSystem } from "@/hooks/useMeasurementSystem";

/** Original label is always primary. No serving/package/basis inference. */
export function ProductLabelQuantity({ label }: { label: string }) {
  const system = useMeasurementSystem();
  const { t } = useTranslation("measurementPreferences");
  const match = label.match(/^([\d.,/\s¼½¾⅓⅔⅛⅜⅝⅞]+)\s*(fl\.? oz|oz|lbs?|g|kg|ml|l)$/i);
  let equivalent: string | null = null;
  if (match && parseMeasurementNumber(match[1].trim()) !== null) {
    const quantity = match[1].trim();
    const original = `${quantity} ${match[2]}`;
    const converted = convertServingDisplay(quantity, match[2], system);
    if (converted !== original) equivalent = converted;
  }
  return <span>{label}{equivalent && <span className="block text-xs text-white/50">
    ≈ {t("equivalent", { quantity: equivalent })}
  </span>}</span>;
}
