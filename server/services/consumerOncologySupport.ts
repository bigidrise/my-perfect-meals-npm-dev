import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/schema";
import { readOncologySupportSelection, ONCOLOGY_SYMPTOM_OPTIONS } from "../../shared/oncologySupportSelection";

export class ConsumerOncologyError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export const SELF_SELECTABLE_SPECIALTY_CONDITIONS = [
  "renal", "cardiac", "liver-disease", "liver-support", "oncology-support",
  "thyroid-support", "hormone-optimization", "hashimotos", "hypothyroid",
  "hyperthyroid", "menopause", "perimenopause", "metabolic-recovery",
  "pregnancy-support", "alpha-gal-syndrome",
];
const RETAINED_SPECIALTY_CONDITIONS = ["therapeutic-support", "performance-nutrition"];

/** Retain established settings; this form cannot newly activate legacy supports. */
export function resolveConsumerSpecialtyConditions(requested: string[], stored: string[]): string[] {
  const retained = stored.filter(condition => RETAINED_SPECIALTY_CONDITIONS.includes(condition));
  const invalid = requested.find(condition =>
    !SELF_SELECTABLE_SPECIALTY_CONDITIONS.includes(condition) && !retained.includes(condition));
  if (invalid !== undefined) {
    throw new ConsumerOncologyError(400, "invalid_specialty_condition", `Invalid condition: ${invalid}`);
  }
  return Array.from(new Set([...requested, ...retained]));
}

export function parseConsumerOncologyInput(input: unknown): string[] | undefined {
  if (input === undefined) return undefined;
  const value = input as { symptoms?: unknown };
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some(key => key !== "symptoms") || !Array.isArray(value.symptoms) ||
      value.symptoms.some(symptom => !ONCOLOGY_SYMPTOM_OPTIONS.some(option => option.value === symptom))) {
    throw new ConsumerOncologyError(400, "invalid_oncology_selection", "Choose only the existing oncology symptoms.");
  }
  return [...new Set(value.symptoms)] as string[];
}

/** Keep ownership and emphasis server-owned. Off retains answers, not activation. */
export function consumerOncologyUpdate(previous: typeof users.$inferSelect.oncologySupportContext,
  conditions: string[], input: unknown, userId: string) {
  const selected = parseConsumerOncologyInput(input);
  const enabled = conditions.includes("oncology-support");
  if (previous?.source === "physician" || previous?.locked) {
    if (selected !== undefined || enabled !== previous.enabled) {
      throw new ConsumerOncologyError(403, "physician_locked", "Your oncology support is managed by your care team.");
    }
    return previous;
  }
  if (previous && previous.source !== "self") {
    throw new ConsumerOncologyError(403, "unverified_oncology_owner", "Your oncology ownership could not be verified.");
  }
  const stored = readOncologySupportSelection(previous);
  if (!previous && !enabled && !selected?.length) return null;
  return {
    ...previous,
    enabled,
    symptoms: (selected ?? stored.symptoms) as typeof stored.symptoms,
    emphasis: stored.emphasis,
    source: "self" as const,
    locked: false,
    ownerName: previous?.ownerName ?? null,
    updatedBy: userId,
    updatedAt: new Date().toISOString(),
  };
}

/** One locked row / one write: clinical writers cannot be overwritten by a stale consumer read. */
export async function saveConsumerSpecialtySupport(userId: string, conditions: string[], input: unknown) {
  parseConsumerOncologyInput(input);
  return db.transaction(async tx => {
    const [record] = await tx.select({
      context: users.oncologySupportContext,
      conditions: users.specialtyConditions,
      primaryCondition: users.specialtyCondition,
    })
      .from(users).where(eq(users.id, userId)).limit(1).for("update");
    if (!record) throw new ConsumerOncologyError(404, "user_not_found", "User not found.");
    const resolvedConditions = resolveConsumerSpecialtyConditions(
      conditions, record.conditions ?? (record.primaryCondition ? [record.primaryCondition] : []));
    const context = consumerOncologyUpdate(record.context, resolvedConditions, input, userId);
    await tx.update(users).set({
      specialtyCondition: resolvedConditions[0] ?? null,
      specialtyConditions: resolvedConditions,
      oncologySupportContext: context,
    }).where(eq(users.id, userId));
    return { context, conditions: resolvedConditions };
  });
}
