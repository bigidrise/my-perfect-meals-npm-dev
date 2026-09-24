/** Exact legacy activation predicate, shared with DEV-only shadow comparison. */
const GLP1_CONDITION_KEYS = [
  "glp1", "glp-1", "glp 1",
  "semaglutide", "tirzepatide", "ozempic", "wegovy", "mounjaro",
  "rybelsus", "liraglutide", "dulaglutide", "exenatide", "trulicity",
  "victoza", "saxenda", "zepbound",
];

function arrayIncludesGLP1(arr: unknown): boolean {
  if (!Array.isArray(arr)) return false;
  return arr.some((v) =>
    typeof v === "string" &&
    GLP1_CONDITION_KEYS.some((key) => v.toLowerCase().includes(key)));
}

export type GLP1ActivationSource =
  | "selectedMealBuilder"
  | "medicalConditions"
  | "specialtyConditions";

export function detectLegacyGLP1ActivationSources(user: {
  selectedMealBuilder?: string | null;
  medicalConditions?: unknown;
  specialtyConditions?: unknown;
} | null): GLP1ActivationSource[] {
  if (!user) return [];
  const sources: GLP1ActivationSource[] = [];
  if (user.selectedMealBuilder === "glp1") sources.push("selectedMealBuilder");
  if (arrayIncludesGLP1(user.medicalConditions)) sources.push("medicalConditions");
  if (arrayIncludesGLP1(user.specialtyConditions)) sources.push("specialtyConditions");
  return sources;
}