/**
 * Specialization Adapter Registry
 *
 * Maps CoachSpecialization → CoachSpecializationAdapter.
 *
 * Phase 2: Corner adapter only.
 * Phase 7: Pregnancy adapter added here.
 * Phase 8: Pediatric adapter added here.
 *
 * Adding a new specialization = creating a new adapter file + registering here.
 * No changes to the engine itself.
 */

import type {
  CoachSpecialization,
  CoachSpecializationAdapter,
} from "../../../../shared/coaching/types";
import { cornerAdapter } from "./cornerAdapter";

const ADAPTERS: Record<string, CoachSpecializationAdapter> = {
  corner: cornerAdapter,
  // pregnancy: pregnancyAdapter,  — Phase 7
  // pediatric: pediatricAdapter,  — Phase 8
};

/**
 * Load the specialization adapter for the given specialization.
 * Throws 400 if the specialization is not yet implemented.
 */
export function getAdapter(specialization: CoachSpecialization): CoachSpecializationAdapter {
  const adapter = ADAPTERS[specialization];
  if (!adapter) {
    throw Object.assign(
      new Error(`Specialization '${specialization}' is not yet available`),
      { status: 400 }
    );
  }
  return adapter;
}

export { cornerAdapter };
