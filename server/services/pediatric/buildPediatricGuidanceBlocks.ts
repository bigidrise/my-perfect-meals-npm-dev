/**
 * buildPediatricGuidanceBlocks.ts
 *
 * Assembles conditionGuidanceBlocks[] from an active child profile.
 * Mirrors the adult pattern in universalMedicalGuidance.ts / protocolEnvelope.ts.
 *
 * Also produces a conflict resolution log: when two active protocols want
 * incompatible things (e.g., Iron Deficiency wants spinach, Autism Sensory
 * blocks leafy greens), the conflict is detected, resolved by priority tier,
 * and documented in the output for full auditability.
 */

import {
  PEDIATRIC_PROTOCOL_REGISTRY,
  matchProtocols,
  checkHardStop,
  type PediatricProtocolBlock,
} from "./pediatricProtocolRegistry";
import { buildStageDRIBlock, type DevelopmentalStage } from "./pediatricStageConstants";
import { EVIDENCE_BY_CONDITION_ID, getStaleProtocolIds } from "./clinicalEvidenceRegistry";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AllergyDetailEntry {
  allergen: string;
  severity?: string;       // "mild" | "moderate" | "severe" | "anaphylactic"
  epiPen?: boolean;
  crossContact?: boolean;
  clinicianInstructions?: string;
}

export interface ChildProfileInput {
  /** Developmental stage — must match DevelopmentalStage union */
  developmentalStage: DevelopmentalStage;
  /** Medical conditions from child_profiles.medical_conditions JSONB */
  medicalConditions: string[];
  /** Sensory/feeding issues from child_profiles.sensory_issues JSONB */
  sensoryIssues?: string[];
  /** Feeding concerns from child_profiles.feeding_concerns JSONB */
  feedingConcerns?: string[];
  /** Growth context from child_profiles — optional */
  growth?: {
    pediatricianConcern?: string; // "none" | "underweight" | "overweight" | "failure_to_thrive"
  };
  /** Feeding ability from child_profiles */
  feedingAbility?: {
    textureLevel?: string;
    swallowingDifficulty?: boolean;
    hasFeedingTube?: boolean;
    historyOfChokingOrGagging?: boolean;
  };

  // ── Group 1: Growth and Nutrition Context ──────────────────────────────────
  /** Biological sex — context only, never used to diagnose or prescribe */
  sex?: string;
  /** Height in cm — reference context only, no weight-status labeling */
  heightCm?: number;
  /** Weight in kg — reference context only, no weight-status labeling */
  weightKg?: number;
  /** Parent-reported: medication affects appetite or weight */
  medicationAffectsAppetite?: boolean;
  /** Birth history JSONB — developmental context */
  birthHistory?: Record<string, any>;
  /** Family nutrition goals (parent-stated, not clinical directives) */
  familyGoals?: string[];

  // ── Group 2: Allergy Detail and Feeding Safety ────────────────────────────
  /** Structured allergy details: severity, EpiPen, cross-contact, clinician notes */
  allergyDetails?: AllergyDetailEntry[];
  /** Feeding development history JSONB */
  feedingDevelopment?: Record<string, any>;

  // ── Group 3: School and Kitchen Context ────────────────────────────────────
  /** School-safe required: all allergens must be hard-blocked, packable format */
  schoolSafeRequired?: boolean;
  /** Kitchen equipment available (e.g. ["instant_pot", "blender"]) */
  kitchenEquipment?: string[];
  /** Kitchen budget level: "budget" | "moderate" | "flexible" */
  kitchenBudget?: string;
  /** Max cook time in minutes */
  kitchenTimeMinutes?: number;
  /** Cook skill level: "beginner" | "intermediate" | "advanced" */
  kitchenSkill?: string;
  /** Cultural cuisine preferences */
  culturalPreferences?: string;
}

export interface ProtocolConflict {
  /** The winning protocol (lower tier number) */
  winner: string;
  /** The losing protocol (higher tier number) */
  loser: string;
  /** What specifically conflicted */
  conflictedOn: string;
  /** How it was resolved */
  resolution: string;
}

export interface PediatricGuidanceOutput {
  /**
   * When true, meal generation must be blocked immediately.
   * Check this before injecting any guidance blocks.
   */
  hardBlocked: boolean;
  /** Populated when hardBlocked is true — the conditionId that caused the block. */
  hardBlockConditionId?: string;
  /** Populated when hardBlocked is true — shown to the parent. */
  hardBlockMessage?: string;
  /**
   * When hardBlocked is true, at least one active protocol requires a
   * clinician (always true for hard stops, but exposed for the inspector).
   */
  requiresClinicianFlag: boolean;
  /** True if at least one active protocol requires a dietitian. */
  requiresDietitianFlag: boolean;
  /**
   * Array of directive prompt strings — one per active condition.
   * Ordered by priority tier. Injected into system prompt.
   * Empty when hardBlocked is true.
   */
  conditionGuidanceBlocks: string[];
  /**
   * DRI baselines block for the developmental stage — always included.
   */
  stageDRIBlock: string;
  /**
   * Protocol conflict resolution log — included in the API response for
   * transparency. NOT injected into the system prompt (would add noise).
   */
  conflictLog: ProtocolConflict[];
  /**
   * List of active protocol IDs that fired — for logging and audit.
   */
  activeProtocolIds: string[];
  /**
   * Evidence metadata for each active protocol — for response annotation.
   */
  activeProtocolEvidence: Array<{
    conditionId: string;
    conditionName: string;
    version: string;
    sources: string[];
    status: string;
  }>;
  /**
   * Active protocol IDs whose reviewDate has passed.
   * These are still generating but MUST be surfaced in the Resolver Inspector
   * and Registry Health Dashboard — they must never silently drive generation.
   * Empty array means all active protocols are within their review window.
   */
  staleProtocolIds: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Conflict detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Known conflict pairs — (conditionA, conditionB) — and the specific item
 * that may conflict plus the resolution rule.
 *
 * Resolution always favors the lower priority tier.
 * Ties (same tier) → both blocks are injected; AI is instructed to balance.
 */
interface ConflictDefinition {
  conditionIdA: string;
  conditionIdB: string;
  conflictedOn: string;
  resolutionRule: string;
}

const KNOWN_CONFLICTS: ConflictDefinition[] = [
  {
    conditionIdA: "iron_deficiency",
    conditionIdB: "autism_sensory",
    conflictedOn: "leafy greens / spinach",
    resolutionRule:
      "Iron deficiency (Tier 4) wins on clinical necessity. " +
      "Spinach and iron-rich greens should be included but prepared in a format the child will accept (e.g., blended into a sauce, or served separately as a component). " +
      "Autism sensory guidance still applies for texture and presentation.",
  },
  {
    conditionIdA: "iron_deficiency",
    conditionIdB: "dysphagia",
    conflictedOn: "iron-rich foods requiring chewing (red meat, leafy greens)",
    resolutionRule:
      "Dysphagia (Tier 5) texture requirements apply to all foods including iron sources. " +
      "Use texture-modified iron-rich preparations: pureed lentils, smooth iron-fortified cereal, pureed meat. " +
      "Iron absorption is still addressed.",
  },
  {
    conditionIdA: "cystic_fibrosis",
    conditionIdB: "pediatric_obesity",
    conflictedOn: "caloric density — CF requires high calories; obesity protocol avoids excess fat",
    resolutionRule:
      "CF (Tier 3) overrides obesity protocol (Tier 4). Caloric density is medically required for CF. " +
      "Obesity guidance is suspended for this child. CF guidance takes full precedence.",
  },
  {
    conditionIdA: "cystic_fibrosis",
    conditionIdB: "t2d",
    conflictedOn: "dietary fat — CF requires high fat; T2D avoids excess fat",
    resolutionRule:
      "Both are Tier 3. CF-related diabetes (CFRD) has its own clinical guidelines. " +
      "Both protocols injected. AI is instructed to balance caloric density with moderate glycemic control. " +
      "Include note: 'CFRD management requires specialist dietitian guidance — consult your CF and endocrine care teams.'",
  },
  {
    conditionIdA: "ckd",
    conditionIdB: "iron_deficiency",
    conflictedOn: "spinach / leafy greens — high potassium (blocked by CKD) but iron-rich (needed for anemia)",
    resolutionRule:
      "CKD (Tier 3) wins. High-potassium greens like spinach are blocked. " +
      "Use low-potassium iron sources instead: lean meat, chicken, iron-fortified cereals, pumpkin seeds (small amounts). " +
      "Vitamin C pairing still applies with safe low-potassium foods.",
  },
  {
    conditionIdA: "celiac",
    conditionIdB: "crohns",
    conflictedOn: "oats — allowed for Crohn's (gluten-free certified), blocked by celiac unless certified GF",
    resolutionRule:
      "Celiac (Tier 3, same tier as Crohn's) requires certified GF oats only. " +
      "Use only certified gluten-free oats — applies to both protocols simultaneously.",
  },
  {
    conditionIdA: "failure_to_thrive",
    conditionIdB: "t1d",
    conflictedOn: "caloric density — FTT needs maximized calories; T1D needs carb consistency",
    resolutionRule:
      "Both Tier 3/4. Inject both protocols. Caloric density achieved through fat and protein sources (not excess carbohydrate). " +
      "Carb count must still be estimated for insulin management. Use calorie-dense, carb-consistent meals.",
  },
  {
    conditionIdA: "lupus",
    conditionIdB: "iron_deficiency",
    conflictedOn: "alfalfa sprouts — blocked by lupus but sometimes used as an iron source",
    resolutionRule:
      "Lupus (Tier 3) wins. Alfalfa sprouts are absolutely blocked. " +
      "Iron sourced from other foods: lentils, chicken, beef (small amounts), fortified cereals.",
  },
];

function detectConflicts(
  activeProtocols: PediatricProtocolBlock[]
): ProtocolConflict[] {
  const conflicts: ProtocolConflict[] = [];
  const activeIds = new Set(activeProtocols.map(p => p.conditionId));

  for (const def of KNOWN_CONFLICTS) {
    if (!activeIds.has(def.conditionIdA) || !activeIds.has(def.conditionIdB)) continue;

    const protoA = activeProtocols.find(p => p.conditionId === def.conditionIdA)!;
    const protoB = activeProtocols.find(p => p.conditionId === def.conditionIdB)!;

    // Lower tier number = higher priority
    const winner = protoA.priorityTier <= protoB.priorityTier ? protoA : protoB;
    const loser  = winner === protoA ? protoB : protoA;

    conflicts.push({
      winner: winner.conditionName,
      loser: loser.conditionName,
      conflictedOn: def.conflictedOn,
      resolution: def.resolutionRule,
    });
  }

  // Generic conflict: if any protocol blocks something that another requires
  for (let i = 0; i < activeProtocols.length; i++) {
    for (let j = i + 1; j < activeProtocols.length; j++) {
      const a = activeProtocols[i];
      const b = activeProtocols[j];

      // Check if a blocks something b requires
      const aBlocks = a.blocks ?? [];
      const bRequires = b.requiresOrPrefers ?? [];
      for (const blocked of aBlocks) {
        const conflicting = bRequires.find(req =>
          req.toLowerCase().includes(blocked.toLowerCase()) ||
          blocked.toLowerCase().includes(req.toLowerCase())
        );
        if (conflicting) {
          // Check if this conflict was already recorded via KNOWN_CONFLICTS
          const alreadyLogged = conflicts.some(
            c =>
              (c.winner === a.conditionName || c.winner === b.conditionName) &&
              c.conflictedOn.toLowerCase().includes(blocked.toLowerCase())
          );
          if (!alreadyLogged) {
            const winner = a.priorityTier <= b.priorityTier ? a : b;
            const loser  = winner === a ? b : a;
            conflicts.push({
              winner: winner.conditionName,
              loser: loser.conditionName,
              conflictedOn: `${blocked} (required by ${loser.conditionName}, blocked by ${winner.conditionName})`,
              resolution:
                `${winner.conditionName} (Tier ${winner.priorityTier}) takes precedence. ` +
                `${blocked} is excluded. Nutritional goals from ${loser.conditionName} must be met through alternative sources.`,
            });
          }
        }
      }

      // Check if b blocks something a requires (reverse)
      const bBlocks = b.blocks ?? [];
      const aRequires = a.requiresOrPrefers ?? [];
      for (const blocked of bBlocks) {
        const conflicting = aRequires.find(req =>
          req.toLowerCase().includes(blocked.toLowerCase()) ||
          blocked.toLowerCase().includes(req.toLowerCase())
        );
        if (conflicting) {
          const alreadyLogged = conflicts.some(
            c =>
              (c.winner === a.conditionName || c.winner === b.conditionName) &&
              c.conflictedOn.toLowerCase().includes(blocked.toLowerCase())
          );
          if (!alreadyLogged) {
            const winner = a.priorityTier <= b.priorityTier ? a : b;
            const loser  = winner === a ? b : a;
            conflicts.push({
              winner: winner.conditionName,
              loser: loser.conditionName,
              conflictedOn: `${blocked} (required by ${winner.conditionName}, blocked by ${loser.conditionName})`,
              resolution:
                `${winner.conditionName} (Tier ${winner.priorityTier}) takes precedence. ` +
                `${blocked} is kept. ${loser.conditionName} block on this item is overridden.`,
            });
          }
        }
      }
    }
  }

  return conflicts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sensory / feeding condition auto-detection
// ─────────────────────────────────────────────────────────────────────────────

const SENSORY_AUTISM_TRIGGERS = new Set([
  "autism", "asd", "autism spectrum", "sensory processing disorder",
  "sensory food aversion", "extreme picky eating",
]);

const DYSPHAGIA_TRIGGERS = new Set([
  "dysphagia", "swallowing difficulty", "aspiration risk",
  "feeding disorder", "modified texture", "thickened liquids",
  "iddsi", "feeding tube",
]);

const ADHD_TRIGGERS = new Set([
  "adhd", "attention deficit", "add",
]);

/**
 * Synthesizes the complete set of condition trigger strings from
 * medical_conditions + sensory_issues + feeding_concerns arrays.
 * This allows protocols to fire from any of these profile arrays.
 */
function buildConditionList(profile: ChildProfileInput): string[] {
  const all: string[] = [
    ...(profile.medicalConditions ?? []),
    ...(profile.sensoryIssues ?? []),
    ...(profile.feedingConcerns ?? []),
  ];

  // Auto-trigger dysphagia from feedingAbility flags
  if (profile.feedingAbility?.swallowingDifficulty) {
    all.push("dysphagia");
  }

  // Auto-trigger FTT from growth concern
  if (profile.growth?.pediatricianConcern === "failure_to_thrive") {
    all.push("failure to thrive");
  }
  if (profile.growth?.pediatricianConcern === "underweight") {
    all.push("underweight");
  }
  if (profile.growth?.pediatricianConcern === "overweight") {
    all.push("pediatric obesity");
  }

  return all.filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// Conflict resolution suffix injected into system prompt
// ─────────────────────────────────────────────────────────────────────────────

function buildConflictResolutionPromptBlock(conflicts: ProtocolConflict[]): string {
  if (conflicts.length === 0) return "";

  const lines = [
    `\n⚖️ PROTOCOL CONFLICT RESOLUTIONS (apply these exactly):`,
  ];
  for (const c of conflicts) {
    lines.push(
      `- CONFLICT: ${c.conflictedOn}`,
      `  WINNER: ${c.winner}`,
      `  RESOLUTION: ${c.resolution}`,
    );
  }
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the complete set of guidance blocks for a child's active profile.
 * Returns conditionGuidanceBlocks[], stageDRIBlock, conflictLog, and metadata.
 *
 * ALWAYS check hardBlocked before injecting guidance or calling AI.
 * If hardBlocked is true, return the hardBlockMessage to the parent immediately.
 */
export function buildPediatricGuidanceBlocks(profile: ChildProfileInput): PediatricGuidanceOutput {
  // 1. Build the merged condition list
  const allConditions = buildConditionList(profile);

  // 2. Hard stop check — runs before anything else
  const hardStop = checkHardStop(allConditions);
  if (hardStop) {
    return {
      hardBlocked: true,
      hardBlockConditionId: hardStop.conditionId,
      hardBlockMessage: hardStop.hardStopMessage,
      requiresClinicianFlag: true,
      requiresDietitianFlag: true,
      conditionGuidanceBlocks: [],
      stageDRIBlock: buildStageDRIBlock(profile.developmentalStage),
      conflictLog: [],
      activeProtocolIds: [hardStop.conditionId],
      activeProtocolEvidence: [{
        conditionId: hardStop.conditionId,
        conditionName: hardStop.conditionName,
        version: EVIDENCE_BY_CONDITION_ID.get(hardStop.conditionId)?.version ?? "1.0.0",
        sources: EVIDENCE_BY_CONDITION_ID.get(hardStop.conditionId)?.sources ?? [],
        status: EVIDENCE_BY_CONDITION_ID.get(hardStop.conditionId)?.status ?? "approved",
      }],
      staleProtocolIds: [],
    };
  }

  // 3. Match active protocols (sorted by priority tier, approved-only)
  const activeProtocols = matchProtocols(allConditions).filter(p => !p.hardStop);

  // 4. Detect conflicts
  const conflictLog = detectConflicts(activeProtocols);

  // 5. Assemble guidance blocks from active protocols
  const conditionGuidanceBlocks = activeProtocols.map(p => p.guidance).filter(Boolean);

  // 5a. Extended profile guidance blocks — wired from child_profiles Phase 2
  // These are additive context blocks; they never override medical hard stops or allergen rules.

  // Allergy details: severity, EpiPen, cross-contact, clinician instructions
  if (profile.allergyDetails && profile.allergyDetails.length > 0) {
    const lines: string[] = ["🌾 EXTENDED ALLERGY DETAIL (from child profile):"];
    for (const a of profile.allergyDetails) {
      if (!a.allergen) continue;
      const parts: string[] = [`• ${a.allergen}`];
      if (a.severity)       parts.push(`Severity: ${a.severity}`);
      if (a.epiPen)         parts.push("EpiPen prescribed: YES — complete exclusion required");
      if (a.crossContact)   parts.push("Cross-contact concern: YES — use dedicated utensils and surfaces");
      if (a.clinicianInstructions) parts.push(`Clinician notes: ${a.clinicianInstructions}`);
      lines.push(parts.join(" | "));
    }
    conditionGuidanceBlocks.push(lines.join("\n"));
  }

  // School-safe: hard constraint, not a preference
  if (profile.schoolSafeRequired) {
    conditionGuidanceBlocks.push(
      "🏫 SCHOOL-SAFE REQUIRED: This meal will be consumed at school. " +
      "All recipes MUST fully exclude the child's listed allergens and any cross-contact risk — this is a hard constraint. " +
      "Format must be packable (lunchbox-safe). No refrigeration dependency unless explicitly noted as school-safe. " +
      "Include packable serving guidance in storageAndLunchboxGuidance."
    );
  }

  // Medication affects appetite
  if (profile.medicationAffectsAppetite) {
    conditionGuidanceBlocks.push(
      "💊 MEDICATION-APPETITE NOTE: Parent has reported this child's medication affects appetite or weight. " +
      "Prioritize nutrient density over volume. Keep portions small and nutritionally concentrated. " +
      "Avoid overwhelming servings. Do not comment on or reference the medication itself."
    );
  }

  // Growth context — reference only, no diagnosis
  const hasGrowthNumbers = (profile.heightCm && profile.heightCm > 0) || (profile.weightKg && profile.weightKg > 0);
  if (hasGrowthNumbers || profile.sex) {
    const parts: string[] = ["📏 GROWTH REFERENCE (context only — never label or diagnose weight status):"];
    if (profile.sex)       parts.push(`Sex: ${profile.sex}`);
    if (profile.heightCm)  parts.push(`Height: ${profile.heightCm} cm`);
    if (profile.weightKg)  parts.push(`Weight: ${profile.weightKg} kg`);
    parts.push(
      "Use as reference for portion sizing only. " +
      "Never reference weight, body size, or growth status in recipe output or serving guidance."
    );
    conditionGuidanceBlocks.push(parts.join(" | "));
  }

  // Kitchen reality: equipment, budget, time, skill
  const hasKitchenContext =
    profile.kitchenBudget || profile.kitchenTimeMinutes || profile.kitchenSkill ||
    (profile.kitchenEquipment && profile.kitchenEquipment.length > 0);
  if (hasKitchenContext) {
    const lines: string[] = ["🍳 KITCHEN REALITY CONSTRAINTS:"];
    if (profile.kitchenBudget) {
      const budgetLabel =
        profile.kitchenBudget === "budget" ? "Budget-conscious — use affordable staple ingredients"
        : profile.kitchenBudget === "flexible" ? "Flexible budget — specialty ingredients acceptable"
        : "Moderate budget — everyday ingredients preferred";
      lines.push(`• Budget: ${budgetLabel}`);
    }
    if (profile.kitchenTimeMinutes) {
      lines.push(`• Max cook time: ${profile.kitchenTimeMinutes} minutes — keep recipe within this limit`);
    }
    if (profile.kitchenSkill) {
      const skillNote =
        profile.kitchenSkill === "beginner" ? "Beginner — simple steps, minimal technique"
        : profile.kitchenSkill === "advanced" ? "Advanced — complex techniques acceptable"
        : "Intermediate — standard home-cook techniques";
      lines.push(`• Cook skill: ${skillNote}`);
    }
    if (profile.kitchenEquipment && profile.kitchenEquipment.length > 0) {
      lines.push(`• Available equipment: ${profile.kitchenEquipment.join(", ")}`);
    }
    conditionGuidanceBlocks.push(lines.join("\n"));
  }

  // Family goals (parent-stated, not clinical directives)
  if (profile.familyGoals && profile.familyGoals.length > 0) {
    conditionGuidanceBlocks.push(
      `🎯 FAMILY NUTRITION GOALS (parent-stated preferences, not medical orders): ${profile.familyGoals.join("; ")}`
    );
  }

  // Cultural preferences (if not already passed via request parentPrefs.culturalCuisine)
  if (profile.culturalPreferences) {
    conditionGuidanceBlocks.push(
      `🌍 CULTURAL CUISINE PREFERENCE (from child profile): ${profile.culturalPreferences}`
    );
  }

  // 6. Add conflict resolution block
  if (conflictLog.length > 0) {
    conditionGuidanceBlocks.push(buildConflictResolutionPromptBlock(conflictLog));
  }

  // 7. Stage DRI block
  const stageDRIBlock = buildStageDRIBlock(profile.developmentalStage);

  // 8. Clinician/dietitian flags — true if ANY active protocol requires them
  const requiresClinicianFlag = activeProtocols.some(p => p.requiresClinicianFlag);
  const requiresDietitianFlag = activeProtocols.some(p => p.requiresDietitianFlag);

  // 9. Evidence metadata
  const activeProtocolEvidence = activeProtocols.map(p => {
    const evidence = EVIDENCE_BY_CONDITION_ID.get(p.conditionId);
    return {
      conditionId: p.conditionId,
      conditionName: p.conditionName,
      version: evidence?.version ?? "unknown",
      sources: evidence?.sources ?? [],
      status: evidence?.status ?? "unknown",
    };
  });

  // 10. Stale governance — flag active protocols past their review date
  const staleIds = getStaleProtocolIds();
  const staleProtocolIds = activeProtocols
    .map(p => p.conditionId)
    .filter(id => staleIds.has(id));

  return {
    hardBlocked: false,
    requiresClinicianFlag,
    requiresDietitianFlag,
    conditionGuidanceBlocks,
    stageDRIBlock,
    conflictLog,
    activeProtocolIds: activeProtocols.map(p => p.conditionId),
    activeProtocolEvidence,
    staleProtocolIds,
  };
}
