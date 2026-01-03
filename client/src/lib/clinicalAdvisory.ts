/**
 * Clinical Advisory Utility Module v1.0
 * 
 * Shared logic for calculating macro adjustments based on
 * metabolic and hormonal considerations.
 * 
 * V1 Conditions (LOCKED):
 * - Menopause / Hormone Therapy
 * - Suspected Insulin Resistance
 * - High Stress / Poor Sleep
 * 
 * DEFERRED (DO NOT ADD):
 * - Post-hysterectomy
 * - Dyslipidemia
 */

export type AdvisoryConditionKey = 'menopause' | 'insulinResistance' | 'highStress';

export type AdvisoryToggle = {
  id: string;
  enabled: boolean;
  appliedAt?: string;
  appliedBy?: string;
};

export type ClinicalAdvisoryState = {
  menopause?: AdvisoryToggle;
  insulinResistance?: AdvisoryToggle;
  highStress?: AdvisoryToggle;
};

export type MacroDeltas = {
  protein: number;
  carbs: number;
  fat: number;
};

export type AdvisoryDefinition = {
  key: AdvisoryConditionKey;
  label: string;
  description: string;
  proteinDeltaPercent: number;
  carbDeltaPercent: number;
  fatDeltaPercent: number;
  rationale: string;
  userExplanation: string;
};

export const ADVISORY_DEFINITIONS: Record<AdvisoryConditionKey, AdvisoryDefinition> = {
  menopause: {
    key: 'menopause',
    label: 'Menopause / Hormone Therapy',
    description: 'Post-menopausal or on hormone replacement therapy',
    proteinDeltaPercent: 10,
    carbDeltaPercent: -5,
    fatDeltaPercent: 5,
    rationale: 'Higher protein supports muscle preservation during hormonal changes. Moderate fat supports hormone synthesis. Slight carb reduction helps with insulin sensitivity.',
    userExplanation: 'Hormonal changes can affect muscle retention, insulin sensitivity, and fat metabolism.',
  },
  insulinResistance: {
    key: 'insulinResistance',
    label: 'Suspected Insulin Resistance',
    description: 'Metabolic indicators suggest reduced insulin sensitivity',
    proteinDeltaPercent: 5,
    carbDeltaPercent: -15,
    fatDeltaPercent: 5,
    rationale: 'Lower carbohydrate intake reduces glycemic load. Increased protein and fat help with satiety and blood sugar stability.',
    userExplanation: 'When cells respond less efficiently to insulin, moderating carbs while increasing protein can help stabilize blood sugar.',
  },
  highStress: {
    key: 'highStress',
    label: 'High Stress / Poor Sleep',
    description: 'Elevated cortisol, chronic stress, or sleep disruption',
    proteinDeltaPercent: 5,
    carbDeltaPercent: 0,
    fatDeltaPercent: 0,
    rationale: 'Higher protein supports recovery and prevents muscle catabolism during stress. Consider timing carbs around sleep for cortisol regulation.',
    userExplanation: 'Chronic stress increases protein needs to support recovery and prevent muscle breakdown.',
  },
};

export const ADVISORY_KEYS = Object.keys(ADVISORY_DEFINITIONS) as AdvisoryConditionKey[];

export type MacroTargets = {
  protein: number;
  starchyCarbs?: number;
  fibrousCarbs?: number;
  carbs?: number;
  fat: number;
};

export type AdvisorySuggestion = {
  key: AdvisoryConditionKey;
  label: string;
  proteinDelta: number;
  carbDelta: number;
  fatDelta: number;
  rationale: string;
};

export function calculateAdvisorySuggestions(
  advisory: ClinicalAdvisoryState | undefined,
  targets: MacroTargets
): AdvisorySuggestion[] {
  const suggestions: AdvisorySuggestion[] = [];
  
  if (!advisory) return suggestions;

  const totalCarbs = (targets.starchyCarbs || 0) + (targets.fibrousCarbs || 0) || targets.carbs || 0;

  for (const key of ADVISORY_KEYS) {
    const toggle = advisory[key];
    if (toggle?.enabled) {
      const def = ADVISORY_DEFINITIONS[key];
      suggestions.push({
        key,
        label: def.label,
        proteinDelta: Math.round((targets.protein * def.proteinDeltaPercent) / 100),
        carbDelta: Math.round((totalCarbs * def.carbDeltaPercent) / 100),
        fatDelta: Math.round((targets.fat * def.fatDeltaPercent) / 100),
        rationale: def.rationale,
      });
    }
  }

  return suggestions;
}

export function aggregateDeltas(suggestions: AdvisorySuggestion[]): MacroDeltas {
  return suggestions.reduce(
    (acc, s) => ({
      protein: acc.protein + s.proteinDelta,
      carbs: acc.carbs + s.carbDelta,
      fat: acc.fat + s.fatDelta,
    }),
    { protein: 0, carbs: 0, fat: 0 }
  );
}

export function calculateDeltaForCondition(
  key: AdvisoryConditionKey,
  targets: MacroTargets
): MacroDeltas {
  const def = ADVISORY_DEFINITIONS[key];
  const totalCarbs = (targets.starchyCarbs || 0) + (targets.fibrousCarbs || 0) || targets.carbs || 0;
  
  return {
    protein: Math.round((targets.protein * def.proteinDeltaPercent) / 100),
    carbs: Math.round((totalCarbs * def.carbDeltaPercent) / 100),
    fat: Math.round((targets.fat * def.fatDeltaPercent) / 100),
  };
}

export function formatDelta(value: number): string {
  if (value > 0) return `+${value}g`;
  if (value < 0) return `${value}g`;
  return '0g';
}

export function formatDeltaPercent(value: number): string {
  if (value > 0) return `+${value}%`;
  if (value < 0) return `${value}%`;
  return '0%';
}

export type AdvisoryAuditEntry = {
  timestamp: string;
  action: 'toggle_enabled' | 'toggle_disabled' | 'adjustments_applied' | 'adjustments_staged';
  condition?: AdvisoryConditionKey;
  appliedBy?: string;
  deltas?: MacroDeltas;
  previousTargets?: MacroTargets;
  newTargets?: MacroTargets;
};

export function createAuditEntry(
  action: AdvisoryAuditEntry['action'],
  options: Partial<AdvisoryAuditEntry> = {}
): AdvisoryAuditEntry {
  return {
    timestamp: new Date().toISOString(),
    action,
    ...options,
  };
}

const ADVISORY_STORAGE_KEY = 'mpm_user_clinical_advisory';

export function loadUserAdvisory(): ClinicalAdvisoryState | null {
  try {
    const raw = localStorage.getItem(ADVISORY_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveUserAdvisory(advisory: ClinicalAdvisoryState): void {
  try {
    localStorage.setItem(ADVISORY_STORAGE_KEY, JSON.stringify(advisory));
  } catch {
    console.warn('Failed to save clinical advisory to localStorage');
  }
}

export function hasAnyActiveAdvisory(advisory: ClinicalAdvisoryState | undefined | null): boolean {
  if (!advisory) return false;
  return ADVISORY_KEYS.some(key => advisory[key]?.enabled);
}
