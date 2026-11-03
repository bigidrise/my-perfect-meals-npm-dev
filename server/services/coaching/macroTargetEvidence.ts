import type { MemberContextEvidence } from "../../../shared/coaching/types";

export type StoredMacroPrescription = {
  date?: string;
  updated_at?: Date | string | null;
  source?: string | null;
  source_version?: string | null;
} & Partial<Record<
  "target_calories" | "target_protein" | "target_total_carbs" | "target_fat" |
  "target_starchy_carbs" | "target_fibrous_carbs", string | number | null
>>;

const columns = {
  calories: "target_calories", protein: "target_protein",
  carbs: "target_total_carbs", fat: "target_fat",
  starchyCarbs: "target_starchy_carbs", fibrousCarbs: "target_fibrous_carbs",
} as const;

/** Parse stored evidence, not a nutrition calculation. Reject blanks and partial numbers. */
export function storedMacroNumber(raw: unknown): number | null {
  if (typeof raw !== "number" && typeof raw !== "string") return null;
  if (typeof raw === "string" && !/^\d+(?:\.\d+)?$/.test(raw.trim())) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** No DB, clinical lookup, target selection, recalculation or prescription writes. */
export function projectMacroTargetEvidence(
  saved: MemberContextEvidence["savedTargets"]["targets"],
  prescription: StoredMacroPrescription | null,
  localDate: string,
): NonNullable<MemberContextEvidence["macroTargets"]> {
  const current = prescription?.date === localDate;
  const keys = Object.keys(columns) as Array<keyof typeof columns>;
  const fields = Object.fromEntries(keys.map(key => {
    const base = saved[key];
    const savedBase = base.status === "known" ? storedMacroNumber(base.value) : null;
    const storedForDate = current ? storedMacroNumber(prescription?.[columns[key]]) : null;
    const relationship = savedBase !== null && storedForDate !== null
      ? savedBase === storedForDate ? "same" : "different"
      : savedBase !== null ? "saved_base_only" : storedForDate !== null ? "stored_only" : "unknown";
    return [key, { savedBase, storedForDate, relationship }];
  })) as NonNullable<MemberContextEvidence["macroTargets"]>["fields"];
  return {
    verifiedCurrentEffective: false,
    professionalOverrideStatus: "unverified",
    savedBaseOwnership: "unverified",
    storedPrescriptionCoverage: !prescription ? "missing" : !current ? "historical_only"
      : keys.every(key => fields[key].storedForDate !== null) ? "complete" : "incomplete",
    fields,
  };
}
