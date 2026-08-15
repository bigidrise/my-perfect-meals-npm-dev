/**
 * Dish Adaptation Layer — shared types.
 * Architecture: docs/dish-adaptation-layer/ARCHITECTURE.md
 */

import type { FunctionalRole, GuardrailId } from "../../../shared/dishAdaptation/guardrailSubstitutionMap";

export type CallContext = "first_pass" | "fallback";

export interface ActiveGuardrail {
  id: GuardrailId;
  /** Human-readable label, e.g. "diabetic". */
  label: string;
}

/** Compiled guardrail state passed into the DAL. */
export interface GuardrailContext {
  guardrails: ActiveGuardrail[];
  /** Enforced (still-active) allergens — overrides already removed. */
  activeAllergens?: string[];
  /** Allergens explicitly unlocked by authenticated override for this request. */
  overriddenAllergens?: string[];
}

export interface ConflictResolution {
  /** Dish component, e.g. "rice base". */
  component: string;
  /** e.g. "diabetic: no white rice / any rice". */
  guardrail: string;
  /** e.g. "Use cauliflower rice. The dish is still gumbo." */
  directive: string;
  /** Structural role the blocked ingredient performs, when known (binder, setter, …). */
  functionalRole?: FunctionalRole;
  /** The functional outcome the substitute must achieve, when known. */
  roleRequirement?: string;
}

export interface DishAdaptationDirective {
  identityAnchor: string;
  definingComponents: string[];
  adaptableComponents: string[];
  conflicts: ConflictResolution[];
  /** The full text block injected into the generation prompt. */
  adaptationBlock: string;
}

export interface DishIdentityResult {
  passed: boolean;
  /** 0–1, 1 = exact identity preserved. */
  score: number;
  failures: string[];
  /** true = completely different dish — must never be returned to the user. */
  catastrophicDeviation: boolean;
}
