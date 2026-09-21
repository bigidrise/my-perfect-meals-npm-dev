import {
  FOOD_INCLUSION_PRIORITY_REGISTRY,
  NUTRITION_PRIORITY_EDUCATION_POLICY,
  type FoodInclusionPriorityDefinition,
  type FoodInclusionPriorityId,
} from "./nutritionPriorities";

export { NUTRITION_PRIORITY_EDUCATION_POLICY } from "./nutritionPriorities";

export type NutritionPriorityEducationAudience = "adult" | "pediatric";

export interface NutritionPriorityEducationEntry {
  id: FoodInclusionPriorityId;
  label: string;
  shortSummary: string;
  whatItIs: string;
  whyChooseIt: string;
  generallySupports: string;
  whatMpmDoes: string;
  foodExamples: string[];
  limitations: string[];
  citations: Array<{ title: string; url: string }>;
}

export interface NutritionPriorityEducationAnswer {
  title: string;
  description: string;
  howTo?: string[];
  tips?: string[];
}

export interface NutritionPriorityEducationQuestionContext {
  hasNutritionPriorityContext?: boolean;
}

function normalizeEducationQuery(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findEducationEntry(
  query: string,
  entries: NutritionPriorityEducationEntry[],
): NutritionPriorityEducationEntry | null {
  const normalized = normalizeEducationQuery(query);
  return (
    entries.find((entry) => {
      const label = normalizeEducationQuery(entry.label);
      const shortLabel = label.replace(/\bfoods?\b|\bsources?\b/g, "").trim();
      return normalized.includes(label) || normalized.includes(shortLabel);
    }) ?? null
  );
}

function hasUnsupportedClaimIntent(normalized: string): boolean {
  return (
    /(?:\bcure\b|\btreat|\bdiagnos|\bdeficien|\bprevent|\bosteoporosis\b|\banemia\b|\banxiety\b|\bsleep\b|\bcramp|\bdetox|\bweight loss\b|\bmicrobiome\b|\bbuild muscle\b|\bbones? stronger\b|\bhealthier\b)/.test(
      normalized,
    ) ||
    (normalized.includes("supplement") &&
      /\b(dose|same|equivalent|replace|benefit)\b/.test(normalized))
  );
}

function projectDefinition(
  definition: FoodInclusionPriorityDefinition,
  audience: NutritionPriorityEducationAudience,
): NutritionPriorityEducationEntry {
  if (audience === "pediatric") {
    const child = definition.pediatricProjection;
    return {
      id: definition.id,
      label: definition.label,
      shortSummary: child.shortSummary,
      whatItIs: definition.parentFacingPediatricExplanation,
      whyChooseIt: child.whyChooseIt,
      generallySupports: child.shortSummary,
      whatMpmDoes: child.whatMpmDoes,
      foodExamples: definition.foodExamples,
      limitations: child.limitations,
      citations: definition.citations,
    };
  }

  return {
    id: definition.id,
    label: definition.label,
    shortSummary: definition.shortSummary,
    whatItIs: definition.whatItIs,
    whyChooseIt: definition.whyChooseIt,
    generallySupports: definition.generallySupports,
    whatMpmDoes: definition.whatMpmDoes,
    foodExamples: definition.foodExamples,
    limitations: definition.limitations,
    citations: definition.citations,
  };
}

export function getNutritionPriorityEducationEntries(
  audience: NutritionPriorityEducationAudience = "adult",
): NutritionPriorityEducationEntry[] {
  return Object.values(FOOD_INCLUSION_PRIORITY_REGISTRY)
    .filter(
      (definition) =>
        definition.status === "active" &&
        (audience !== "pediatric" ||
          definition.pediatricProjection.status === "approved"),
    )
    .map((definition) => projectDefinition(definition, audience));
}

export function containsNutritionPriorityReference(query: string): boolean {
  const normalized = normalizeEducationQuery(query);
  if (
    normalized.includes("nutrition priorit") ||
    normalized.includes("food priorit")
  ) {
    return true;
  }
  const entries = getNutritionPriorityEducationEntries("adult");
  return (
    Boolean(findEducationEntry(query, entries)) ||
    NUTRITION_PRIORITY_EDUCATION_POLICY.deferredConcepts.some((label) =>
      normalized.includes(normalizeEducationQuery(label)),
    )
  );
}

export function isNutritionPriorityEducationQuestion(
  query: string,
  context: NutritionPriorityEducationQuestionContext = {},
): boolean {
  const normalized = normalizeEducationQuery(query);
  const hasEducationIntent =
    /\b(what|why|how|can|could|should|help|does|do|will|is|are|explain|mean|difference|happen|choose|choosing|learn|tell me about)\b/.test(
      normalized,
    );
  if (!hasEducationIntent) return false;
  const asksEveryMeal = normalized.includes("every meal");
  const hasPriorityReference = containsNutritionPriorityReference(query);
  if (hasPriorityReference && hasUnsupportedClaimIntent(normalized)) {
    return true;
  }
  const isActionRequest =
    /\b(make|add|build|create|generate|remove|put)\b.{0,60}\b(meal|dish|recipe|dinner|lunch|breakfast|snack)\b/.test(
      normalized,
    ) &&
    !asksEveryMeal;
  if (isActionRequest) return false;
  if (
    normalized.includes("nutrition priorit") ||
    normalized.includes("food priorit") ||
    (normalized.includes("medical protocol") &&
      /\b(choose|choosing)\b/.test(normalized)) ||
    (asksEveryMeal &&
      /\b(this|it)\b/.test(normalized) &&
      context.hasNutritionPriorityContext)
  ) {
    return true;
  }
  return hasPriorityReference;
}

export function answerNutritionPriorityEducationQuestion(
  query: string,
  audience: NutritionPriorityEducationAudience = "adult",
  context: NutritionPriorityEducationQuestionContext = {},
): NutritionPriorityEducationAnswer | null {
  if (!isNutritionPriorityEducationQuestion(query, context)) return null;
  const normalized = normalizeEducationQuery(query);
  const deferred = NUTRITION_PRIORITY_EDUCATION_POLICY.deferredConcepts.find(
    (label) => normalized.includes(normalizeEducationQuery(label)),
  );
  const entries = getNutritionPriorityEducationEntries(audience);
  const entry = findEducationEntry(query, entries);

  if (deferred) {
    return {
      title: `${deferred} and Nutrition Priorities`,
      description: `${deferred}: ${NUTRITION_PRIORITY_EDUCATION_POLICY.deferredExplanation}`,
      tips: [NUTRITION_PRIORITY_EDUCATION_POLICY.behavior],
    };
  }

  if (!entry) {
    if (
      context.hasNutritionPriorityContext &&
      normalized.includes("every meal") &&
      /\b(this|it)\b/.test(normalized)
    ) {
      return {
        title: "Nutrition Priorities",
        description: NUTRITION_PRIORITY_EDUCATION_POLICY.behavior,
      };
    }
    return {
      title: "Nutrition Priorities",
      description: [
        NUTRITION_PRIORITY_EDUCATION_POLICY.definition,
        NUTRITION_PRIORITY_EDUCATION_POLICY.behavior,
        NUTRITION_PRIORITY_EDUCATION_POLICY.medicalBoundary,
      ].join(" "),
      howTo: entries.map((item) => item.label),
    };
  }

  const asksTarget =
    normalized.includes("target") ||
    normalized.includes("macro") ||
    normalized.includes("protein goal");
  const asksEveryMeal =
    normalized.includes("every meal") ||
    normalized.includes("always") ||
    normalized.includes("guarantee");
  const asksUnsupported = hasUnsupportedClaimIntent(normalized);
  const asksProbiotic = normalized.includes("probiotic");
  const asksOmegaEquivalence =
    entry.id === "omega_3_food_sources" &&
    /\b(equivalent|same|identical|difference)\b/.test(normalized);
  const directLimitation = asksProbiotic
    ? entry.limitations.find((item) => /probiotic/i.test(item))
    : asksOmegaEquivalence
      ? entry.limitations.find((item) => /not equivalent/i.test(item))
      : null;

  const core = asksUnsupported
    ? NUTRITION_PRIORITY_EDUCATION_POLICY.unsupportedClaim
    : directLimitation
      ? directLimitation
      : asksTarget
        ? `${entry.whatMpmDoes} ${NUTRITION_PRIORITY_EDUCATION_POLICY.medicalBoundary}`
        : asksEveryMeal
          ? NUTRITION_PRIORITY_EDUCATION_POLICY.behavior
          : `${entry.whyChooseIt} ${entry.whatMpmDoes}`;

  return {
    title: entry.label,
    description: `${entry.shortSummary} ${core}`,
    howTo: [`Food examples: ${entry.foodExamples.join(", ")}`],
    tips: [
      ...entry.limitations,
      `Sources: ${entry.citations.map((citation) => citation.title).join("; ")}`,
    ],
  };
}

export function renderNutritionPriorityEducationBlock(
  audience: NutritionPriorityEducationAudience,
): string {
  const entries = getNutritionPriorityEducationEntries(audience);
  const lines = [
    "━━━ NUTRITION PRIORITIES EDUCATION (REGISTRY-APPROVED, EXPLANATION ONLY) ━━━",
    NUTRITION_PRIORITY_EDUCATION_POLICY.definition,
    NUTRITION_PRIORITY_EDUCATION_POLICY.behavior,
    NUTRITION_PRIORITY_EDUCATION_POLICY.medicalBoundary,
    "Do not select, remove, or modify priorities, macros, nutrient targets, or medical protocols. If the approved material does not establish a requested claim, say so rather than improvising.",
  ];
  for (const entry of entries) {
    lines.push(
      `• ${entry.label}`,
      `  Summary: ${entry.shortSummary}`,
      `  Why: ${entry.whyChooseIt}`,
      `  MPM behavior: ${entry.whatMpmDoes}`,
      `  Examples: ${entry.foodExamples.join(", ")}`,
      `  Limitations: ${entry.limitations.join(" ")}`,
      `  Sources: ${entry.citations.map((citation) => `${citation.title} (${citation.url})`).join("; ")}`,
    );
  }
  lines.push("━━━ END NUTRITION PRIORITIES EDUCATION ━━━");
  return lines.join("\n");
}