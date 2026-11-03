import { randomUUID } from "node:crypto";
import { buildMemberEvidence } from "../../server/services/coaching/memberContextEvidence";

export const REVIEW_FIXTURES = ["vegan-soy-missing", "vegetarian-logged", "unknown-allergies"] as const;
export type ReviewFixture = typeof REVIEW_FIXTURES[number];

/** Fixed synthetic data only. No account loader, database or clinical resolver. */
export function createReviewContext(fixture: ReviewFixture): Record<string, unknown> {
  if (!REVIEW_FIXTURES.includes(fixture)) throw new Error("Unknown synthetic review fixture");
  const userId = `synthetic-ask-chef-review-${randomUUID()}`;
  const now = new Date("2026-11-02T18:00:00Z");
  const logged = fixture === "vegetarian-logged";
  const evidence = buildMemberEvidence({
    profile: {
      nickname: "Review Member", cuisine_preference: "indian", cuisine_intensity: "balanced",
      dietary_restrictions: [fixture === "vegan-soy-missing" ? "vegan" : "vegetarian"],
      allergies: fixture === "unknown-allergies" ? [] : [logged ? "peanuts" : "soy"],
      avoided_foods: ["sesame"], disliked_foods: ["olives"],
      preferred_sweeteners: [], avoid_sweeteners: [],
      goal_type: "maintain",
      daily_calorie_target: 1800, daily_protein_target: 120, daily_carbs_target: 180,
      daily_fat_target: 65, daily_starchy_carbs_target: 90, daily_fibrous_carbs_target: 90,
      foods_i_enjoy: {
        version: 1, configured: true, updatedAt: now.toISOString(),
        items: [{
          id: "synthetic-enjoyment", conceptId: null, kind: "dish", category: "meals-dishes",
          displayLabel: "Lentil curry", originalText: "Lentil curry", locale: "en",
          source: "free_text", provenance: "explicit", selectedAt: now.toISOString(), revokedAt: null,
        }],
      },
    },
    now, recordedTimezone: "America/Chicago",
    day: { localDate: "2026-11-02", timezone: "America/Chicago",
      start: new Date("2026-11-02T06:00:00Z"), end: new Date("2026-11-03T05:59:59.999Z") },
    prescription: logged ? {
      date: "2026-11-02", target_calories: "1800", target_protein: "125",
      target_total_carbs: "180", target_fat: "65", target_starchy_carbs: "90",
      target_fibrous_carbs: "90", source: "synthetic_review",
      updated_at: now.toISOString(),
    } : null,
  });
  const today = {
    macros: {
      protein: { status: logged ? "observed" : "missing", value: logged ? 30 : null,
        source: "synthetic_review_logs", date: "2026-11-02" },
      calories: { status: logged ? "observed" : "missing", value: logged ? 400 : null,
        source: "synthetic_review_logs", date: "2026-11-02" },
    },
    meals: { count: { status: logged ? "observed" : "missing", value: logged ? 1 : null },
      completeness: logged ? "partial" : "unknown" },
  };
  return {
    chefFoodCompatibility: { subjectUserId: userId },
    coachingContextSnapshot: { subject: { userId }, memberEvidence: evidence, today },
    coachingContextBlock: [
      "SYNTHETIC REVIEW EVIDENCE ONLY — not a real member account.",
      JSON.stringify({ memberEvidence: evidence, today }),
      "Saved targets are a baseline, not a verified current effective prescription. Dated targets are not revalidated.",
      "Logged intake is only what was recorded, not total consumption. Missing logs mean unknown, not zero.",
      "Unknown allergies are not confirmed absent. Preferences are not safety clearance.",
    ].join("\n"),
  };
}
