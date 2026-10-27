import {
  readGatheringsValidationEvidence, type GatheringsEvidenceCourse,
} from "@shared/gatheringsValidationEvidence";
import { gatheringsCourseOutcome } from "@shared/gatheringsCourseOutcome";

const labels: Record<string, string> = {
  kosher: "Kosher", halal: "Halal", vegan: "Vegan", vegetarian: "Vegetarian",
};
interface Props { course: GatheringsEvidenceCourse; preferences?: string[] }
/** Gatherings-only presentation. Never falls back to profile-based compliance
 * or client-side nutrient calculations. Shared badge components are unchanged. */
export default function GatheringsValidationBadges({ course, preferences = [] }: Props) {
  const evidence = readGatheringsValidationEvidence(course);
  const selected = [...new Set(preferences.filter(value => typeof value === "string" &&
    !["", "none", "no-restriction", "no_restriction"].includes(value.trim().toLowerCase())))];
  const badges = evidence?.dietaryBadges ?? [];
  const certificationReminder = badges.some(key => key === "kosher" || key === "halal");
  const nutritionStatus = (course.nutritionResult as { status?: unknown } | undefined)?.status;
  return (
    <div className="mb-4 space-y-2 text-xs" aria-label="Recipe validation evidence">
      {selected.length > 0 && <p className="text-white/60">
        Dietary preference: {selected.map(key => labels[key.toLowerCase()] ?? key).join(", ")}
        {" — selected preference, not recipe verification."}
      </p>}
      {badges.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {badges.map(key => <span key={key} className="rounded-full border border-white/30 px-2 py-1 text-white/90">
            {labels[key]} ingredient/protocol checks passed
          </span>)}
        </div>
      ) : <p className="text-white/70">Recipe dietary compliance: not verified.</p>}
      {evidence && <p className="text-white/60">
        Applicable ingredient-list and cooking-instruction protocol checks passed.
      </p>}
      {certificationReminder && <p className="text-white/60">
        Ingredient/protocol compatibility is not Kosher or Halal certification of sourcing, handling, or preparation.
      </p>}
      <p className="text-white/60">
        {gatheringsCourseOutcome(course) !== "success" ? "This course is not a cleared recipe. " :
          nutritionStatus === "unavailable" ? "Nutrition is unavailable. " :
          nutritionStatus === "needs_review" ? "Nutrition needs review. " : ""}
        Medical suitability has not been established by this badge evidence.
      </p>
    </div>
  );
}
