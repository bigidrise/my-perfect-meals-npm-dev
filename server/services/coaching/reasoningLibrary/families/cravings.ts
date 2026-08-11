import type { ReasoningFamily } from "../../../../../shared/coaching/types";

export const cravings: ReasoningFamily = {
  id: "cravings",
  name: "Cravings — Identify the Driver, Choose the Right Intervention",
  description:
    "The user is experiencing food cravings. The coach must identify whether the craving is " +
    "hunger-driven (nutritional gap), behavioral (hedonic), restriction-rebound, stress-driven, " +
    "or schedule-driven — then choose the right MPM intervention.",

  activation: {
    intentKeywords: [
      "craving", "cravings", "want", "want to eat", "want something sweet",
      "ice cream", "chocolate", "chips", "snack", "junk food", "treat",
      "dessert", "sweets", "urge to eat", "can't stop thinking about",
      "food thoughts", "food noise", "temptation", "giving in",
      "cheat", "off plan", "want to cheat", "craving something",
    ],
    intentIds: ["cravings", "general_inquiry"],
  },

  primaryQuestion:
    "Is this craving driven by a nutritional gap (protein, calories, meal timing), " +
    "behavioral factors (stress, habit, restriction rebound), or a hedonic need — " +
    "and what is the right MPM intervention for each?",

  evidenceNeeded: [
    {
      snapshotPath: "today.macros.protein",
      label: "Protein logged today",
      importance: "helpful",
      why: "Protein deficiency is one of the most common nutritional triggers for food cravings.",
    },
    {
      snapshotPath: "today.macros.calories",
      label: "Calories logged today",
      importance: "helpful",
      why: "Being significantly under-calories produces genuine hunger that manifests as cravings.",
    },
    {
      snapshotPath: "today.meals.count",
      label: "Meals logged today",
      importance: "helpful",
      why: "Missing meals produce hunger-driven cravings, not behavioral ones.",
    },
    {
      snapshotPath: "today.checkin.hunger",
      label: "Rated hunger level",
      importance: "helpful",
      why: "High hunger + craving = nutritional driver. Normal hunger + craving = more likely behavioral.",
    },
    {
      snapshotPath: "today.checkin.stress",
      label: "Stress level today",
      importance: "helpful",
      why: "High stress is a recognized driver of emotional eating and hedonic cravings.",
    },
    {
      snapshotPath: "today.checkin.cravings",
      label: "Rated craving intensity",
      importance: "helpful",
      why: "Provides a baseline for severity.",
    },
    {
      snapshotPath: "prescription.protein",
      label: "Protein target",
      importance: "helpful",
      why: "Needed to determine whether today's protein represents a real shortfall.",
    },
    {
      snapshotPath: "prescription.calories",
      label: "Calorie target",
      importance: "helpful",
      why: "Needed to contextualize whether today's intake is genuinely low.",
    },
    {
      snapshotPath: "today.meals.completeness",
      label: "Day completeness",
      importance: "contextual",
      why: "Evening cravings after a full day differ from mid-afternoon cravings before dinner.",
    },
  ],

  interpretationRules: [
    {
      id: "hunger_driven",
      condition: "Protein is below target AND/OR calories are significantly below target AND hunger is rated high",
      interpretation:
        "This craving is likely nutritional — the body is genuinely short on fuel or protein. " +
        "Satisfying the nutritional gap is the right first move, not willpower.",
      likelihood: "most_likely",
      requiresObservedPaths: ["today.macros.protein", "today.macros.calories"],
    },
    {
      id: "missed_meal_driver",
      condition: "Fewer than expected meals logged given time of day — large gap since last eating",
      interpretation:
        "Missing a meal is a common trigger for intense cravings later in the day. " +
        "This is a timing and distribution issue, not a character issue.",
      likelihood: "most_likely",
      requiresObservedPaths: ["today.meals.count"],
    },
    {
      id: "hedonic_craving",
      condition: "Protein and calories are close to target, hunger is normal, but craving persists",
      interpretation:
        "This appears to be a hedonic craving — wanting a specific taste experience rather " +
        "than responding to a nutritional deficit. The right approach is finding a way to " +
        "satisfy the experience within the nutrition plan, not to resist indefinitely.",
      likelihood: "most_likely",
      requiresObservedPaths: ["today.macros.protein", "today.macros.calories"],
    },
    {
      id: "stress_driven",
      condition: "Stress is rated high and cravings are reported",
      interpretation:
        "High stress correlates with hedonic eating. This may be an emotional eating pattern " +
        "rather than a nutritional need. The intervention should address the craving " +
        "in a sustainable way, not lecture about willpower.",
      likelihood: "possible",
      requiresObservedPaths: ["today.checkin.stress"],
    },
    {
      id: "restriction_rebound_risk",
      condition: "Calories are significantly below target for several days and craving is intense",
      interpretation:
        "Extended calorie restriction can produce intense cravings — a physiological " +
        "response, not a willpower failure. This is worth addressing by reviewing " +
        "whether the prescription is appropriately calibrated.",
      likelihood: "possible",
      requiresObservedPaths: ["today.macros.calories"],
    },
  ],

  missingEvidenceBehavior: {
    canStillCoach: true,
    minimumRequiredPaths: [],
    askFirst: [
      "Have you eaten your normal meals today?",
      "Is this more of a 'I'm genuinely hungry' craving or more of an 'I just want that specific thing' feeling?",
    ],
    maxConfidenceWithoutMinimum: "low",
  },

  safeActions: [
    {
      kind: "eat",
      description: "Satisfy the craving within the nutrition plan — Craving Creator builds something that fits.",
      condition: "Hedonic craving — nutritional targets are close to being met",
      featureId: "craving_creator",
      contextToPass: "Remaining calorie and macro budget for today",
    },
    {
      kind: "eat",
      description: "Satisfy a sweet craving within the nutrition plan.",
      condition: "Sweet or dessert-specific craving",
      featureId: "dessert_creator",
      contextToPass: "Remaining calorie budget",
    },
    {
      kind: "drink",
      description: "Close the protein gap with a shake rather than another full meal.",
      condition: "Protein is significantly below target — protein gap is driving food noise",
      featureId: "beverage_creator",
      contextToPass: "Remaining protein and calorie budget",
    },
    {
      kind: "eat",
      description: "Build a satisfying meal that addresses the nutritional gap.",
      condition: "Hunger-driven craving — significant calorie or protein shortfall",
      featureId: "meal_builder",
      contextToPass: "Remaining macro targets for today",
    },
    {
      kind: "log",
      description: "Log what you eat so the coach can see whether the craving was nutritional.",
      featureId: "macro_logger",
    },
  ],

  learningOpportunity:
    "If you log your meals and today's check-in, I can tell you whether this is a pattern — " +
    "and whether it's nutritional (fixable by adjusting what or when you eat) or behavioral " +
    "(worth addressing differently).",

  forbiddenConclusions: [
    "Tell the user to use willpower against a food craving",
    "Shame or moralize about wanting a specific food",
    "Attribute cravings to emotional eating without behavioral evidence",
    "Recommend eliminating a food category as a solution to cravings",
    "Assert that the craving means the person is not committed to their plan",
    "Diagnose restriction/rebound without calorie adherence data",
    "Build a meal yourself — always redirect to the appropriate MPM feature",
  ],
};
