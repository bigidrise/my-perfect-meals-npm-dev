// Coach's Corner — Behavioral Intake Types
//
// CoachCornerFieldTarget maps each intake question to a dedicated, typed
// behavioral-variable column on coaching_profiles. Do NOT point new
// questions at shared array columns (lifestyleFlags/biggestChallenges) —
// those belong to the separate legacy ACE profile setup feature
// (server/routes/aceProfiles.ts) and must not be reused here.
//
// V1 test standard for every question (per architect review): "Can I point
// to a recommendation in the Recommendation Library that this answer
// changes?" If no, the question doesn't belong. These 15 are the first pass
// — expected to be pruned/replaced once the Core Coaching Action Library and
// Recommendation Library are locked, not the final set.

export type CoachCornerFieldTarget =
  | "offTrackCauses"
  | "setbackResponse"
  | "progressMindset"
  | "trustStyle"
  | "overwhelmResponse"
  | "decisionStyle"
  | "eatingDriver"
  | "cravingResponse"
  | "hardestPart"
  | "activityLevel"
  | "activeDaysPerWeek"
  | "planStartStage"
  | "recoveryPreference"
  | "motivationDriver"
  | "goalType";

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

// ---- Coach Decision Engine (shared, situation-agnostic) ----
//
// The Coach Decision Engine (server/services/ace/coachDecisionEngine.ts)
// orchestrates every situation through the same pipeline:
//   Situation Adapter gathers evidence -> determineIntent -> buildRecommendation
//   -> merged CoachMessage -> optional MPM destination.
// The engine itself must never branch on situation identity. Each situation
// (progress-slowed, tired, etc.) owns a SituationAdapter that supplies its
// own evidence/follow-up shapes and its own intent + recommendation logic.

// The four Core Coaching Actions. Every situation's recommendation exists to
// accomplish exactly one of these.
export type CoachingIntent = "reassure" | "redirect" | "educate" | "refer";

export interface CoachMessage {
  acknowledgment: string;
  recommendation: string;
  // Placeholders for the future Science/Philosophy Libraries — hardcoded per
  // situation for V1, not yet backed by real lookup/selection logic. Kept as
  // separate fields internally; always rendered merged (no labeled UI
  // sections) so the user experiences one seamless coach.
  science: string;
  philosophy: string;
  whatToWatchFor: string;
  action: string;
}

export interface CoachRouteTo {
  label: string;
  path: string;
}

export interface CoachResponse {
  intent: CoachingIntent;
  recommendation: string;
  message: CoachMessage;
  routeTo?: CoachRouteTo;
}

export interface SituationAdapter<TContext, TFollowUp, TProfile> {
  determineIntent: (context: TContext, followUp: TFollowUp) => CoachingIntent;
  buildRecommendation: (
    intent: CoachingIntent,
    context: TContext,
    followUp: TFollowUp,
    profile: TProfile
  ) => CoachResponse;
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
//
// ProgressSlowedResponse is the CoachResponse shape for this situation
// specifically (kept as its own type alias for readability at call sites).
export type ProgressSlowedResponse = CoachResponse;

// ---- "I'm tired" vertical coaching loop ----

export type PerceivedTiredDuration = "today" | "few_days" | "week_plus";
export type TiredTiming = "all_day" | "afternoon_slump" | "after_meals";
export type SleepQuality = "normal" | "poor" | "not_sure";

export interface TiredContext {
  daysSincePlanChange: number | null;
  recentlyReducedCarbsOrSugar: boolean;
}

export interface TiredFollowUp {
  duration: PerceivedTiredDuration;
  timing: TiredTiming;
  sleepQuality: SleepQuality;
}

export type TiredResponse = CoachResponse;
