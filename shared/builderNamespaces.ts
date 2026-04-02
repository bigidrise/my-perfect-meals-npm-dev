/**
 * BUILDER NAMESPACES — SINGLE SOURCE OF TRUTH
 *
 * Each builder reads and writes to its own isolated board namespace.
 * Namespace keys are passed to useWeeklyBoard and sent to the server as ?ns=.
 *
 * WEEKLY board uses `undefined` (no namespace) to preserve existing user data.
 * Medical/pro builders each get their own namespace so boards never collide.
 */
export const BUILDER_NS = {
  WEEKLY: undefined as undefined,
  ANTI_INFLAMMATORY: 'antiInflammatory',
  ANTI_INFLAMMATORY_LIVER: 'antiInflammatory:liverSupport',
  ANTI_INFLAMMATORY_ONCOLOGY: 'antiInflammatory:oncologySupport',
  DIABETIC: 'diabetic',
  GLP1: 'glp1',
  GENERAL_NUTRITION: 'generalNutrition',
  PERFORMANCE_COMPETITION: 'performanceCompetition',
  BEACH_BODY: 'beachBody',
  KIDNEY_DISEASE: 'kidneyDisease',
  HEART_FAILURE: 'heartFailure',
  LIVER_DISEASE: 'liverDisease',
} as const;

export type BuilderNamespace = typeof BUILDER_NS[keyof typeof BUILDER_NS];
