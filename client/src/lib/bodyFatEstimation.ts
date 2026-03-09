export interface BodyFatEstimationInput {
  weightKg: number;
  heightCm: number;
  waistCm: number;
  age: number;
  sex: "male" | "female";
}

export function estimateBodyFatHybrid(input: BodyFatEstimationInput): number | null {
  const { weightKg, heightCm, waistCm, age, sex } = input;

  if (weightKg <= 0 || heightCm <= 0 || waistCm <= 0 || age <= 0) return null;

  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);

  const sexFactor = sex === "male" ? 1 : 0;
  const deurenbergBF = 1.2 * bmi + 0.23 * age - 10.8 * sexFactor - 5.4;

  const waistRatio = waistCm / heightCm;
  const waistAdjustment = (waistRatio - 0.45) * 100;

  const estimatedBF = deurenbergBF * 0.7 + waistAdjustment * 0.3;

  return Math.round(Math.min(50, Math.max(5, estimatedBF)) * 10) / 10;
}
