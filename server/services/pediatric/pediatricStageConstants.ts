/**
 * pediatricStageConstants.ts
 *
 * DRI-based nutrition baselines per developmental stage.
 * Sources: USDA/NIH Dietary Reference Intakes (DRIs), AAP, WHO.
 *
 * CRITICAL: These are server-side constants only.
 * They are injected into the prompt as hard guardrails — never AI-generated.
 * AI must never invent or override these values.
 */

export type DevelopmentalStage =
  | "early_infant"
  | "beginning_foods"
  | "young_toddler"
  | "toddler"
  | "preschool"
  | "early_school_age"
  | "growing_child";

export interface PediatricStageDRI {
  stage: DevelopmentalStage;
  /** Human-readable label */
  label: string;
  /** Approximate age range */
  ageRange: string;
  /** DRI caloric range per day (kcal) — per-meal target derived from this */
  dailyCalorieRangeKcal: [number, number];
  /** Protein: g/day (DRI adequate intake / RDA) */
  proteinGPerDay: number;
  /** Calcium: mg/day */
  calciumMgPerDay: number;
  /** Iron: mg/day */
  ironMgPerDay: number;
  /** Fiber: g/day (AI — adequate intake) */
  fiberGPerDay: number;
  /** Sodium: mg/day — upper limit for dietary planning */
  sodiumLimitMgPerDay: number;
  /** Added sugar: g/day — AAP/AHA upper limit (0 for under 2) */
  addedSugarLimitGPerDay: number;
  /** Vitamin D: IU/day */
  vitaminDIUPerDay: number;
  /** Per-meal calorie target guidance (roughly 1/3 of daily, adjusted per stage) */
  perMealCalorieTargetKcal: [number, number];
  /** Notes for prompt injection */
  promptNotes: string[];
}

export const PEDIATRIC_STAGE_DRIS: Record<DevelopmentalStage, PediatricStageDRI> = {
  early_infant: {
    stage: "early_infant",
    label: "Early Infant (birth–~5 months)",
    ageRange: "0–5 months",
    dailyCalorieRangeKcal: [0, 0], // Breast milk / formula only — no solids
    proteinGPerDay: 9.1,
    calciumMgPerDay: 200,
    ironMgPerDay: 0.27,
    fiberGPerDay: 0,
    sodiumLimitMgPerDay: 110,
    addedSugarLimitGPerDay: 0,
    vitaminDIUPerDay: 400,
    perMealCalorieTargetKcal: [0, 0],
    promptNotes: [
      "ABSOLUTE BLOCK: No solid foods. Breast milk or formula only.",
      "This stage cannot have recipes generated. Return the early_infant gate response.",
    ],
  },

  beginning_foods: {
    stage: "beginning_foods",
    label: "Beginning Foods (~6–11 months)",
    ageRange: "6–11 months",
    dailyCalorieRangeKcal: [700, 900],
    proteinGPerDay: 11,
    calciumMgPerDay: 260,
    ironMgPerDay: 11,
    fiberGPerDay: 0, // No fiber DRI at this stage — texture/safety over fiber
    sodiumLimitMgPerDay: 370,
    addedSugarLimitGPerDay: 0, // AAP: no added sugar under 24 months
    vitaminDIUPerDay: 400,
    perMealCalorieTargetKcal: [50, 100], // Single-food purees, very small portions
    promptNotes: [
      "Iron-rich first foods are a priority at this stage (iron stores depleted ~6 months).",
      "Single-ingredient purees or very soft mashed foods only.",
      "No added salt, sugar, honey, or spices beyond mild herbs.",
      "Introduce one new food every 3–5 days to watch for reactions.",
      "NO cow's milk as main drink. NO juice. Breast milk/formula remains primary nutrition.",
      "Textures: smooth puree → lumpy puree → soft mashed. Never hard, crunchy, or chunky.",
    ],
  },

  young_toddler: {
    stage: "young_toddler",
    label: "Young Toddler (12–23 months)",
    ageRange: "12–23 months",
    dailyCalorieRangeKcal: [700, 1000],
    proteinGPerDay: 13,
    calciumMgPerDay: 260,
    ironMgPerDay: 11,
    fiberGPerDay: 19,
    sodiumLimitMgPerDay: 800,
    addedSugarLimitGPerDay: 0, // AAP: no added sugar under 24 months
    vitaminDIUPerDay: 600,
    perMealCalorieTargetKcal: [150, 250],
    promptNotes: [
      "No added sugar (under 24 months — AAP hard rule).",
      "No honey until after 12 months (already enforced in safety rules).",
      "Transition from purees to soft chopped foods — no raw hard vegetables or fruits.",
      "Whole cow's milk (not skim) is now appropriate as main drink.",
      "Small portions — toddler portion sizes are about 1 tablespoon per year of age per food.",
      "Finger foods encouraged: soft diced fruit, well-cooked pasta, scrambled egg pieces.",
    ],
  },

  toddler: {
    stage: "toddler",
    label: "Toddler (2–3 years)",
    ageRange: "2–3 years",
    dailyCalorieRangeKcal: [1000, 1400],
    proteinGPerDay: 13,
    calciumMgPerDay: 700,
    ironMgPerDay: 7,
    fiberGPerDay: 19,
    sodiumLimitMgPerDay: 1500,
    addedSugarLimitGPerDay: 25, // AHA: <25g/day for children 2–18
    vitaminDIUPerDay: 600,
    perMealCalorieTargetKcal: [250, 400],
    promptNotes: [
      "Limit added sugar to <25g/day total. One meal should not exceed 10g added sugar.",
      "Fiber from whole fruits and vegetables is preferred over high-fiber supplements.",
      "Calcium needs are high — include dairy or fortified alternatives daily.",
      "Choking prevention: all round foods halved/quartered, meats finely chopped.",
      "Healthy fat is important for brain development — avocado, nut butter (thinly spread), olive oil.",
    ],
  },

  preschool: {
    stage: "preschool",
    label: "Preschool (4–5 years)",
    ageRange: "4–5 years",
    dailyCalorieRangeKcal: [1200, 1600],
    proteinGPerDay: 19,
    calciumMgPerDay: 1000,
    ironMgPerDay: 10,
    fiberGPerDay: 25,
    sodiumLimitMgPerDay: 1500,
    addedSugarLimitGPerDay: 25,
    vitaminDIUPerDay: 600,
    perMealCalorieTargetKcal: [350, 500],
    promptNotes: [
      "Calcium needs increase — aim for dairy or fortified plant-milk equivalent at each meal.",
      "Iron-rich foods remain important — lean meats, beans, fortified cereals.",
      "Fiber from whole grains, fruits, and vegetables — not supplements.",
      "Portion sizes are smaller than adult portions; avoid oversizing.",
      "Limit juice to 4 oz/day (100% juice only) — whole fruit strongly preferred.",
    ],
  },

  early_school_age: {
    stage: "early_school_age",
    label: "Early School Age (6–8 years)",
    ageRange: "6–8 years",
    dailyCalorieRangeKcal: [1400, 1800],
    proteinGPerDay: 20,
    calciumMgPerDay: 1000,
    ironMgPerDay: 10,
    fiberGPerDay: 25,
    sodiumLimitMgPerDay: 1900,
    addedSugarLimitGPerDay: 25,
    vitaminDIUPerDay: 600,
    perMealCalorieTargetKcal: [400, 550],
    promptNotes: [
      "Growing children benefit from whole-grain carbohydrates for sustained energy during school.",
      "After-school snack should include protein + complex carb (e.g., cheese + whole-grain crackers).",
      "Calcium and vitamin D critical for bone-building in this phase.",
      "Omega-3 fatty acids support brain development — include fatty fish 1–2 times/week.",
    ],
  },

  growing_child: {
    stage: "growing_child",
    label: "Growing Child (9–12 years)",
    ageRange: "9–12 years",
    dailyCalorieRangeKcal: [1600, 2200],
    proteinGPerDay: 34,
    calciumMgPerDay: 1300, // Peak bone-building window
    ironMgPerDay: 8,
    fiberGPerDay: 31,
    sodiumLimitMgPerDay: 2200,
    addedSugarLimitGPerDay: 25,
    vitaminDIUPerDay: 600,
    perMealCalorieTargetKcal: [450, 650],
    promptNotes: [
      "Peak bone-building phase: 1,300mg calcium/day — prioritize dairy or fortified alternatives.",
      "Protein needs increasing with growth spurts — include lean protein at every meal.",
      "Active children in this stage may need pre/post-sport snacks for sustained energy.",
      "Iron needs rise (especially for menstruating children) — lean meats, legumes, fortified cereals.",
      "Healthy fats remain important — avocado, nuts, fatty fish.",
    ],
  },
};

/**
 * Returns a formatted string block of DRI baselines for a given stage,
 * safe for injection into the system prompt.
 */
export function buildStageDRIBlock(stage: DevelopmentalStage): string {
  const dri = PEDIATRIC_STAGE_DRIS[stage];
  if (!dri) return "";

  const lines: string[] = [
    `📊 DRI NUTRITION BASELINES — ${dri.label.toUpperCase()} (server-verified, never override):`,
    `Daily calorie range: ${dri.dailyCalorieRangeKcal[0]}–${dri.dailyCalorieRangeKcal[1]} kcal/day`,
    `Per-meal calorie target: ${dri.perMealCalorieTargetKcal[0]}–${dri.perMealCalorieTargetKcal[1]} kcal`,
    `Protein: ≥${dri.proteinGPerDay}g/day`,
    `Calcium: ${dri.calciumMgPerDay}mg/day`,
    `Iron: ${dri.ironMgPerDay}mg/day`,
    `Fiber: ${dri.fiberGPerDay > 0 ? `${dri.fiberGPerDay}g/day` : "N/A at this stage"}`,
    `Sodium limit: <${dri.sodiumLimitMgPerDay}mg/day`,
    `Added sugar limit: ${dri.addedSugarLimitGPerDay === 0 ? "ZERO (none allowed)" : `<${dri.addedSugarLimitGPerDay}g/day`}`,
    `Vitamin D: ${dri.vitaminDIUPerDay} IU/day`,
    ``,
    `STAGE GUIDANCE:`,
    ...dri.promptNotes.map(n => `- ${n}`),
  ];

  return lines.join("\n");
}
