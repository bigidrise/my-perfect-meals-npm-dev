export type ParsedMacros = { protein?: number; carbs?: number; fat?: number; calories?: number };

const num = (v?: string | number | null) => {
  if (v == null) return undefined;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};

export function parseMacrosFromText(input: string): ParsedMacros {
  const out: ParsedMacros = {};
  if (!input) return out;

  // Decode URL-encoded text (fixes mobile clipboard issue)
  let decodedInput = input;
  try {
    // Check if input contains URL encoding like %20, %3A, etc.
    if (/%[0-9A-F]{2}/i.test(input)) {
      decodedInput = decodeURIComponent(input);
    }
  } catch (e) {
    // If decoding fails, use original input
    decodedInput = input;
  }

  const text = decodedInput.replace(/\r/g, "").toLowerCase();

  const pick = (keys: string[]) => {
    const pattern = new RegExp(
      `(?:^|\\n)\\s*(?:${keys.map(k => k.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")).join("|")})\\s*[:=\\-]?\\s*([\\d,\\.\\-]+)`,
      "i"
    );
    const m = text.match(pattern);
    return m ? num(m[1]) : undefined;
  };

  out.protein = pick(["protein", "prot", "p"]) ?? undefined;
  out.carbs = pick(["carbs", "carb", "c"]) ?? undefined;
  out.fat = pick(["fat", "f"]) ?? undefined;
  out.calories = pick(["calories", "kcal", "cal", "k"]) ?? undefined;

  if (out.protein == null || out.carbs == null || out.fat == null) {
    const nums = text
      .split(/[^0-9.\-]+/g)
      .map(n => num(n))
      .filter((n): n is number => typeof n === "number");
    if (nums.length >= 3) {
      out.protein ??= nums[0];
      out.carbs   ??= nums[1];
      out.fat     ??= nums[2];
      if (nums.length >= 4 && out.calories == null) out.calories = nums[3];
    }
  }

  if (out.calories == null) {
    const p = out.protein || 0, c = out.carbs || 0, f = out.fat || 0;
    out.calories = Math.round(p * 4 + c * 4 + f * 9);
  }

  if (out.protein != null) out.protein = Math.round(out.protein);
  if (out.carbs   != null) out.carbs   = Math.round(out.carbs);
  if (out.fat     != null) out.fat     = Math.round(out.fat);
  if (out.calories!= null) out.calories= Math.round(out.calories);

  return out;
}
