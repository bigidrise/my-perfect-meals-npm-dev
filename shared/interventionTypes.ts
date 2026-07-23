/**
 * Shared intervention type labels — used by both the UI and any
 * future server-side reporting that needs human-readable condition names.
 */
export const INTERVENTION_CONDITION_LABELS: Record<string, string> = {
  nausea:                       "Nausea",
  vomiting:                     "Vomiting",
  constipation:                 "Constipation",
  diarrhea:                     "Diarrhea",
  early_fullness:               "Early Fullness",
  poor_appetite:                "Reduced Appetite",
  poor_hydration:               "Poor Hydration",
  low_protein:                  "Protein Intake Too Low",
  low_calorie:                  "Calories Consistently Too Low",
  muscle_preservation_risk:     "Lean-Tissue Risk",
  fatigue:                      "Fatigue / Low Energy",
  food_aversion:                "Food Aversion",
  rapid_weight_loss:            "Rapid Weight Loss",
  glucose_concerns:             "Blood Glucose Concerns",
  reflux:                       "Reflux / Heartburn",
  transitioning_off_medication: "Transitioning Off Medication",
};

export const INTERVENTION_SEVERITY_LABELS: Record<string, string> = {
  none:     "None",
  mild:     "Mild",
  moderate: "Moderate",
  severe:   "Severe",
};

/**
 * Provider-facing effect preview — shown in the clinician panel when a
 * condition is set to a non-"none" severity. Each entry describes what
 * the AI will actually change for the patient, giving the provider
 * confidence that their clinical judgment is being translated correctly.
 *
 * These mirror the AI directives in interventionPromptBuilder.ts
 * but are written for clinical staff, not for the AI.
 */
export const INTERVENTION_PROVIDER_EFFECTS: Record<
  string,
  Partial<Record<"mild" | "moderate" | "severe", string[]>>
> = {
  nausea: {
    mild: [
      "Meals capped at 350 cal, fat kept under 12g",
      "Soft textures, mild aromas, bland preparations prioritized",
      "Fried, greasy, and heavily sauced dishes removed",
    ],
    moderate: [
      "Portions under 300 cal, fat under 9g — fried foods eliminated",
      "5–6 small meals recommended instead of 3 large ones",
      "Bland proteins (poached chicken, egg whites) and easily digestible carbs featured",
      "Hydration-supporting foods included every meal",
    ],
    severe: [
      "Very small portions only — under 200 cal, max 6g fat",
      "Only the blandest, most digestible foods — liquids and soft foods prioritized",
      "Hydration is the top priority over nutritional optimization",
      "⚠️ Provider review recommended if adequate intake cannot be maintained",
    ],
  },

  vomiting: {
    mild: [
      "Very small portions under 250 cal",
      "Broth, plain rice, banana, dry crackers prioritized",
      "All high-fat and high-fiber foods removed",
    ],
    moderate: [
      "Portions under 200 cal — only the most easily retained foods",
      "BRAT-adjacent foods: banana, rice, applesauce, toast, clear fluids",
      "⚠️ Monitoring for dehydration — provider should be notified if persisting",
    ],
    severe: [
      "Only clear fluids and the most minimal solid foods if tolerated",
      "🚨 If fluids cannot be retained, immediate provider contact is required",
    ],
  },

  constipation: {
    mild: [
      "Fiber increased through fruits, vegetables, and whole grains",
      "Prunes, flaxseed, chia, and psyllium included where appropriate",
      "Adequate hydration emphasized",
    ],
    moderate: [
      "8g+ fiber targeted per meal — legumes, whole grains, prunes, kiwi, flaxseed featured",
      "Cooked vegetables favored over raw for easier tolerance",
      "Fluid-supporting foods included",
    ],
    severe: [
      "Maximum fiber across every meal — multiple fiber sources per dish",
      "Binding foods (white rice, white bread, cheese) minimized",
      "⚠️ Provider review recommended if unresolved within 3–5 days",
    ],
  },

  diarrhea: {
    mild: [
      "High-fat, high-fiber, spicy, and dairy foods avoided",
      "Binding, gentle foods featured: plain rice, banana, boiled potato, plain chicken",
      "Raw vegetables, bran, prunes, and sorbitol removed",
    ],
    moderate: [
      "BRAT diet enforced: banana, rice, applesauce, toast only",
      "No dairy, no fried food, no raw vegetables — small portions only",
      "⚠️ Dehydration risk — electrolyte fluids recommended",
    ],
    severe: [
      "Only minimal, bland solid foods — electrolyte replacement is critical",
      "🚨 Severe diarrhea with dehydration risk — provider review required",
    ],
  },

  early_fullness: {
    mild: [
      "Compact, nutrient-dense meals — large-volume and high-bulk foods avoided",
      "Calorie-dense, low-volume food selection to maximize nutrition in small portions",
    ],
    moderate: [
      "Portions under 300 cal — high-density nutrition in compact servings",
      "5–6 small meals recommended throughout the day",
      "Bulky vegetables, large grain portions, and high-volume soups replaced",
    ],
    severe: [
      "Very small portions only — under 200 cal with maximum caloric density per bite",
      "No bulky or high-volume foods under any circumstances",
      "⚠️ Provider review if caloric intake is inadequate",
    ],
  },

  poor_appetite: {
    mild: [
      "Calorie-dense, nutrient-rich foods in smaller portions",
      "5–6 small frequent meals recommended instead of 3 large ones",
    ],
    moderate: [
      "Every meal is calorie-dense and protein-rich in a small volume",
      "Healthy fats (avocado, olive oil, nut butter) used to increase caloric density without volume",
      "⚠️ Provider review if patient consistently under-eats",
    ],
    severe: [
      "Maximum caloric density in minimum volume — no low-calorie fillers",
      "Supplement shakes or fortified options are appropriate",
      "⚠️ Provider review required if intake remains inadequate",
    ],
  },

  poor_hydration: {
    mild: [
      "Fluid-rich foods included: broth soups, cucumber, watermelon, smoothies",
      "Hydration reminders added to meal context",
    ],
    moderate: [
      "Every meal includes a fluid-rich component",
      "High-sodium, high-caffeine, and diuretic foods avoided",
      "Water or electrolyte drinks suggested alongside meals",
    ],
    severe: [
      "Hydration is the top clinical priority — fluid-rich foods in every meal and snack",
      "All dehydrating foods removed — sodium limited",
      "⚠️ Elevated risk if patient is also vomiting or experiencing diarrhea",
    ],
  },

  low_protein: {
    mild: [
      "Substantial lean protein required in every meal",
      "High-bioavailability sources prioritized: egg, chicken, fish, Greek yogurt",
      "Protein distributed across all meals and snacks",
    ],
    moderate: [
      "30g+ protein per meal — concentrated sources selected",
      "Greek yogurt, cottage cheese, egg whites, whey, chicken breast featured",
      "Protein shakes or enriched foods suggested if volume is a barrier",
    ],
    severe: [
      "35g+ protein required per meal — no low-protein options generated",
      "⚠️ Lean-tissue loss risk — provider may recommend supplementation",
    ],
  },

  low_calorie: {
    mild: [
      "Meals calorie-boosted — calorie-sparse options replaced with denser alternatives",
      "Very low-calorie meals not generated",
    ],
    moderate: [
      "Every meal must reach 400+ calories — no reduced-calorie or diet versions",
      "Maximum nutritional density across all generated meals",
      "⚠️ Provider review recommended for nutritional adequacy",
    ],
    severe: [
      "Maximum calorie density across all meals and snacks — no caloric restrictions",
      "🚨 Provider escalation if intake remains inadequate",
    ],
  },

  muscle_preservation_risk: {
    mild: [
      "Protein maximized and distributed evenly across all meals",
      "Resistance-training-friendly meal timing recommended",
    ],
    moderate: [
      "30g+ protein required per meal — no very low-calorie meals generated",
      "Leucine-rich proteins prioritized: whey, egg, chicken, fish",
      "High-carb meals at the expense of protein are avoided",
    ],
    severe: [
      "35g+ protein per meal — minimum 300 cal per meal, caloric adequacy mandatory",
      "⚠️ Provider is actively monitoring for muscle wasting indicators",
    ],
  },

  fatigue: {
    mild: [
      "Iron-rich foods, B vitamins, complex carbs, and protein prioritized",
      "Sustained-energy food selection — blood-sugar stability emphasized",
    ],
    moderate: [
      "Every meal includes an energy-supporting protein source and complex carbohydrates",
      "Iron, B12, and magnesium-rich foods featured in every meal",
      "Simple carbohydrates alone avoided to prevent energy crashes",
    ],
    severe: [
      "Maximum micronutrient density — iron, B vitamins, and protein in every meal",
      "No empty-calorie or processed meals generated",
      "⚠️ Provider should evaluate for anemia, thyroid, or other clinical causes",
    ],
  },

  food_aversion: {
    mild: [
      "Strongly flavored, pungent, and aromatic foods removed",
      "Mild, neutral preparations prioritized",
    ],
    moderate: [
      "Garlic, raw onion, strong herbs, pungent cheeses, fishy seafood, and strong spices avoided",
      "Only plain preparations: mild chicken, plain grains, steamed vegetables",
    ],
    severe: [
      "Only neutral, odorless, texturally simple foods generated",
      "⚠️ Provider review needed if nutritional intake is compromised",
    ],
  },

  rapid_weight_loss: {
    mild: [
      "Caloric adequacy ensured — very low-calorie meals not generated",
      "Protein and caloric density prioritized to prevent lean-tissue loss",
    ],
    moderate: [
      "Every meal meets caloric target — minimum 350 cal enforced",
      "⚠️ Monitoring for lean-tissue loss, micronutrient deficiency, and dehydration",
    ],
    severe: [
      "No meal under 400 cal — caloric adequacy is the absolute top priority",
      "No caloric restriction of any kind generated",
      "🚨 Urgent provider review is required",
    ],
  },

  glucose_concerns: {
    mild: [
      "Low-glycemic foods favored — refined carbohydrates limited",
      "Fiber included with every meal to blunt glucose response",
    ],
    moderate: [
      "30–40g carbs per meal, low-GI sources only",
      "No refined sugars, white bread, white rice, or sweetened beverages",
      "Every carbohydrate paired with protein and fat",
    ],
    severe: [
      "Max 25g carbs per meal — only very low-GI sources",
      "No sugars or refined carbs under any circumstances",
      "🚨 Urgent provider review — especially if patient is on insulin or sulfonylurea",
    ],
  },

  reflux: {
    mild: [
      "Citrus, tomato, fried foods, chocolate, mint, and coffee minimized",
      "Common reflux triggers reduced in meal selection",
    ],
    moderate: [
      "All reflux triggers strictly removed: citrus, tomatoes, fried, high-fat, chocolate, mint, carbonated drinks, coffee",
      "Small, frequent meals recommended over large ones",
    ],
    severe: [
      "Zero tolerance for reflux-triggering foods — very low-fat, non-acidic, small portions only",
      "⚠️ Provider review recommended for GERD management",
    ],
  },

  transitioning_off_medication: {
    mild: [
      "Portion sizes gradually normalizing as appetite returns",
      "Protein focus maintained for lean-tissue preservation",
    ],
    moderate: [
      "GLP-1 aggressive portion restriction removed — appetite increase expected",
      "Standard weight-management targets restored: adequate protein, balanced macros, normal portions",
      "Sustainable eating habits and behavioral patterns supported",
    ],
    severe: [
      "Full transition to standard weight-management protocol",
      "GLP-1-specific restrictions fully lifted — normal caloric targets and balanced macros restored",
    ],
  },
};
