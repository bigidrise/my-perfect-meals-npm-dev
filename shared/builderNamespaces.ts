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
  ANTI_INFLAMMATORY_THYROID: 'antiInflammatory:thyroidSupport',
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

/** The builders which are allowed to author My Perfect Menu concepts. */
export const MY_PERFECT_MENU_BUILDERS = {
  general_nutrition: {
    key: "general_nutrition",
    namespace: BUILDER_NS.GENERAL_NUTRITION,
    route: "/general-nutrition-builder/build",
    dietType: undefined,
    builderMode: "lifestyle",
  },
  diabetic: {
    key: "diabetic",
    namespace: BUILDER_NS.DIABETIC,
    route: "/diabetic-menu-builder",
    dietType: "diabetic",
    builderMode: "targeted",
  },
  glp1: {
    key: "glp1",
    namespace: BUILDER_NS.GLP1,
    route: "/glp1-meal-builder",
    dietType: "glp1",
    builderMode: "targeted",
  },
  anti_inflammatory: {
    key: "anti_inflammatory",
    namespace: BUILDER_NS.ANTI_INFLAMMATORY,
    route: "/anti-inflammatory-menu-builder",
    dietType: "anti-inflammatory",
    builderMode: "targeted",
  },
} as const;

export type MyPerfectMenuBuilderKey = keyof typeof MY_PERFECT_MENU_BUILDERS;
export type MyPerfectMenuBuilderContext = {
  key: MyPerfectMenuBuilderKey;
  namespace: string;
  route: string;
  dietType?: "diabetic" | "glp1" | "anti-inflammatory";
  builderMode: "lifestyle" | "targeted";
  generationMode: "builder";
  source: "explicit" | "assigned" | "default";
};

export function isMyPerfectMenuBuilderKey(value: unknown): value is MyPerfectMenuBuilderKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(MY_PERFECT_MENU_BUILDERS, value);
}

export function builderContextFor(key: MyPerfectMenuBuilderKey, source: MyPerfectMenuBuilderContext["source"]): MyPerfectMenuBuilderContext {
  const entry = MY_PERFECT_MENU_BUILDERS[key];
  return { ...entry, generationMode: "builder", source };
}

export function myPerfectMenuBuilderKeyForNamespace(
  namespace: string | undefined,
): MyPerfectMenuBuilderKey | undefined {
  return MY_PERFECT_MENU_BUILDER_KEYS.find(
    (key) => MY_PERFECT_MENU_BUILDERS[key].namespace === namespace,
  );
}

export const MY_PERFECT_MENU_BUILDER_KEYS = Object.keys(MY_PERFECT_MENU_BUILDERS) as MyPerfectMenuBuilderKey[];
