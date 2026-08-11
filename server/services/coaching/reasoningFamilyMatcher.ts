/**
 * Coaching Reasoning Library — Family Matcher
 *
 * Selects the best-matching reasoning family for a coaching turn and
 * produces a server-evaluated ReasoningFamilyBrief for the LLM reasoning pass.
 *
 * ARCHITECTURE:
 *   Does NOT query the database. All evidence comes from:
 *     - CoachingContextSnapshot (Phase 1 — today's data)
 *     - ObserverOutput[] (Phase 3 — trends and history)
 *
 *   This runs server-side BEFORE any LLM call.
 *   The LLM receives the brief — not the family definition itself.
 *
 * MATCHING ALGORITHM:
 *   1. Score each primary family by keyword match + evidence coverage
 *   2. Select highest-scoring family above threshold
 *   3. Evaluate modifier families (reinforcement) independently
 *   4. Evaluate evidence availability for selected family
 *   5. Apply interpretation rules (check requiresObservedPaths)
 *   6. Return primary brief + optional modifier brief
 */

import type {
  CoachingContextSnapshot,
  ObserverOutput,
  ReasoningFamily,
  ReasoningFamilyBrief,
  ReasoningFamilyAction,
  ConfidenceLevel,
  FieldValue,
} from "../../../shared/coaching/types";
import { PRIMARY_FAMILIES, MODIFIER_FAMILIES } from "./reasoningLibrary/index";

// ─── Evidence Path Resolution ─────────────────────────────────────────────────

/**
 * Resolve a snapshotPath or observer path to a {value, status} pair.
 *
 * Two path formats:
 *   "today.macros.protein"            → deep read from CoachingContextSnapshot
 *   "observer.macro.log_frequency_7d" → find in ObserverOutput findings
 *   "overlays.performanceModeActive"  → boolean overlay flag
 */
interface ResolvedField {
  value: string;
  status: "observed" | "zero" | "missing" | "not_applicable";
}

function resolveSnapshotPath(
  path: string,
  snapshot: CoachingContextSnapshot,
  observerOutputs: ObserverOutput[]
): ResolvedField {
  // Observer path: "observer.<observerId>.<metric>"
  if (path.startsWith("observer.")) {
    const parts = path.split(".");
    const observerId = parts[1];
    const metric = parts.slice(2).join(".");
    return resolveObserverPath(observerId, metric, observerOutputs);
  }

  // Snapshot path: deep-read using dot notation
  const parts = path.split(".");
  let current: any = snapshot;
  for (const part of parts) {
    if (current === null || current === undefined) {
      return { value: "MISSING", status: "missing" };
    }
    current = current[part];
  }

  // FieldValue<T> object
  if (current !== null && typeof current === "object" && "status" in current) {
    const fv = current as FieldValue<unknown>;
    if (fv.status === "not_applicable") return { value: "N/A", status: "not_applicable" };
    if (fv.status === "missing") return { value: "MISSING", status: "missing" };
    if (fv.status === "zero") return { value: "0 (confirmed)", status: "zero" };
    return { value: String(fv.value ?? "—"), status: "observed" };
  }

  // Scalar (boolean, string, number)
  if (current === null || current === undefined) {
    return { value: "MISSING", status: "missing" };
  }
  if (typeof current === "boolean") {
    return { value: current ? "ACTIVE" : "inactive", status: "observed" };
  }
  if (typeof current === "string" && (current === "complete" || current === "partial" || current === "unknown")) {
    return { value: current.toUpperCase(), status: current !== "unknown" ? "observed" : "missing" };
  }
  return { value: String(current), status: "observed" };
}

function resolveObserverPath(
  observerId: string,
  metric: string,
  observerOutputs: ObserverOutput[]
): ResolvedField {
  const output = observerOutputs.find((o) => o.observerId === observerId);
  if (!output) return { value: "MISSING", status: "missing" };

  const finding = output.findings.find((f) => f.metric === metric);
  if (!finding) return { value: "MISSING", status: "missing" };

  if (finding.quality === "missing" || finding.value === null) {
    return { value: "MISSING", status: "missing" };
  }
  const val = finding.value;
  if (val === 0 || val === "0") return { value: "0 (confirmed)", status: "zero" };
  return { value: String(val), status: "observed" };
}

// ─── Family Scoring ───────────────────────────────────────────────────────────

interface FamilyScore {
  family: ReasoningFamily;
  keywordScore: number;
  evidenceCoverage: number;
  totalScore: number;
}

function scorePrimaryFamily(
  family: ReasoningFamily,
  userMessage: string,
  detectedIntent: string,
  snapshot: CoachingContextSnapshot,
  observerOutputs: ObserverOutput[]
): FamilyScore {
  const msg = userMessage.toLowerCase();

  // Keyword score: count matching keywords (each adds 1 point)
  let keywordScore = 0;
  for (const kw of family.activation.intentKeywords) {
    if (msg.includes(kw.toLowerCase())) keywordScore += 1;
  }

  // Intent ID match: bonus points for matching the detected intent
  if (family.activation.intentIds.includes(detectedIntent)) {
    keywordScore += 2; // intent match worth 2 keywords
  }

  // Evidence coverage: what fraction of "required" evidence is observed?
  const requiredFields = family.evidenceNeeded.filter((f) => f.importance === "required");
  const observedCount = requiredFields.filter((f) => {
    const resolved = resolveSnapshotPath(f.snapshotPath, snapshot, observerOutputs);
    return resolved.status === "observed" || resolved.status === "zero";
  }).length;

  const evidenceCoverage = requiredFields.length === 0
    ? 0.5  // no required evidence = neutral
    : observedCount / requiredFields.length;

  // Total: keywords are the primary signal, evidence coverage is a tiebreaker
  const totalScore = keywordScore + evidenceCoverage * 0.5;

  return { family, keywordScore, evidenceCoverage, totalScore };
}

// ─── Modifier Detection (Reinforcement) ──────────────────────────────────────

function shouldApplyReinforcement(observerOutputs: ObserverOutput[]): boolean {
  const complianceOutput = observerOutputs.find((o) => o.observerId === "compliance");
  if (!complianceOutput) return false;

  // Check macro log days — 5+ of last 7 days is a meaningful improvement signal
  const logDaysFinding = complianceOutput.findings.find(
    (f) => f.metric === "macro_log_days_7d" || f.metric === "log_days_7d"
  );
  if (!logDaysFinding) return false;

  const logDays = typeof logDaysFinding.value === "number"
    ? logDaysFinding.value
    : parseInt(String(logDaysFinding.value ?? "0"));

  // Only trigger reinforcement if we have strong participation (5+ days)
  // AND the quality signal suggests this represents an improvement
  return logDays >= 5;
}

// ─── Brief Builder ────────────────────────────────────────────────────────────

function buildBrief(
  family: ReasoningFamily,
  snapshot: CoachingContextSnapshot,
  observerOutputs: ObserverOutput[]
): ReasoningFamilyBrief {
  // Resolve all evidence fields
  const evidenceAvailable = family.evidenceNeeded.map((field) => {
    const resolved = resolveSnapshotPath(field.snapshotPath, snapshot, observerOutputs);
    return {
      label: field.label,
      value: resolved.value,
      status: resolved.status,
      importance: field.importance,
    };
  });

  // Check minimum evidence
  const minimumMet = family.missingEvidenceBehavior.minimumRequiredPaths.every((path) => {
    const resolved = resolveSnapshotPath(path, snapshot, observerOutputs);
    return resolved.status === "observed" || resolved.status === "zero";
  });

  // Apply interpretation rules: only include those where all requiresObservedPaths are satisfied
  const applicableInterpretations = family.interpretationRules
    .filter((rule) =>
      rule.requiresObservedPaths.every((path) => {
        const resolved = resolveSnapshotPath(path, snapshot, observerOutputs);
        return resolved.status === "observed" || resolved.status === "zero";
      })
    )
    .map((rule) => ({
      interpretation: rule.interpretation,
      likelihood: rule.likelihood,
    }));

  // Determine max confidence
  const hasRequiredEvidence = evidenceAvailable
    .filter((e) => e.importance === "required")
    .some((e) => e.status === "observed" || e.status === "zero");

  const maxConfidence: ConfidenceLevel = !minimumMet
    ? family.missingEvidenceBehavior.maxConfidenceWithoutMinimum
    : hasRequiredEvidence
    ? "high"
    : "moderate";

  // Approved actions — include all actions (LLM decides which apply based on interpretation)
  const approvedActions: ReasoningFamilyAction[] = family.safeActions;

  return {
    familyId: family.id,
    familyName: family.name,
    primaryQuestion: family.primaryQuestion,
    isModifier: family.isModifier ?? false,
    evidenceAvailable,
    applicableInterpretations,
    approvedActions,
    forbiddenConclusions: family.forbiddenConclusions,
    maxConfidence,
    askFirst: minimumMet ? [] : family.missingEvidenceBehavior.askFirst,
    learningOpportunity: family.learningOpportunity,
    hasMinimumEvidence: minimumMet || family.missingEvidenceBehavior.minimumRequiredPaths.length === 0,
  };
}

// ─── Main Matcher ─────────────────────────────────────────────────────────────

export interface ReasoningLibraryMatch {
  primary: ReasoningFamilyBrief | null;
  modifier: ReasoningFamilyBrief | null;
}

/**
 * Match a coaching turn against the reasoning library.
 *
 * @param userMessage - Raw user message text
 * @param detectedIntent - Engine-detected intent ID
 * @param snapshot - CoachingContextSnapshot from Phase 1
 * @param observerOutputs - Evidence from selected observers
 * @returns primary brief (may be null for true general inquiry) + optional modifier
 */
export function matchReasoningFamily(
  userMessage: string,
  detectedIntent: string,
  snapshot: CoachingContextSnapshot,
  observerOutputs: ObserverOutput[]
): ReasoningLibraryMatch {
  // Score all primary families
  const scores = PRIMARY_FAMILIES.map((family) =>
    scorePrimaryFamily(family, userMessage, detectedIntent, snapshot, observerOutputs)
  );

  // Sort by total score descending
  scores.sort((a, b) => b.totalScore - a.totalScore);

  // Select best match: must have at least 1 keyword match to activate
  const bestMatch = scores[0];
  const primaryBrief = bestMatch && bestMatch.keywordScore >= 1
    ? buildBrief(bestMatch.family, snapshot, observerOutputs)
    : null;

  // Evaluate modifier families (reinforcement) independently
  let modifierBrief: ReasoningFamilyBrief | null = null;
  for (const modifierFamily of MODIFIER_FAMILIES) {
    if (modifierFamily.id === "reinforcement" && shouldApplyReinforcement(observerOutputs)) {
      modifierBrief = buildBrief(modifierFamily, snapshot, observerOutputs);
      break;
    }
  }

  return { primary: primaryBrief, modifier: modifierBrief };
}

// ─── Prompt Renderer ──────────────────────────────────────────────────────────

/**
 * Renders a ReasoningFamilyBrief as a structured text block for the LLM.
 * This block is injected into the reasoning pass prompt.
 */
export function renderReasoningBriefForPrompt(
  match: ReasoningLibraryMatch
): string {
  const sections: string[] = [];

  if (match.modifier) {
    const mod = match.modifier;
    sections.push(
      `--- COACHING MODIFIER: ${mod.familyName} ---`,
      `The compliance/data signals indicate meaningful improvement in the user's participation.`,
      `Prepend a substantive, data-grounded acknowledgment to your whatIFound section.`,
      `Do NOT use gamification language. State SPECIFICALLY what the data now shows that it couldn't before.`,
      `Example: "This helps — you've logged consistently this week, so I can actually see a pattern instead of guessing."`,
      `Then continue with the primary coaching response below.`,
      ``
    );
  }

  if (match.primary) {
    const p = match.primary;
    const missingRequired = p.evidenceAvailable
      .filter((e) => e.importance === "required" && e.status === "missing")
      .map((e) => e.label);
    const presentEvidence = p.evidenceAvailable
      .filter((e) => e.status === "observed" || e.status === "zero");

    sections.push(
      `=== COACHING REASONING BRIEF ===`,
      `Family: ${p.familyName}`,
      `Primary Question: ${p.primaryQuestion}`,
      `Maximum Confidence: ${p.maxConfidence.toUpperCase()}`,
      ``
    );

    if (presentEvidence.length > 0) {
      sections.push(`── EVIDENCE AVAILABLE ──`);
      for (const e of presentEvidence) {
        sections.push(`  ${e.importance === "required" ? "[REQUIRED]" : "[" + e.importance.toUpperCase() + "]"} ${e.label}: ${e.value}`);
      }
      sections.push(``);
    }

    if (missingRequired.length > 0) {
      sections.push(
        `── MISSING REQUIRED EVIDENCE ──`,
        ...missingRequired.map((label) => `  • ${label}`),
        ``
      );
    }

    if (p.applicableInterpretations.length > 0) {
      sections.push(`── SERVER-APPROVED INTERPRETATIONS (use these — do not invent others) ──`);
      for (const interp of p.applicableInterpretations) {
        sections.push(`  [${interp.likelihood.toUpperCase()}] ${interp.interpretation}`);
      }
      sections.push(``);
    }

    if (p.approvedActions.length > 0) {
      sections.push(`── APPROVED COACHING ACTIONS ──`);
      for (const action of p.approvedActions) {
        const handoff = action.featureId ? ` → redirect to feature: ${action.featureId}` : "";
        const cond = action.condition ? ` (when: ${action.condition})` : "";
        sections.push(`  • [${action.kind}] ${action.description}${cond}${handoff}`);
      }
      sections.push(``);
    }

    if (p.forbiddenConclusions.length > 0) {
      sections.push(`── FORBIDDEN CONCLUSIONS (you must not state or imply any of these) ──`);
      for (const forbidden of p.forbiddenConclusions) {
        sections.push(`  ✗ ${forbidden}`);
      }
      sections.push(``);
    }

    if (p.askFirst.length > 0) {
      sections.push(
        `── MINIMUM EVIDENCE NOT MET ──`,
        `Personalized coaching on this topic requires the data above. However:`,
        `IMPORTANT: Do NOT leave the user empty-handed. You MUST still provide general`,
        `education and safe nutritional guidance on this topic at a general level.`,
        `Label it clearly as general (not personalized to this user's data).`,
        `Then — as a natural, conversational close — include these questions to gather`,
        `what is needed to make the next response personalized:`,
        ...p.askFirst.map((q) => `  • "${q}"`),
        `Weave the questions in naturally. Do not present them as a list of demands.`,
        ``
      );
    }

    if (p.learningOpportunity) {
      sections.push(
        `── LEARNING OPPORTUNITY (suggest in learningOpportunity field if appropriate) ──`,
        `  ${p.learningOpportunity}`,
        ``
      );
    }

    sections.push(`=== END REASONING BRIEF ===`);
  }

  return sections.join("\n");
}
