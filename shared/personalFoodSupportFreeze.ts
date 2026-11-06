/**
 * Product freeze for optional, self-selected nutrition support overlays.
 * Established Builders and clinical/professional sources are not controlled here.
 * Keep persisted choices and source history intact for a later resumption.
 */
export const PERSONAL_FOOD_SUPPORT_OVERLAYS_ENABLED = false;

/** Feature-specific release decision, shared by preview and compiled runtimes.
 * Never enables other personal overlays or the experimental clinical controls. */
export const ANTI_INFLAMMATORY_SUPPORT_ENABLED = true;
/** A fresh explicit choice, not authority inferred from historical preferences. */
export const ANTI_INFLAMMATORY_SUPPORT_OPT_IN = "anti_inflammatory_explicit_opt_in";