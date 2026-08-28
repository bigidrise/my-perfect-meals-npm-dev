import type { z } from "zod";
import type {
  HydrationIntakeEventInput,
  HydrationModifierInput,
} from "./contracts";
import { hydrationModifierInputSchema } from "./modifierSchemas";
import { hydrationIntakeEventInputSchema } from "./schemas";

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

export type HydrationSchemaContractCheck = [
  HydrationIntakeSchemaMatchesContract,
  HydrationModifierSchemaMatchesContract,
];