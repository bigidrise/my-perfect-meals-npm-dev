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
): string {
  if (quantity == null || quantity === "") return unit ?? "";

  const num = typeof quantity === "number" ? quantity : parseFloat(String(quantity));
  if (!Number.isFinite(num) || num <= 0) return unit ?? "";

  const lowerUnit = (unit ?? "").toLowerCase().trim();

  if (lowerUnit.includes("spray")) {
    return "1 can";
  }

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
