/**
 * Coaching Engine — Pattern Matcher
 *
 * Deterministic match against the knowledge_patterns table.
 * Runs BEFORE any LLM call.
 *
 * The LLM never sees raw clinical rules — only the approved template output.
 * This ensures the coaching philosophy is always governed by the platform,
 * not by whatever the model generates.
 *
 * Match algorithm:
 *   1. Filter patterns by specialization scope + is_active = true
 *   2. Check trigger intent overlap
 *   3. Check required evidence predicates against ObserverOutput
 *   4. Check contraindications
 *   5. Score coverage (satisfied / total required evidence)
 *   6. Return sorted by coverage score descending
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";
import type {
  ObserverOutput,
  MatchedPattern,
  CoachSpecialization,
  Evidence,
  EvidenceQuality,
  KnowledgePatternRule,
  KnowledgePatternTemplate,
} from "../../../shared/coaching/types";

interface RawPattern extends Record<string, unknown> {
  id: string;
  key: string;
  version: number;
  safety_class: string;
  rule_json: KnowledgePatternRule;
  template_json: KnowledgePatternTemplate;
}

/**
 * Match knowledge patterns against detected intent and Observer evidence.
 *
 * @param intent - The detected intent string (e.g. "weight_gain", "fatigue")
 * @param observerOutputs - Evidence from all selected Observers
 * @param knowledgeScopes - Which specialization scopes to search (e.g. ["corner", "all"])
 * @param specialization - Current specialization (for logging)
 */
export async function matchPatterns(
  intent: string,
  observerOutputs: ObserverOutput[],
  knowledgeScopes: string[],
  specialization: CoachSpecialization
): Promise<MatchedPattern[]> {
  if (knowledgeScopes.length === 0) return [];

  const allEvidence = observerOutputs.flatMap((o) => o.findings);
  const evidenceIndex = buildEvidenceIndex(allEvidence);

  // Load active patterns for these scopes.
  // NOTE: drizzle sql`` expands a JS array as a row-constructor tuple ($1,$2),
  // which breaks ANY(). Build individual parameterized OR conditions instead.
  const scopeConditions = knowledgeScopes.map((s) => sql`specialization = ${s}`);
  const whereClause = scopeConditions.reduce((a, b) => sql`${a} OR ${b}`);

  const rows = await db.execute<RawPattern>(sql`
    SELECT id, key, version, safety_class, rule_json, template_json
    FROM knowledge_patterns
    WHERE (${whereClause})
      AND is_active = true
    ORDER BY created_at ASC
  `);

  const candidates: MatchedPattern[] = [];

  for (const row of rows.rows) {
    const rule: KnowledgePatternRule = row.rule_json as KnowledgePatternRule;
    const template: KnowledgePatternTemplate = row.template_json as KnowledgePatternTemplate;

    // 1. Check trigger intent overlap
    if (!intentMatches(intent, rule.triggerIntents)) continue;

    // 2. Check contraindications — if any fire, skip this pattern
    if (contraindicationFires(rule.contraindications ?? [], evidenceIndex)) continue;

    // 3. Score evidence coverage
    const { satisfied, missing, coverageScore } = scoreEvidence(rule.requiredEvidence, evidenceIndex);

    // Pattern qualifies if at least one required evidence item is satisfied
    // (or there's no required evidence — pure intent match)
    if (rule.requiredEvidence.length > 0 && satisfied.length === 0) continue;

    candidates.push({
      patternId: row.id,
      patternKey: row.key,
      version: row.version,
      safetyClass: row.safety_class as any,
      rule,
      template,
      evidenceSatisfied: satisfied,
      evidenceMissing: missing,
      coverageScore,
    });
  }

  // Sort by coverage score descending — highest coverage first
  return candidates.sort((a, b) => b.coverageScore - a.coverageScore);
}

// ─── Intent Matching ──────────────────────────────────────────────────────────

function intentMatches(detectedIntent: string, triggerIntents: string[]): boolean {
  const normalized = detectedIntent.toLowerCase();
  return triggerIntents.some((trigger) => {
    const t = trigger.toLowerCase().replace(/_/g, " ");
    const d = normalized.replace(/_/g, " ");
    return d === t || d.includes(t) || t.includes(d);
  });
}

// ─── Evidence Index ───────────────────────────────────────────────────────────

interface EvidenceKey {
  observer?: string;
  metric: string;
  quality: EvidenceQuality;
  trend?: string | null;
  value?: number | string | boolean | null;
}

function buildEvidenceIndex(evidence: Evidence[]): Map<string, EvidenceKey> {
  const index = new Map<string, EvidenceKey>();
  for (const e of evidence) {
    const key = `${e.observer}.${e.metric}.${e.window}`;
    index.set(key, {
      observer: e.observer,
      metric: e.metric,
      quality: e.quality,
      trend: e.trend,
      value: e.value,
    });
  }
  return index;
}

// ─── Evidence Predicate Evaluation ───────────────────────────────────────────

function scoreEvidence(
  requiredEvidence: KnowledgePatternRule["requiredEvidence"],
  index: Map<string, EvidenceKey>
): { satisfied: string[]; missing: string[]; coverageScore: number } {
  const satisfied: string[] = [];
  const missing: string[] = [];

  for (const req of requiredEvidence) {
    const key = `${req.observer}.${req.metric}.${req.window}`;
    const found = index.get(key);
    const ref = `${req.observer}.${req.metric}`;

    if (!found || found.quality === "missing") {
      missing.push(ref);
      continue;
    }

    if (predicateSatisfied(req.predicate, found)) {
      satisfied.push(ref);
    } else {
      missing.push(ref);
    }
  }

  const coverageScore = requiredEvidence.length === 0
    ? 1.0
    : satisfied.length / requiredEvidence.length;

  return { satisfied, missing, coverageScore };
}

function predicateSatisfied(
  predicate: string,
  evidence: EvidenceKey
): boolean {
  switch (predicate) {
    case "present":
      return evidence.quality !== "missing" && evidence.value !== null;
    case "missing":
      return evidence.quality === "missing" || evidence.value === null;
    case "elevated":
      return evidence.trend === "up" || evidence.quality === "measured";
    case "low":
      return evidence.trend === "down" || evidence.quality === "measured";
    case "trending_up":
      return evidence.trend === "up";
    case "trending_down":
      return evidence.trend === "down";
    case "flat":
      return evidence.trend === "stable";
    case "changed":
      return evidence.trend === "up" || evidence.trend === "down";
    default:
      return evidence.quality !== "missing";
  }
}

// ─── Contraindication Check ───────────────────────────────────────────────────

function contraindicationFires(
  contraindications: NonNullable<KnowledgePatternRule["contraindications"]>,
  index: Map<string, EvidenceKey>
): boolean {
  for (const contra of contraindications) {
    // Check all windows for this observer.metric combination
    for (const window of ["today", "7d", "30d", "90d"]) {
      const key = `${contra.observer}.${contra.metric}.${window}`;
      const found = index.get(key);
      if (found && predicateSatisfied(contra.predicate, found)) {
        return true;
      }
    }
  }
  return false;
}
