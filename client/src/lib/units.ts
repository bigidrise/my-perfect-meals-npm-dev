// Display callers retain one decimal. Input drafts may request the exact
// counterpart so changing input units does not change calculation precision.
const rounded = (value: number, precision: number | null) => precision === null ? value : +value.toFixed(precision);
export const lbToKg = (lb: number, precision: number | null = 1) => rounded(lb * 0.45359237, precision);
export const kgToLb = (kg: number, precision: number | null = 1) => rounded(kg / 0.45359237, precision);
export const inToCm = (inch: number, precision: number | null = 1) => rounded(inch * 2.54, precision);
export const cmToIn = (cm: number, precision: number | null = 1) => rounded(cm / 2.54, precision);

/** Restore from the draft's explicit source unit, not the new display choice. */
export function restoreBodyMeasurementDraft<T extends {
  units?: string; weightLbs?: number; weightKg?: number; heightFt?: number;
  heightIn?: number; heightCm?: number; waistIn?: number; waistCm?: number;
}>(draft: T): T {
  const result = { ...draft };
  if (draft.units === "imperial") {
    if (Number.isFinite(draft.weightLbs)) result.weightKg = lbToKg(draft.weightLbs!, null);
    if (Number.isFinite(draft.heightFt) && Number.isFinite(draft.heightIn)) {
      result.heightCm = inToCm(draft.heightFt! * 12 + draft.heightIn!, null);
    }
    if (Number.isFinite(draft.waistIn)) result.waistCm = inToCm(draft.waistIn!, null);
  } else if (draft.units === "metric") {
    if (Number.isFinite(draft.weightKg)) result.weightLbs = kgToLb(draft.weightKg!, null);
    if (Number.isFinite(draft.heightCm)) {
      const inches = cmToIn(draft.heightCm!, null);
      result.heightFt = Math.floor(inches / 12);
      result.heightIn = inches % 12;
    }
    if (Number.isFinite(draft.waistCm)) result.waistIn = cmToIn(draft.waistCm!, null);
  }
  return result;
}