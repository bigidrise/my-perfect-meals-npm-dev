import { assertRecipeDraft, CLINICAL_RECIPE_WITHHELD, SAFE_RECIPE_FAILURE } from "./recipeDraftSafety";

export type GatheringsCourseOutcome =
  | "success" | "generation_failed" | "incomplete" | "protocol_rejected"
  | "duplicate_exhausted" | "clinical_withheld";
type OutcomeCourse = {
  outcome?: unknown; _fallback?: unknown; description?: unknown;
  name?: unknown; ingredients?: unknown; instructions?: unknown; cookingInstructions?: unknown;
};
const failedOutcomes: GatheringsCourseOutcome[] = [
  "generation_failed", "incomplete", "protocol_rejected", "duplicate_exhausted", "clinical_withheld",
];
export function gatheringsCourseOutcome(course: OutcomeCourse): GatheringsCourseOutcome {
  if (failedOutcomes.includes(course?.outcome as GatheringsCourseOutcome)) return course.outcome as GatheringsCourseOutcome;
  if (course?._fallback === true) return course.description === CLINICAL_RECIPE_WITHHELD ? "clinical_withheld" : "incomplete";
  try { assertRecipeDraft(course); return "success"; } catch { return "incomplete"; }
}
export const gatheringsOutcomeLabel: Record<GatheringsCourseOutcome, string> = {
  success: "Recipe ready", generation_failed: "Generation failed", incomplete: "Recipe incomplete",
  protocol_rejected: "Safety requirements not met", duplicate_exhausted: "Distinct recipe unavailable",
  clinical_withheld: "Clinical review required",
};
export const gatheringsOutcomeMessage: Record<GatheringsCourseOutcome, string> = {
  success: "",
  generation_failed: SAFE_RECIPE_FAILURE,
  incomplete: SAFE_RECIPE_FAILURE,
  protocol_rejected: "A recipe meeting your safety requirements could not be prepared. Please try again.",
  duplicate_exhausted: "A distinct recipe for this course could not be prepared. Please try again.",
  clinical_withheld: CLINICAL_RECIPE_WITHHELD,
};
export function gatheringsCompletion(courses: OutcomeCourse[], requested = courses.length) {
  const completed = courses.filter(course => gatheringsCourseOutcome(course) === "success").length;
  const count = Math.max(1, courses.length, Number.isInteger(requested) && requested > 0 ? requested : 0);
  const state = completed === count ? "complete" : completed > 0 ? "partial" : "failed";
  return {
    state, completed, requested: count,
    title: state === "complete" ? "Your experience is ready!" :
      state === "partial" ? "Your experience is partially ready" : "No recipes are ready — please try again",
    description: state === "complete" ? `${completed} of ${count} recipes are ready.` :
      state === "partial" ? `${completed} of ${count} recipes are ready. Review the remaining course statuses and try again.` :
        "No complete recipes were prepared. Review the course statuses and try again.",
  };
}
