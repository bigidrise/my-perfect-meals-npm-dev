/**
 * Coaching Reasoning Library — Registry
 *
 * All reasoning families exported from one entry point.
 * Add new families here — no other files need to change.
 */

export { persistentHunger } from "./families/persistentHunger";
export { planNotWorking }   from "./families/planNotWorking";
export { cravings }         from "./families/cravings";
export { weightChangePlateau } from "./families/weightChangePlateau";
export { lowEnergy }        from "./families/lowEnergy";
export { reinforcement }    from "./families/reinforcement";

import { persistentHunger }    from "./families/persistentHunger";
import { planNotWorking }       from "./families/planNotWorking";
import { cravings }             from "./families/cravings";
import { weightChangePlateau }  from "./families/weightChangePlateau";
import { lowEnergy }            from "./families/lowEnergy";
import { reinforcement }        from "./families/reinforcement";
import type { ReasoningFamily } from "../../../../shared/coaching/types";

/**
 * All primary reasoning families (non-modifiers first, modifiers last).
 * The matcher iterates this list to find the best match.
 */
export const ALL_REASONING_FAMILIES: ReasoningFamily[] = [
  persistentHunger,
  planNotWorking,
  cravings,
  weightChangePlateau,
  lowEnergy,
  reinforcement, // modifier — evaluated separately
];

export const PRIMARY_FAMILIES   = ALL_REASONING_FAMILIES.filter((f) => !f.isModifier);
export const MODIFIER_FAMILIES  = ALL_REASONING_FAMILIES.filter((f) => f.isModifier);
