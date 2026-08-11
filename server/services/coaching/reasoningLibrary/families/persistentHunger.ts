import type { ReasoningFamily } from "../../../../../shared/coaching/types";

export const persistentHunger: ReasoningFamily = {
  id: "persistent_hunger",
  name: "Persistent Hunger",
  description: "The user is reporting ongoing or frequent hunger and wants to understand why.",

  activation: {
    intentKeywords: [
      "hungry", "starving", "always hungry", "can't stop eating",
      "food noise", "snacking", "hunger", "appetite", "eating too much",
      "can't stop", "constantly hungry", "never full", "still hungry",
      "need food", "want to eat", "keep eating", "binge",
    ],
    intentIds: ["cravings", "general_inquiry"],
  },

  primaryQuestion:
    "Is this hunger driven by a protein gap, a calorie gap, poor meal distribution, " +
    "low fiber, or is it behavioral — and what can MPM do about it?",

  evidenceNeeded: [
    {
      snapshotPath: "prescription.protein",
      label: "Protein target",
      importance: "required",
      why: "Cannot evaluate protein adequacy without knowing the target.",
    },
    {
      snapshotPath: "prescription.calories",
      label: "Calorie target",
      importance: "required",
      why: "Cannot determine under-eating without knowing the prescription.",
    },
    {
      snapshotPath: "today.macros.protein",
      label: "Protein logged today",
      importance: "required",
      why: "Protein is the primary satiety driver — shortfalls are the most common cause of hunger.",
    },
    {
      snapshotPath: "today.macros.calories",
      label: "Calories logged today",
      importance: "required",
      why: "Under-eating is the simplest explanation for hunger.",
    },
    {
      snapshotPath: "today.macros.fiber",
      label: "Fiber logged today",
      importance: "helpful",
      why: "Low fiber reduces meal volume and satiety duration.",
    },
    {
      snapshotPath: "today.meals.count",
      label: "Meals logged today",
      importance: "helpful",
      why: "Large gaps between meals are a common hunger trigger.",
    },
    {
      snapshotPath: "today.meals.completeness",
      label: "Day completeness",
      importance: "helpful",
      why: "Partial day context — hunger before dinner differs from hunger after a full day.",
    },
    {
      snapshotPath: "today.checkin.hunger",
      label: "Rated hunger level",
      importance: "helpful",
      why: "User-reported hunger confirms the symptom and gauges severity.",
    },
    {
      snapshotPath: "today.hydration.oz",
      label: "Hydration today",
      importance: "contextual",
      why: "Dehydration can masquerade as hunger in some users.",
    },
  ],

  interpretationRules: [
    {
      id: "protein_gap",
      condition: "Protein logged is significantly below target (< 75%) and hunger is reported",
      interpretation:
        "A protein shortfall is a likely driver. Protein is the most satiating macronutrient — " +
        "consistently hitting the target reduces food noise throughout the day.",
      likelihood: "most_likely",
      requiresObservedPaths: ["today.macros.protein", "prescription.protein"],
    },
    {
      id: "calorie_gap",
      condition: "Total calories logged are significantly below target (< 80%) with hunger",
      interpretation:
        "The calorie gap may be driving genuine physical hunger. The day may not be over, " +
        "but a shortfall this large warrants attention.",
      likelihood: "most_likely",
      requiresObservedPaths: ["today.macros.calories", "prescription.calories"],
    },
    {
      id: "meal_distribution",
      condition: "Fewer than 2 meals logged and it is mid-afternoon or later",
      interpretation:
        "Large gaps between meals — or eating infrequently — can produce significant " +
        "hunger even when daily totals would otherwise be adequate.",
      likelihood: "possible",
      requiresObservedPaths: ["today.meals.count"],
    },
    {
      id: "low_fiber",
      condition: "Fiber intake is very low and protein/calories are close to target",
      interpretation:
        "Fibrous foods add meal volume and extend satiety. Low fiber intake can leave " +
        "someone feeling unsatisfied even at appropriate calorie levels.",
      likelihood: "possible",
      requiresObservedPaths: ["today.macros.fiber"],
    },
    {
      id: "on_target_hunger",
      condition: "Protein and calories are both close to target but hunger is still rated high",
      interpretation:
        "Nutrition may not be the primary driver here. This is worth exploring — " +
        "behavioral, environmental, or schedule factors may be contributing.",
      likelihood: "possible",
      requiresObservedPaths: ["today.macros.protein", "today.macros.calories", "today.checkin.hunger"],
    },
    {
      id: "partial_day",
      condition: "Day is not complete yet — dinner or final meals have not been logged",
      interpretation:
        "Hunger before the final meal of the day is expected. A complete picture " +
        "requires knowing what's still planned for today.",
      likelihood: "possible",
      requiresObservedPaths: ["today.meals.completeness"],
    },
  ],

  missingEvidenceBehavior: {
    canStillCoach: true,
    minimumRequiredPaths: [], // can investigate with questions even if all missing
    askFirst: [
      "Have you eaten your normal meals today?",
      "Roughly how many meals have you had so far today?",
    ],
    maxConfidenceWithoutMinimum: "low",
  },

  safeActions: [
    {
      kind: "drink",
      description:
        "When the user is physically hungry but doesn't want a full meal, suggest a lighter liquid option " +
        "(protein shake, smoothie, or similar) that satisfies hunger without requiring a full plate of food. " +
        "No protein-gap evidence is required — the expressed preference for lighter eating is sufficient.",
      condition: "User is hungry but explicitly doesn't want a full meal, or prefers something lighter",
      featureId: "beverage_creator",
      contextToPass: "User's remaining macro targets and preference for lighter/liquid nutrition",
    },
    {
      kind: "eat",
      description: "Add a protein-rich snack or meal to close the protein gap.",
      condition: "Protein is below target",
      featureId: "meal_builder",
      contextToPass: "Remaining protein and calorie budget for today",
    },
    {
      kind: "drink",
      description: "Build a protein shake to close the gap without requiring another full plate of food.",
      condition: "Protein gap exists and calorie budget allows — or user prefers liquid nutrition",
      featureId: "beverage_creator",
      contextToPass: "Remaining protein and calorie targets for today",
    },
    {
      kind: "eat",
      description: "Satisfy a specific craving within the remaining nutrition budget.",
      condition: "User is experiencing food noise or hedonic craving",
      featureId: "craving_creator",
    },
    {
      kind: "log",
      description: "Log today's meals so the coach can see whether protein and calories are actually short.",
      condition: "Today's intake is missing — cannot evaluate cause of hunger",
      featureId: "macro_logger",
    },
  ],

  learningOpportunity:
    "If you log your meals consistently, I can tell you whether your hunger pattern " +
    "is nutritional (too little protein or calories) or something else — and give you " +
    "a much more specific answer than I can today.",

  forbiddenConclusions: [
    "Tell the user they need to eat more overall without confirming calorie data",
    "Attribute hunger to emotional eating without behavioral evidence",
    "Recommend increasing the calorie target without confirmed adherence evidence",
    "Say 'drink more water' as the primary response without hydration data",
    "Diagnose the hunger as a medical condition",
    "Suggest willpower as a solution to hunger",
    "Assert what the user should eat without knowing what they have eaten today",
  ],
};
