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

export interface ProgressSlowedResponse {
  intent: ProgressSlowedIntent;
  recommendation: string;
  message: {
    acknowledgment: string;
    recommendation: string;
    explanation: string;
    whatToWatchFor: string;
    action: string;
  };
  routeTo?: {
    label: string;
    path: string;
  };
}
