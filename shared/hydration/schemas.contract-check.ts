import type { z } from "zod";
import type {
  HydrationIntakeEventInput,
  HydrationModifierInput,
  HydrationPlanningEligibilityInput,
  HydrationPlanningEligibilityResult,
} from "./contracts";
import { hydrationModifierInputSchema } from "./modifierSchemas";
import {
  hydrationIntakeEventInputSchema,
  hydrationPlanningEligibilityInputSchema,
  hydrationPlanningEligibilityResultSchema,
} from "./schemas";

type Assert<T extends true> = T;
type HydrationIntakeSchemaOutput = z.output<
  typeof hydrationIntakeEventInputSchema
>;

/**
 * This file is checked with strictNullChecks enabled by
 * tsconfig.hydration-contract.json. The broader server check intentionally
 * disables strict null checks for legacy code, which causes Zod v3 to infer
 * every object property as optional regardless of the runtime schema.
 */
type HydrationIntakeSchemaMatchesContract = Assert<
  HydrationIntakeSchemaOutput extends HydrationIntakeEventInput ? true : false
>;

type HydrationModifierSchemaOutput = z.output<
  typeof hydrationModifierInputSchema
>;
type HydrationModifierSchemaMatchesContract = Assert<
  HydrationModifierSchemaOutput extends HydrationModifierInput ? true : false
>;
type HydrationEligibilityInputSchemaOutput = z.output<
  typeof hydrationPlanningEligibilityInputSchema
>;
type HydrationEligibilityInputSchemaMatchesContract = Assert<
  HydrationEligibilityInputSchemaOutput extends HydrationPlanningEligibilityInput
    ? true
    : false
>;
type HydrationEligibilityResultSchemaOutput = z.output<
  typeof hydrationPlanningEligibilityResultSchema
>;
type HydrationEligibilityResultSchemaMatchesContract = Assert<
  HydrationEligibilityResultSchemaOutput extends HydrationPlanningEligibilityResult
    ? true
    : false
>;

export type HydrationSchemaContractCheck = [
  HydrationIntakeSchemaMatchesContract,
  HydrationModifierSchemaMatchesContract,
  HydrationEligibilityInputSchemaMatchesContract,
  HydrationEligibilityResultSchemaMatchesContract,
];