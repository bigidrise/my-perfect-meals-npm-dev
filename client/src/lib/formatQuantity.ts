import { convertServingDisplay, parseMeasurementNumber, type MeasurementSystem } from "@shared/units";

const FRACTIONS: ReadonlyArray<readonly [number, string]> = [
  [1 / 8, "⅛"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [3 / 8, "⅜"],
  [1 / 2, "½"],
  [5 / 8, "⅝"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [7 / 8, "⅞"],
];

function toFraction(decimal: number): string | null {
  for (const [value, glyph] of FRACTIONS) {
    if (Math.abs(decimal - value) < 1e-10) return glyph;
  }
  return null;
}

export function formatQuantity(
  quantity: number | string | undefined | null,
  unit: string | undefined | null,
  system?: MeasurementSystem,
): string {
  if (quantity == null || quantity === "") return unit ?? "";

  const original = `${quantity} ${unit ?? ""}`.trim();
  const num = parseMeasurementNumber(quantity);
  if (num === null || num < 0) return original;
  if (system) {
    const converted = convertServingDisplay(quantity, unit ?? "", system);
    if (converted !== original) return converted;
  }

  const lowerUnit = (unit ?? "").toLowerCase().trim();

  let finalQty = num;
  let finalUnit = unit ?? "";

  if (
    (lowerUnit === "tsp" || lowerUnit === "teaspoon" || lowerUnit === "teaspoons") &&
    finalQty >= 3
  ) {
    finalQty = finalQty / 3;
    finalUnit = "tbsp";
  }

  const whole = Math.floor(finalQty);
  const frac = finalQty - whole;

  const glyph = toFraction(frac);
  const display = glyph
    ? (whole > 0 ? `${whole}${glyph}` : glyph)
    : String(Number(finalQty.toPrecision(15)));

  return finalUnit ? `${display} ${finalUnit}` : display;
}
