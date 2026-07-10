// Coach's Corner — Behavioral Intake Types
//
// CoachCornerFieldTarget maps each intake question to a dedicated, typed
// behavioral-variable column on coaching_profiles. Do NOT point new
// questions at shared array columns (lifestyleFlags/biggestChallenges) —
// those belong to the separate legacy ACE profile setup feature
// (server/routes/aceProfiles.ts) and must not be reused here.

export type CoachCornerFieldTarget =
  | "setbackResponse"
  | "stressResponse"
  | "recoveryPreference";

export interface CoachCornerOption {
  value: string;
  label: string;
}

export interface CoachCornerQuestion {
  id: string;
  prompt: string;
  target: CoachCornerFieldTarget;
  multiSelect: boolean;
  maxSelect?: number;
  options: CoachCornerOption[];
}

// ---- "My progress has slowed" vertical coaching loop ----

export type ProgressSlowedIntent = "reassure" | "educate" | "redirect";

export interface ProgressSlowedContext {
  weeksOnPlan: number | null;
  hasWeightData: boolean;
  weightChangeLb: number | null;
  weightChangePercent: number | null;
}

export type PerceivedDuration = "short" | "medium" | "long";
export type SelfReportedWeightChange = "none_little" | "moderate" | "significant";

export interface ProgressSlowedFollowUp {
  perceivedDuration: PerceivedDuration;
  selfReportedWeightChange?: SelfReportedWeightChange;
}

// Coach's Corner response pipeline, applied to one resolved coaching response:
//   Layer 1 Intent          -> what Coach is trying to accomplish (ProgressSlowedIntent)
//   Layer 2 Recommendation  -> what this person should do (message.recommendation)
//   Layer 3 Science placeholder    -> why this works (message.science)
//   Layer 4 Philosophy placeholder -> how to think about it (message.philosophy)
// followed by an optional MPM destination (routeTo).
//
// `science` and `philosophy` are hardcoded placeholder content for V1 — they
// validate that the response pipeline has a place for this content. They are
// NOT yet backed by real Science/Philosophy Libraries (no lookup, no
// selection logic); that comes later, after the Action Library,
// Recommendation Library, and Behavioral Variables are locked. Do not merge
// them back into one "explanation" field (the pipeline separation is
// intentional), and do not render them as separate labeled UI sections (the
// user should experience one seamless coach, not internal layers).
export interface ProgressSlowedResponse {
  intent: ProgressSlowedIntent;
  recommendation: string;
  message: {
    acknowledgment: string;
    recommendation: string;
    science: string;
    philosophy: string;
    whatToWatchFor: string;
    action: string;
  };
  routeTo?: {
    label: string;
    path: string;
  };
}
