// Friendly display for amounts like "340 g Greek yogurt" => "≈ 12 oz, ≈ 1 3/8 cups"
const OZ_PER_G = 1 / 28.349523125;

function roundTo(n: number, decimals = 1) {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

function toEighths(v: number) {
  const whole = Math.floor(v);
  const frac = Math.round((v - whole) * 8); // eighths
  const map = ["", "1/8","1/4","3/8","1/2","5/8","3/4","7/8"];
  const fracStr = map[frac] ?? "";
  return whole > 0 ? `${whole}${fracStr ? " " + fracStr : ""}` : (fracStr || "0");
}

// Density map (g per cup). Extend as needed.
const DENSITY_G_PER_CUP: Record<string, number> = {
  "greek yogurt": 245, // typical
  "plain greek yogurt": 245,
  "yogurt": 245,
};

function guessKey(name?: string) {
  if (!name) return "";
  const s = name.toLowerCase();
  if (s.includes("greek") && s.includes("yogurt")) return "greek yogurt";
  if (s.includes("yogurt")) return "yogurt";
  return "";
}

export function prettyAmount(amount: number, unit: string, ingredientName?: string): string {
  if (!Number.isFinite(amount)) return `${amount} ${unit}`;

  // Only convert grams → oz/cups. Keep tbsp/tsp/etc as-is.
  if (unit.toLowerCase() !== "g") return `${amount} ${unit}`;

  const oz = roundTo(amount * OZ_PER_G, 1); // 340 g ≈ 12.0 oz

  const key = guessKey(ingredientName);
  let cupsStr = "";
  if (key && DENSITY_G_PER_CUP[key]) {
    const cups = amount / DENSITY_G_PER_CUP[key]; // e.g., 340 / 245 ≈ 1.3878
    cupsStr = `, ≈ ${toEighths(cups)} cups`;
  }

  return `≈ ${oz} oz${cupsStr}`;
}