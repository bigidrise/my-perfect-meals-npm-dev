import { convertServingDisplay, parseMeasurementNumber, type MeasurementSystem } from "@shared/units";

const FRACTION_MAP: Record<string, string> = {
  "0.25": "¼",
  "0.33": "⅓",
  "0.5": "½",
  "0.67": "⅔",
  "0.75": "¾",
};

const FRACTION_TOLERANCE = 0.01;

function toFraction(decimal: number): string | null {
  for (const [key, glyph] of Object.entries(FRACTION_MAP)) {
    if (Math.abs(decimal - parseFloat(key)) < FRACTION_TOLERANCE) {
      return glyph;
    }
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

  let display: string;
  if (frac < FRACTION_TOLERANCE) {
    display = String(whole);
  } else {
    const glyph = toFraction(frac);
    if (glyph) {
      display = whole > 0 ? `${whole}${glyph}` : glyph;
    } else {
      display = String(Math.round(finalQty * 100) / 100);
    }
  }

  return finalUnit ? `${display} ${finalUnit}` : display;
}
