/**
 * Coach's Corner Specialization Adapter — Phase 1 (Coaching Intelligence Layer)
 *
 * Scope: Whole adult MPM platform.
 * Subject: The authenticated user (adult, not a child).
 * Safety: Global adult rules only. No additional restrictions beyond global.
 * Tools: Capability registry (see capabilityRegistry.ts).
 *
 * Phase 1 change: availableTools now comes from the capability registry
 * (replacing 3 hardcoded entries). loadAdditionalContext now builds and
 * returns a full CoachingContextSnapshot so the engine's reasoning and
 * rendering passes receive structured, provenance-tagged evidence.
 *
 * Clinical access: cornerAdapter is NOT permitted to access clinical data.
 * permittedClinicalScopes = [] enforces this at the context service level.
 */

import type {
  CoachSpecializationAdapter,
  CoachSubject,
  CoachingTool,
} from "../../../../shared/coaching/types";
import {
  getCapabilitiesForUser,
  type CapabilityScope,
} from "../capabilityRegistry";
import {
  buildCoachingContext,
  renderSnapshotForPrompt,
} from "../coachingContext";

// ─── Tool conversion ──────────────────────────────────────────────────────────
// The adapter interface uses CoachingTool[], which is the legacy shape.
// We satisfy that contract by mapping from the capability registry.
// The capability registry remains the canonical source.

function buildCornerTools(userId: string): CoachingTool[] {
  // Corner gets all "all"-scoped capabilities — overlay-specific ones are
  // added dynamically after we know the user's specialtyConditions.
  // For the static tool list (loaded before context), return "all" scope only.
  const caps = getCapabilitiesForUser(["all"], true);
  return caps.map((cap) => ({
    id: cap.id,
    scope: "adult" as const,
    label: cap.label,
    featureTarget: cap.route,
    description: cap.description,
  }));
}

export const cornerAdapter: CoachSpecializationAdapter = {
  id: "corner",
  name: "Coach's Corner",

  async loadSubject(req: any): Promise<CoachSubject> {
    const userId = req?.authUser?.id;
    if (!userId) {
      throw Object.assign(new Error("Unauthorized"), { status: 401 });
    }
    return {
      subjectType: "user",
      subjectId: userId,
      ownerId: userId,
    };
  },

  // All 8 observers are available to the adult corner
  supportedObservers: [
    "weight", "macro", "hydration", "exercise",
    "restaurant", "behavior", "lifestyle", "compliance",
  ],

  // Corner uses global adult safety rules only.
  safetyRules: [],

  // Knowledge pattern scopes
  knowledgeScopes: ["corner", "all"],

  // Tools: all "all"-scoped capabilities (overlay-specific added via availableTools override)
  availableTools: buildCornerTools(""),

  async loadAdditionalContext(subject: CoachSubject): Promise<Record<string, unknown>> {
    try {
      // Build the full CoachingContextSnapshot for this user.
      // The snapshot is the authoritative factual record for this coaching turn.
      const snapshot = await buildCoachingContext({
        userId: subject.ownerId,
        specialization: "corner",
        permittedClinicalScopes: [], // cornerAdapter has no clinical access
        // timezone: will be resolved from the users table by buildCoachingContext
      });

      // Override availableTools now that we know the user's active overlays.
      // This ensures overlay-specific features (GLP-1, anti-inflam, etc.) appear
      // when the user qualifies for them.
      const activeScopes: CapabilityScope[] = ["all"];
      if (snapshot.overlays.performanceModeActive)  activeScopes.push("performance");
      if (snapshot.overlays.glp1Active)             activeScopes.push("glp1");
      if (snapshot.overlays.antiInflammatoryActive) activeScopes.push("anti_inflam");
      if (snapshot.overlays.diabeticActive)         activeScopes.push("diabetic");
      // Not pregnancy — corner specialization does not expose pregnancy coaching

      const userCaps = getCapabilitiesForUser(activeScopes, true);
      // Mutate availableTools on the adapter so the engine's rendering pass
      // gets the correct filtered capability set for this user.
      cornerAdapter.availableTools = userCaps.map((cap) => ({
        id: cap.id,
        scope: "adult" as const,
        label: cap.label,
        featureTarget: cap.route,
        description: cap.description,
      }));

      // Return the snapshot both as structured data (for downstream processing)
      // and as a pre-rendered prompt block (for direct injection into the LLM prompt).
      return {
        // Structured snapshot — consumed by any future server-side pattern logic
        coachingContextSnapshot: snapshot,
        // Pre-rendered text block — injected verbatim into the reasoning prompt
        coachingContextBlock: renderSnapshotForPrompt(snapshot),
        // Legacy fields — kept for backward compatibility with any code reading
        // additionalContext directly. These mirror what the snapshot contains.
        goalType:            snapshot.profile.goalType.value,
        goalTarget:          snapshot.profile.goalTarget.value,
        dietaryRestrictions: snapshot.profile.dietaryRestrictions,
        medicalConditions:   snapshot.profile.medicalConditions,
        specialtyConditions: snapshot.profile.specialtyConditions,
        activityLevel:       snapshot.profile.activityLevel.value,
        fitnessGoal:         snapshot.profile.fitnessGoal.value,
        dataConfidence:      snapshot.dataConfidence,
      };
    } catch (err: any) {
      console.error("[CornerAdapter] loadAdditionalContext failed:", err.message);
      return {};
    }
  },
};
