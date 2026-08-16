/**
 * weightUnit.ts
 *
 * Shared, pure conversion utilities for the users.weight column.
 *
 * Contract: users.weight is ALWAYS stored in whole-number kilograms.
 * Any write path that accepts user-supplied weight MUST call
 * parseWeightToKg() and store only its output.
 */

export type WeightUnit = "lb" | "kg";

export interface ParseWeightResult {
  ok: true;
  weightKg: number;
}

export interface ParseWeightError {
  ok: false;
  status: 400;
  code: string;
  error: string;
}

export type ParseWeightOutcome = ParseWeightResult | ParseWeightError;

/**
 * Convert a raw weight value + explicit unit to whole-number kilograms.
 *
 * Rules:
 *  - `weightUnit` is required when `weight` is provided; omitting it is a 400
 *    error so callers cannot silently inject lbs into the kg column.
 *  - Only "lb" and "kg" are accepted.
 *  - The value must be a positive finite number.
 *  - The resulting kg value must be ≤ 300 (physiological ceiling for a human).
 */
export function parseWeightToKg(
  weight: unknown,
  weightUnit: unknown,
): ParseWeightOutcome {
  // weightUnit is required whenever weight is supplied
  if (weightUnit === undefined || weightUnit === null || weightUnit === "") {
    return {
      ok: false,
      status: 400,
      code: "WEIGHT_UNIT_REQUIRED",
      error:
        "weightUnit is required when sending weight — use 'lb' or 'kg'",
    };
  }

  const unit = String(weightUnit).toLowerCase().trim();
  if (unit !== "lb" && unit !== "kg") {
    return {
      ok: false,
      status: 400,
      code: "WEIGHT_UNIT_INVALID",
      error: "weightUnit must be 'lb' or 'kg'",
    };
  }

  const numWeight = Number(weight);
  if (!Number.isFinite(numWeight) || numWeight <= 0) {
    return {
      ok: false,
      status: 400,
      code: "WEIGHT_VALUE_INVALID",
      error: "weight must be a positive number",
    };
  }

  const weightKg =
    unit === "lb"
      ? Math.round(numWeight / 2.20462)
      : Math.round(numWeight);

  if (weightKg > 300) {
    return {
      ok: false,
      status: 400,
      code: "WEIGHT_OUT_OF_RANGE",
      error:
        "weight value exceeds 300 kg — verify your value and unit are correct",
    };
  }

  return { ok: true, weightKg };
}
