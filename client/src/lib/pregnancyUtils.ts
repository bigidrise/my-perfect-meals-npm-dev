import { derivePregnancyStage } from "@shared/pregnancyStage";

export interface PregnancyStatus {
  stage: string;
  weekOfPregnancy: number | null;
  label: string;
  emoji: string;
  nextMilestone: string | null;
  dueDate: string | null;
  symptoms: string[];
  trackingMode: string;
  isBreastfeeding: boolean;
}

export const PREGNANCY_STAGE_META: Record<string, { label: string; emoji: string }> = {
  "trying-to-conceive": { label: "Trying to Conceive", emoji: "🌸" },
  "trimester-1":        { label: "First Trimester",    emoji: "🌱" },
  "trimester-2":        { label: "Second Trimester",   emoji: "🌿" },
  "trimester-3":        { label: "Third Trimester",    emoji: "🌺" },
  "breastfeeding":      { label: "Breastfeeding",      emoji: "🤱" },
  "postpartum":         { label: "Postpartum",         emoji: "🩷" },
};

function computeNextMilestone(week: number, stage: string): string | null {
  if (stage === "trimester-1") {
    const w = 14 - week;
    if (w <= 0) return null;
    return `Second Trimester begins in ${w} week${w === 1 ? "" : "s"}`;
  }
  if (stage === "trimester-2") {
    const w = 28 - week;
    if (w <= 0) return null;
    return `Third Trimester begins in ${w} week${w === 1 ? "" : "s"}`;
  }
  if (stage === "trimester-3") {
    const w = 40 - week;
    if (w <= 0) return "Due any day";
    return `Due in ${w} week${w === 1 ? "" : "s"}`;
  }
  return null;
}

export function derivePregnancyStatus(user: any): PregnancyStatus | null {
  if (!user) return null;
  const rawStage: string | null = user.pregnancyStage ?? null;
  if (!rawStage) return null;

  const ctx = user.pregnancySupportContext ?? {};
  const rawDueDate: string | null = user.pregnancyDueDate ?? null;
  const trackingMode: string = ctx.trackingMode ?? "manual";

  const { resolvedStage, weekOfPregnancy } = derivePregnancyStage(rawStage, rawDueDate, trackingMode);

  const meta = PREGNANCY_STAGE_META[resolvedStage] ?? PREGNANCY_STAGE_META["trimester-2"];
  const nextMilestone =
    weekOfPregnancy !== null ? computeNextMilestone(weekOfPregnancy, resolvedStage) : null;

  return {
    stage: resolvedStage,
    weekOfPregnancy,
    label: meta.label,
    emoji: meta.emoji,
    nextMilestone,
    dueDate: rawDueDate,
    symptoms: ctx.symptoms ?? [],
    trackingMode,
    isBreastfeeding: ctx.isBreastfeeding ?? false,
  };
}
