/**
 * MPM Coaching Engine — Shared TypeScript Contracts
 *
 * Authority order (highest to lowest):
 *   Safety Rules → Platform Evidence → Knowledge Pattern →
 *   Coaching Memory → Nutrition Memory → Behavioral Profile → LLM Renderer
 *
 * The LLM generates language only. The platform decides coaching philosophy.
 */

// ─── Enumerations ────────────────────────────────────────────────────────────

export type CoachSpecialization = "corner" | "pregnancy" | "pediatric";

export type SubjectType = "user" | "child";

export type ObserverWindow = "today" | "7d" | "30d" | "90d";

export type EvidenceQuality = "measured" | "reported" | "inferred" | "missing";

export type ConfidenceLevel = "high" | "moderate" | "low";

/**
 * Four distinct coaching voices, mapped deterministically from coaching_profiles.
 * Same evidence, same recommendation — different delivery.
 */
export type StyleMode =
  | "accountability"  // simple_plan / just_tell_me / fresh_start
  | "education"       // understanding_why / show_science / researches_everything
  | "encouragement"   // gets_discouraged / keeps_trying / default
  | "reassurance";    // stops_everything / doing_something_wrong

export type CoachRole = "user" | "assistant" | "system";

export type SafetyClass = "routine" | "caution" | "escalate" | "emergency";

export type ActionHorizon = "today" | "tomorrow" | "next_check_in";

export type ActionItemKind =
  | "drink"
  | "eat"
  | "avoid"
  | "log"
  | "activity"
  | "weigh"
  | "contact_care"
  | "use_feature"    // redirect to an MPM feature
  | "other";

/**
 * How the system determines if an action was completed.
 * Objective = platform observed a log entry (high confidence).
 * Subjective = user reported in chat (medium confidence).
 * Unknown = nothing observed, nothing reported. Never assumes failure.
 */
export type CompletionSignal =
  | "weight_logged"
  | "water_logged"
  | "meal_logged"
  | "macro_logged"
  | "restaurant_logged"
  | "exercise_logged"
  | "beverage_logged"
  | "self_reported"
  | "unknown";

export type ActionItemStatus = "pending" | "completed" | "skipped" | "unknown";

export type FollowupStatus =
  | "pending"
  | "sent"
  | "dismissed"
  | "snoozed"
  | "completed";

export type MemoryCategory = "behavior" | "lifestyle" | "nutrition" | "success";

export type MemoryStatus = "active" | "archived" | "superseded";

export type PlanStatus = "open" | "completed" | "expired" | "cancelled";

// ─── Subject & Request ───────────────────────────────────────────────────────

/**
 * Who is being coached.
 * For corner/pregnancy: subjectId = userId, dependentId = undefined.
 * For pediatric: subjectId = child_profile.id, dependentId = userId (the parent).
 */
export interface CoachSubject {
  subjectType: SubjectType;
  subjectId: string;
  /** For pediatric: the authenticated parent's userId for ownership checks */
  ownerId: string;
}

export interface CoachRequest {
  specialization: CoachSpecialization;
  subject: CoachSubject;
  userMessage: string;
  conversationId: string;
  /** Evidence delta from previous turn — drives selective Observer reruns */
  evidenceDelta?: EvidenceDelta;
}

// ─── Evidence ────────────────────────────────────────────────────────────────

export interface Evidence {
  /**
   * Observer ID that produced this finding — auto-tagged by runObservers().
   * Optional here so individual observers don't need to repeat their own ID
   * on every finding; the runner fills it in after each observer returns.
   */
  observer?: string;
  metric: string;
  window: ObserverWindow;
  /** Scalar result — string, number, boolean (true/false), or null (missing) */
  value: number | string | boolean | null;
  /** Physical unit ("kg", "ml", "g") or empty string for dimensionless values */
  unit?: string;
  observedAt?: Date | null;
  quality: EvidenceQuality;
  /**
   * DB table or computed source that produced this Evidence.
   * Format: "table_name (columns)" or "observer_audit" for explicit gap markers.
   */
  source: string;
  /** Trend direction if applicable */
  trend?: "up" | "down" | "stable" | "volatile" | null;
}

export interface ObserverOutput {
  observerId: string;
  findings: Evidence[];
  ranAt: Date;
  windowsCovered: ObserverWindow[];
  /** Data sources queried — used in Observer Coverage Audit */
  sourcesQueried: string[];
}

/**
 * Detected change in a follow-up message that may require Observer reruns.
 * E.g. user reveals they were in Las Vegas → triggers Restaurant + Lifestyle rerun.
 */
export interface EvidenceDelta {
  type: "location" | "date_correction" | "new_symptom" | "correction" | "new_fact";
  description: string;
  /** Observer IDs whose dependencies intersect this delta */
  affectedObservers: string[];
  raw: string;
}

// ─── Pattern Matching ────────────────────────────────────────────────────────

/**
 * Interpretation boundary — what the coach IS and IS NOT permitted to conclude
 * from a matched pattern, regardless of confidence level.
 *
 * This separates trigger evidence (when to investigate) from clinical claim
 * (what to assert). Numbers in trigger predicates are investigation signals,
 * not clinical facts.
 */
export interface InterpretationBoundary {
  /**
   * Safe interpretive framings the rendering pass may use.
   * Written as natural-language examples — not literal templates.
   * Example: "Your recent weight readings show an upward trend worth exploring"
   */
  allowedFramings: string[];
  /**
   * Causal or diagnostic claims that are explicitly forbidden — even at high confidence.
   * Example: "You gained fat", "Low calories is causing your fatigue"
   */
  forbiddenFramings: string[];
  /**
   * Below this confidence level, causal connective language ("is causing", "because of")
   * must be replaced with hedged language ("may suggest", "one possibility is").
   */
  causalLanguageMinConfidence: ConfidenceLevel;
}

export interface KnowledgePatternRule {
  /** Intent keywords that activate this pattern */
  triggerIntents: string[];
  /**
   * Evidence predicates that justify investigating this pattern.
   * These are signals that warrant exploration — NOT clinical thresholds.
   * "weight trend upward" is a trigger; it is not a conclusion about cause.
   */
  requiredEvidence: Array<{
    observer: string;
    metric: string;
    window: ObserverWindow;
    predicate: "present" | "elevated" | "low" | "missing" | "changed" | "trending_up" | "trending_down" | "flat";
    /** Investigation signal only — not a clinical fact */
    investigationSignalNote?: string;
  }>;
  /** Evidence that disqualifies this pattern */
  contraindications?: Array<{
    observer: string;
    metric: string;
    predicate: string;
  }>;
  /** How to score confidence for this pattern */
  confidenceRule: {
    highRequires: string[];
    moderateRequires: string[];
  };
  safetyClass: SafetyClass;
  /** What the coach may and may not conclude when this pattern matches */
  interpretationBoundaries: InterpretationBoundary;
}

export interface KnowledgePatternTemplate {
  interpretation: string;
  actionTemplates: Array<{
    horizon: ActionHorizon;
    kind: ActionItemKind;
    text: string;
    completionSignal?: CompletionSignal;
  }>;
  learningTemplates: Array<{
    observer: string;
    ask: string;
    benefit: string;
    /** Cooldown key — suppresses re-asking the same thing too soon */
    cooldownKey: string;
  }>;
}

export interface MatchedPattern {
  patternId: string;
  patternKey: string;
  version: number;
  safetyClass: SafetyClass;
  rule: KnowledgePatternRule;
  template: KnowledgePatternTemplate;
  evidenceSatisfied: string[];
  evidenceMissing: string[];
  /** 0.0–1.0, computed server-side from evidence coverage */
  coverageScore: number;
}

// ─── Confidence & Style ──────────────────────────────────────────────────────

export interface ConfidenceAssessment {
  level: ConfidenceLevel;
  coverageScore: number;
  evidenceSatisfied: string[];
  evidenceMissing: string[];
  hasConflict: boolean;
  conflictDescription?: string;
  /** If true: causal language and major plan items are suppressed */
  suppressCausal: boolean;
}

// ─── Reasoning Pass (internal LLM pass — JSON only) ──────────────────────────

/**
 * Output of the first LLM pass.
 * Citations must reference evidence IDs from the ObserverOutput — server validates.
 * The LLM cannot introduce facts not in the evidence block.
 */
export interface ReasoningResult {
  /** What the user is actually asking / concerned about */
  primaryConcern: string;
  /** Each hypothesis with its evidence citations */
  hypotheses: Array<{
    explanation: string;
    /** IDs of Evidence items that support this — server validates existence */
    evidenceCitationIds: string[];
    likelihood: "most_likely" | "possible" | "unlikely";
  }>;
  /** Which hypothesis the coach should lead with */
  leadHypothesis: string;
  /** Proposed confidence — server will override with its own scoring */
  proposedConfidence: ConfidenceLevel;
  /** Safety flag — if true, server stops coaching and advises care team */
  redFlag: boolean;
  redFlagReason?: string;
  /** Missing data that would have changed the reasoning */
  missingData: string[];
}

// ─── Today's Plan ────────────────────────────────────────────────────────────

export interface TodayPlanItem {
  horizon: ActionHorizon;
  kind: ActionItemKind;
  text: string;
  dueAt?: string; // ISO date string
  completionSignal?: CompletionSignal;
  /** For use_feature items: which MPM feature to redirect to */
  featureTarget?: string;
}

/**
 * The four-part action plan. Always present in every response.
 * Exception: safety escalation → single item "contact your care team."
 */
export interface TodayPlan {
  /** Why this plan — grounded in the evidence */
  why: string;
  /** 1–3 concrete action items */
  items: TodayPlanItem[];
  /** How we will know if the plan worked */
  successMetric: string;
  /** When to check in (e.g. "Friday morning") */
  nextCheckIn: string;
  followUpAt?: string; // ISO date string for the follow-up job
}

// ─── Coaching Response (final LLM pass — 4 sections) ────────────────────────

/**
 * The four-section response delivered to the user.
 * The LLM populates these sections from the validated ReasoningResult.
 * The server validates all fields before persisting or returning.
 */
export interface CoachResponse {
  /** "I looked through your recent activity. I noticed..." */
  whatIFound: string;
  /** "This pattern often means..." */
  whatItCouldMean: string;
  /** The structured 4-part plan */
  todayPlan: TodayPlan;
  /**
   * "I can probably narrow this down much more next time. If you log X..."
   * Null when: evidence already sufficient, user is overwhelmed, safety escalation,
   * or cooldown for this ask is active.
   */
  learningOpportunity: string | null;
  /** Internal metadata — not shown to user */
  meta: {
    specialization: CoachSpecialization;
    confidence: ConfidenceLevel;
    styleMode: StyleMode;
    patternKeys: string[];
    observersRun: string[];
    redFlag: boolean;
  };
}

// ─── Memory ──────────────────────────────────────────────────────────────────

export interface CoachingMemoryEntry {
  id: string;
  userId: string;
  specialization: CoachSpecialization;
  category: MemoryCategory;
  key: string;
  valueJson: Record<string, unknown>;
  confidence: number; // 0.0–1.0
  sourceMessageId: string | null;
  status: MemoryStatus;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface NutritionMemoryEntry {
  id: string;
  userId: string;
  key: string;
  valueJson: Record<string, unknown>;
  confidence: number; // 0.0–1.0
  source: string;
  confirmedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

/**
 * Memory candidates proposed by the LLM after each conversation.
 * The server validates, deduplicates, and accepts or rejects each one.
 */
export interface MemoryCandidate {
  type: "coaching" | "nutrition";
  category?: MemoryCategory;
  key: string;
  valueJson: Record<string, unknown>;
  confidence: number;
  rationale: string;
}

// ─── Coaching Tool (Capability Registry) ─────────────────────────────────────

/**
 * A specialized MPM feature that a coach can redirect subjects into.
 *
 * Product Intelligence scope lives HERE — on the specialization adapter's
 * capability registry — not on CoachSubject. CoachSubject answers only
 * "who are we coaching and who is authorized?" The adapter answers
 * "which MPM tools are available for this subject type?"
 *
 * Corner adapter    → adult Product Intelligence
 * Pregnancy adapter → pregnancy-aware Product Intelligence
 * Pediatric adapter → Beginnings Product Intelligence (child subject, pediatric safety)
 */
export interface CoachingTool {
  id: string;
  /** Scoped to this subject type — prevents cross-subject tool routing */
  scope: "adult" | "pregnancy" | "beginnings";
  /** Human-readable label shown in redirect prompts */
  label: string;
  /** Client-side route or feature deeplink the coach redirects to */
  featureTarget: string;
  /** Short description of what this tool does — used in coaching prompts */
  description: string;
}

// ─── Specialization Interface ─────────────────────────────────────────────────

/**
 * Every specialization must implement this contract.
 * The engine calls these methods — specializations never call the engine.
 *
 * Specializations can only add restrictions — never remove global safety rules.
 * The pediatric adapter will be more restrictive than adult; never less.
 */
export interface CoachSpecializationAdapter {
  id: CoachSpecialization;
  /** Human-readable name for logging */
  name: string;
  /** Validate and load the subject — throws 401/403 if authorization fails */
  loadSubject(req: unknown): Promise<CoachSubject>;
  /** Which Observers are available for this specialization */
  supportedObservers: string[];
  /** Specialization-specific safety rules (merged on top of global rules, never replacing them) */
  safetyRules: string[];
  /** Knowledge pattern keys scoped to this specialization */
  knowledgeScopes: string[];
  /**
   * Specialized MPM tools this subject type can be redirected into.
   * This is where Product Intelligence scope is declared — not on CoachSubject.
   */
  availableTools: CoachingTool[];
  /** Additional context to inject into prompts beyond Observer evidence */
  loadAdditionalContext(subject: CoachSubject): Promise<Record<string, unknown>>;
}

// ─── Observer Interface ───────────────────────────────────────────────────────

export interface ObserverConfig {
  id: string;
  name: string;
  description: string;
  supportedWindows: ObserverWindow[];
  /** Specializations that can use this Observer */
  supportedSpecializations: CoachSpecialization[];
  /** Intent keywords that make this Observer relevant */
  relevantIntents: string[];
  /**
   * DB tables queried by this Observer.
   * Populated on stubs for the Phase 3 Observer Coverage Audit.
   * Format: "table_name (relevant columns)"
   */
  sourcesQueried?: string[];
}

// ─── Coaching Context Snapshot (Phase 1 — Coaching Intelligence Layer) ───────

/**
 * Provenance envelope for a single coaching context field.
 *
 * status values:
 *   'observed'        — data is present and non-zero
 *   'zero'            — data is present and legitimately zero (not missing)
 *   'missing'         — no data found in the database for this field
 *   'not_applicable'  — this field does not apply to this user or specialization
 *
 * The LLM must treat 'missing' and 'zero' differently:
 *   - missing: do not pretend to know; ask or acknowledge the gap
 *   - zero: the user has done something (e.g., logged 0g fiber) — reason from it
 */
export interface FieldValue<T> {
  value: T | null;
  status: "observed" | "zero" | "missing" | "not_applicable";
  /** Which DB table or resolver produced this value */
  source?: string;
  /**
   * For prescription fields: which resolver tier produced the target.
   * "macro_calculator" | "performance_overlay" | "procare"
   */
  sourceType?: string;
  observedAt?: Date;
}

/**
 * Overall confidence in the coaching engine's picture of this person right now.
 *
 * HIGH:    Prescription + today's macro logs both present. Engine can coach from data.
 * PARTIAL: Some signals present. Engine should note what's missing.
 * LOW:     Minimal data. Engine must not pretend to know — ask instead of guessing.
 */
export type DataConfidence = "HIGH" | "PARTIAL" | "LOW";

/** Condensed capability entry injected into coaching prompts */
export interface PromptCapability {
  id: string;
  label: string;
  route: string;
  description: string;
  applicableSituations: string[];
}

/**
 * The canonical factual record for a single coaching turn.
 *
 * Built once by coachingContext.ts at the start of each turn.
 * Observers and both LLM passes receive this snapshot — they do not
 * re-query the same tables independently.
 *
 * CRITICAL: Every field that could be missing carries a FieldValue<T> envelope.
 * The LLM is instructed to treat 'missing' status as "I don't know" — not as zero.
 */
export interface CoachingContextSnapshot {
  subject: {
    userId: string;
    timezone: string;
    asOf: Date;
    /** Local hour of day (0–23) — used for meal completeness estimation */
    localHour: number;
  };

  profile: {
    goalType: FieldValue<string>;
    goalTarget: FieldValue<string>;
    dietaryRestrictions: string[];
    medicalConditions: string[];
    specialtyConditions: string[];
    activityLevel: FieldValue<string>;
    fitnessGoal: FieldValue<string>;
  };

  prescription: {
    calories: FieldValue<number>;
    protein: FieldValue<number>;
    carbs: FieldValue<number>;
    fat: FieldValue<number>;
    starchyCarbs: FieldValue<number>;
    fibrousCarbs: FieldValue<number>;
    /** Which resolver tier produced this: "macro_calculator" | "performance_overlay" | "procare" */
    source: string | null;
    sourceVersion: string | null;
    /** "training" | "rest" | null — only set when Performance Mode is active */
    performanceDayType: string | null;
    prescribedAt: Date | null;
  };

  today: {
    /** Human-readable local time string, e.g. "14:30" */
    localTime: string;

    macros: {
      calories: FieldValue<number>;
      protein: FieldValue<number>;
      carbs: FieldValue<number>;
      fat: FieldValue<number>;
      fiber: FieldValue<number>;
    };

    meals: {
      count: FieldValue<number>;
      /**
       * Completeness of today's meal logging.
       * 'unknown' is the honest answer when evidence is insufficient.
       * Never manufactured from meal count alone — requires time-of-day +
       * 7-day average before upgrading to 'partial' or 'complete'.
       */
      completeness: "complete" | "partial" | "unknown";
      lastLoggedAt: Date | null;
      /** Average meals per log day over last 7 days — used for completeness estimation */
      avgPerLogDay7: number | null;
    };

    hydration: {
      oz: FieldValue<number>;
    };

    checkin: {
      hunger: FieldValue<number>;   // 1–10 scale
      energy: FieldValue<number>;   // 1–10 scale
      mood: FieldValue<number>;     // 1–10 scale
      stress: FieldValue<number>;   // 1–10 scale
      cravings: FieldValue<number>; // 1–10 scale
      // sleep intentionally omitted — MPM does not collect sleep in Today's Check-In
    };
  };

  overlays: {
    glp1Active: boolean;
    pregnancyActive: boolean;
    performanceModeActive: boolean;
    antiInflammatoryActive: boolean;
    diabeticActive: boolean;
  };

  /**
   * Clinical context — only populated when the specialization has declared
   * permittedClinicalScopes. cornerAdapter receives null here.
   */
  clinical: {
    permittedScopes: string[];
    data: Record<string, unknown> | null;
  } | null;

  /**
   * Canonical classification of how much the engine knows about this person today.
   * The LLM is instructed to open with this context level.
   */
  dataConfidence: DataConfidence;

  /**
   * Filtered capability list — only features the user can access.
   * The LLM must use only these routes for feature redirects.
   */
  capabilities: PromptCapability[];
}

// ─── Supportive Accountability & Reinforcement Doctrine (Phase 2 governing layer) ──

/**
 * Describes the EVIDENCE PATTERN for a coaching turn — not the person.
 * "inconsistent" = what the data shows; never characterize the user's identity.
 */
export type BehaviorProgressState =
  | "consistent"            // 5+ of 7 days logged, adherence close to target
  | "improving"             // recent period better than prior period, or recovery detected
  | "inconsistent"          // some participation but gaps or below-target adherence
  | "declining"             // clear downward trend vs prior period
  | "insufficient_evidence"; // <2 days of data — cannot draw a pattern

/**
 * Server-side behavioral evidence classification.
 * MPM produces this. The LLM does not invent it.
 *
 * recoveryDetected is INDEPENDENT from evidencePattern.
 * A user can be in an "inconsistent" pattern but have recoveryDetected=true
 * (logged today after several missed days). That return is worth reinforcing.
 */
export interface BehaviorProgressSignal {
  /** Evidence pattern — describes data, NOT the person */
  evidencePattern: BehaviorProgressState;
  /** User returned after a lapse — reinforce the return, not the absence */
  recoveryDetected: boolean;
  /** Raw logging days this week (0–7) */
  loggingDays7d: number;
  /** Calorie adherence % on logged days (null if unknown) */
  calorieAdherence7d: number | null;
  /** Protein adherence % on logged days (null if unknown) */
  proteinAdherence7d: number | null;
  /** Specific positive behaviors visible in the evidence */
  behaviorHighlights: string[];
  /** Specific gaps — framed as patterns to address, not failures */
  behaviorConcerns: string[];
  /** Whether weight or adherence trends are visible (enough data to show outcomes) */
  outcomeVisible: boolean;
  /** Whether user used an MPM tool (Smart Scan, Restaurant Guide, etc.) */
  toolUsageDetected: boolean;
  /** Whether today's check-in has been completed */
  checkInParticipation: boolean;
}

// ─── Coaching Reasoning Library (Phase 2) ────────────────────────────────────

/**
 * A Reasoning Family is a server-controlled coaching logic object.
 * It defines how an experienced coach thinks through a specific situation.
 *
 * The LLM is given the BRIEF (server-evaluated output), not the family itself.
 * MPM decides what the evidence means and what actions are permissible.
 * The LLM connects and explains those approved pieces naturally.
 */
export interface ReasoningFamilyEvidenceField {
  /** Path in CoachingContextSnapshot or observer output tag — for logging only */
  snapshotPath: string;
  /** Human-readable label shown in the reasoning brief */
  label: string;
  importance: "required" | "helpful" | "contextual";
  /** Why this field matters for this family */
  why: string;
}

export interface ReasoningFamilyInterpretation {
  id: string;
  /** English condition description — not code-evaluated, used for LLM context */
  condition: string;
  /** What this pattern means — approved interpretation text */
  interpretation: string;
  likelihood: "most_likely" | "possible" | "unlikely";
  /**
   * Which snapshot paths must be 'observed' (not missing) for this
   * interpretation to be applicable. Server evaluates this before including.
   */
  requiresObservedPaths: string[];
}

export interface ReasoningFamilyAction {
  kind: ActionItemKind;
  description: string;
  /** English condition for when this action applies */
  condition?: string;
  /** Capability ID from the registry — for feature handoff */
  featureId?: string;
  /** What context to pass to the feature (English description) */
  contextToPass?: string;
}

export interface ReasoningFamily {
  id: string;
  name: string;
  description: string;

  /**
   * How this family activates.
   * ANY match (any keyword OR any intent ID) triggers consideration.
   * Final selection is by coverage score (how much evidence is available).
   */
  activation: {
    intentKeywords: string[];   // substrings to match in user message (lowercase)
    intentIds: string[];        // engine-detected intent IDs that trigger this family
  };

  /**
   * Is this family a modifier applied on top of another family,
   * rather than a standalone primary response?
   * Used for Reinforcement — it prepends acknowledgment to any response.
   */
  isModifier?: boolean;

  /** The central question the coach is trying to answer */
  primaryQuestion: string;

  /** What snapshot/observer fields the server evaluates */
  evidenceNeeded: ReasoningFamilyEvidenceField[];

  /** Server-evaluated interpretations (server checks requiresObservedPaths) */
  interpretationRules: ReasoningFamilyInterpretation[];

  missingEvidenceBehavior: {
    canStillCoach: boolean;
    /** snapshotPaths that must be 'observed' to coach at all */
    minimumRequiredPaths: string[];
    /** Questions to ask when minimum evidence is absent */
    askFirst: string[];
    maxConfidenceWithoutMinimum: ConfidenceLevel;
  };

  /** Actions the LLM is permitted to suggest */
  safeActions: ReasoningFamilyAction[];

  /** What logging/data would improve next coaching turn */
  learningOpportunity: string;

  /**
   * Explicit list of conclusions the LLM must NOT draw.
   * These are injected verbatim into the FORBIDDEN CONCLUSIONS block.
   */
  forbiddenConclusions: string[];
}

/**
 * The server-evaluated brief passed to the LLM reasoning pass.
 * Built by reasoningFamilyMatcher.ts — not by the LLM.
 *
 * This is what the LLM sees. It is always server-determined.
 */
export interface ReasoningFamilyBrief {
  familyId: string;
  familyName: string;
  primaryQuestion: string;
  isModifier: boolean;

  /** Evidence fields with server-evaluated values and statuses */
  evidenceAvailable: Array<{
    label: string;
    value: string;    // formatted or "MISSING" or "N/A"
    status: "observed" | "zero" | "missing" | "not_applicable";
    importance: "required" | "helpful" | "contextual";
  }>;

  /** Interpretation rules that pass their requiresObservedPaths check */
  applicableInterpretations: Array<{
    interpretation: string;
    likelihood: "most_likely" | "possible" | "unlikely";
  }>;

  /** Actions the LLM may suggest — only from the family's safeActions */
  approvedActions: ReasoningFamilyAction[];

  /** Hard limits on what the LLM may conclude */
  forbiddenConclusions: string[];

  /** Confidence ceiling the LLM cannot exceed */
  maxConfidence: ConfidenceLevel;

  /** Questions to ask if minimum evidence is missing */
  askFirst: string[];

  /** What logging would make next response better */
  learningOpportunity: string;

  /** Whether minimum evidence is present for this family to coach */
  hasMinimumEvidence: boolean;
}

// ─── Observer Coverage Audit (Phase 3 gate) ──────────────────────────────────

export interface ObserverCoverageReport {
  observer: string;
  sources: Array<{
    table: string;
    column?: string;
    status: "wired" | "not_yet_observable" | "partial";
    notes?: string;
  }>;
  windowsCovered: ObserverWindow[];
  generatedAt: Date;
}
