import { parseMeasurementNumber } from "../../shared/units";
import { ingredientMeasurementUnit } from "../../shared/ingredientMeasurements";
import { validateGeneratedIngredientMeasurements } from "./calorieEstimator";

export interface VerifiedIngredient {
  name: string;
  quantity: number;
  unit: string;
}

function canonicalUnit(value: string): string {
  const unit = ingredientMeasurementUnit(value);
  const aliases: Record<string, string> = {
    cloves: "clove",
    scoops: "scoop",
    eggs: "egg",
    pieces: "piece"
  };
  return Object.prototype.hasOwnProperty.call(aliases, unit)
    ? aliases[unit]
    : unit;
}

function verifyLegacyString(value: string): VerifiedIngredient | null {
  const tokens = value.trim().split(/\s+/);
  const candidates: VerifiedIngredient[] = [];

  for (let i = 1; i < tokens.length - 1; i++) {
    const quantity = parseMeasurementNumber(tokens.slice(0, i).join(" "));
    if (quantity === null || !Number.isFinite(quantity) || quantity <= 0) continue;

    for (let j = i + 1; j < tokens.length; j++) {
      const rawUnit = tokens.slice(i, j).join(" ");
      if (!/^[\p{L}][\p{L}\s.]*$/u.test(rawUnit)) continue;

      const unit = canonicalUnit(rawUnit);
      const name = tokens.slice(j).join(" ").replace(/^de\s+/i, "").trim();

      if (!/^\p{L}/u.test(name)) continue;

      const candidate = verifyGeneratedIngredient({ name, quantity, unit });
      if (candidate) candidates.push(candidate);
    }
  }

  return candidates.length === 1 ? candidates[0] : null;
}

function parseExplicitAmount(value: unknown): {
  quantity: number;
  unit?: string;
} | null {
  if (typeof value !== "string" && typeof value !== "number") return null;

  const direct = parseMeasurementNumber(value);
  if (direct !== null && Number.isFinite(direct) && direct > 0) {
    return { quantity: direct };
  }

  if (typeof value !== "string") return null;

  const text = value.trim();
  for (const match of text.matchAll(/\s+/g)) {
    const index = match.index!;
    const quantity = parseMeasurementNumber(text.slice(0, index));
    const unit = text.slice(index + match[0].length).trim();

    if (quantity !== null && Number.isFinite(quantity) && quantity > 0 && unit) {
      if (!/^[\p{L}][\p{L}\s.]*$/u.test(unit)) continue;
      return { quantity, unit: canonicalUnit(unit) };
    }
  }

  return null;
}

export function verifyGeneratedIngredient(input: unknown): VerifiedIngredient | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;

  const row = input as Record<string, unknown>;
  const names = [row.name, row.item, row.ingredient]
    .filter(value => value !== undefined && value !== null);

  if (!names.length || names.some(value =>
    typeof value !== "string" || !value.trim()
  )) return null;

  const normalizedNames = names.map(value =>
    (value as string).trim().toLowerCase().replace(/\s+/g, " ")
  );

  if (normalizedNames.some(name => name !== normalizedNames[0])) return null;

  const rawName = names[0];

  if (typeof rawName !== "string" || !rawName.trim()) return null;

  let name = rawName.trim();
  if (typeof row.notes === "string" && row.notes.trim()) {
    name += ` (${row.notes.trim()})`;
  }

  if (row.unit != null && typeof row.unit !== "string") return null;

  const explicitUnit = typeof row.unit === "string"
    ? canonicalUnit(row.unit)
    : "";

  const values = [row.quantity, row.amount, row.qty, row.amountOz]
    .filter(value => value !== undefined && value !== null);

  if (!values.length) return null;

  const parsed = values.map(parseExplicitAmount);
  if (parsed.some(value => value === null)) return null;

  const quantity = parsed[0]!.quantity;
  if (parsed.some(value => value!.quantity !== quantity)) return null;

  const units = [
    explicitUnit,
    ...(row.amountOz != null ? ["oz"] : []),
    ...parsed.map(value => value!.unit || ""),
  ].filter(Boolean);

  if (!units.length || units.some(unit => unit !== units[0])) return null;

  const ingredient = { name, quantity, unit: units[0] };

  return validateGeneratedIngredientMeasurements([ingredient])
    ? ingredient
    : null;
}

export function verifyGeneratedIngredients(input: unknown): VerifiedIngredient[] | null {
  let rows: unknown[];

  if (Array.isArray(input)) {
    rows = input;
  } else if (typeof input === "string") {
    rows = input.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  } else if (input && typeof input === "object") {
    rows = Object.entries(input).map(([name, amount]) => ({ name, amount }));
  } else {
    return null;
  }

  if (!rows.length) return null;

  const ingredients = rows.map(row =>
    typeof row === "string"
      ? verifyLegacyString(row)
      : verifyGeneratedIngredient(row)
  );

  if (ingredients.some(ingredient => ingredient === null)) return null;

  return ingredients as VerifiedIngredient[];
}
