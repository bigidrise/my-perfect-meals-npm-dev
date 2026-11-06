/**
 * Product freeze for optional, self-selected nutrition support overlays.
 * Established Builders and clinical/professional sources are not controlled here.
 * Keep persisted choices and source history intact for a later resumption.
 */
export const PERSONAL_FOOD_SUPPORT_OVERLAYS_ENABLED = false;

/** Independently reviewed restoration; never enables the other personal overlays.
 * Callers must additionally enforce an unpublished Development runtime. */
export const ANTI_INFLAMMATORY_SUPPORT_DEVELOPMENT_ENABLED = true;
/** A fresh explicit choice, not authority inferred from historical preferences. */
export const ANTI_INFLAMMATORY_SUPPORT_OPT_IN = "anti_inflammatory_explicit_opt_in";