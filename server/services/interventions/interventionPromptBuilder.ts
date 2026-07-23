/**
 * Intervention Prompt Builder
 *
 * Maps a provider's active clinical intervention (conditionKey + severity)
 * to concrete AI prompt directives that get injected into the Protocol
 * Envelope as medicalHardLimits and medicalOptimization blocks.
 *
 * These strings enter every generator automatically because they live
 * inside the Protocol Envelope — no per-generator wiring needed.
 */

export type InterventionConditionKey =
  | "nausea"
  | "vomiting"
  | "constipation"
  | "diarrhea"
  | "early_fullness"
  | "poor_appetite"
  | "poor_hydration"
  | "low_protein"
  | "low_calorie"
  | "muscle_preservation_risk"
  | "fatigue"
  | "food_aversion"
  | "rapid_weight_loss"
  | "glucose_concerns"
  | "reflux"
  | "transitioning_off_medication";

export type InterventionSeverity = "none" | "mild" | "moderate" | "severe";

export interface ActiveIntervention {
  conditionKey: InterventionConditionKey;
  severity: InterventionSeverity;
  notes?: string | null;
}

export interface InterventionPromptResult {
  hardLimits: string[];
  optimization: string[];
  escalationWarning: string | null;
  patientSummaryLines: string[];
}

const NAUSEA_PROMPTS: Record<InterventionSeverity, InterventionPromptResult> = {
  none: { hardLimits: [], optimization: [], escalationWarning: null, patientSummaryLines: [] },
  mild: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Patient experiencing mild nausea: keep meal portions under 350 calories, avoid high-fat preparations (max 12g fat per meal), avoid fried, greasy, or heavily sauced dishes.",
    ],
    optimization: [
      "Favor soft textures and mild aromas.",
      "Recommend slower eating and smaller bites.",
      "Choose bland, gentle preparations over rich or spiced dishes.",
    ],
    escalationWarning: null,
    patientSummaryLines: [
      "Meals are sized and prepared to be gentle on your stomach.",
    ],
  },
  moderate: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Patient experiencing moderate nausea: keep meal portions under 300 calories, limit fat to max 9g per meal, completely avoid fried foods, rich sauces, strong aromas, and very high-fiber ingredients.",
      "Suggest 5–6 small meals rather than 3 large meals when generating a daily plan.",
    ],
    optimization: [
      "Prioritize bland, soft, low-fat proteins (poached chicken, egg whites, plain tofu).",
      "Choose mild cooking methods: steaming, poaching, or light baking only.",
      "Include easily digestible carbohydrates (plain rice, toast, banana, plain crackers).",
      "Monitor hydration — include fluid-rich foods and hydrating options.",
    ],
    escalationWarning: null,
    patientSummaryLines: [
      "Your provider has adjusted today's plan for moderate nausea — smaller portions, lower fat, and gentler foods.",
      "More frequent, smaller meals are recommended.",
    ],
  },
  severe: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Patient experiencing severe nausea: portions must be very small (under 200 calories), maximum 6g fat per serving, only the blandest and most digestible foods.",
      "This patient's nausea has been flagged as severe by their provider. Prioritize hydration and tolerability above all nutritional optimization.",
    ],
    optimization: [
      "Only plain, bland, very low-aroma foods.",
      "Liquid or semi-liquid options preferred (broth, smoothies, soft foods).",
      "No rich proteins, no cruciferous vegetables, no high-fiber foods.",
    ],
    escalationWarning: "⚠️ Severe nausea — provider review recommended if patient cannot maintain adequate intake.",
    patientSummaryLines: [
      "Your provider has flagged severe nausea. Your plan is adjusted for maximum tolerability.",
      "If you cannot keep food down, contact your provider.",
    ],
  },
};

const VOMITING_PROMPTS: Record<InterventionSeverity, InterventionPromptResult> = {
  none: { hardLimits: [], optimization: [], escalationWarning: null, patientSummaryLines: [] },
  mild: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Patient has reported vomiting. Keep portions very small (under 250 calories). Prioritize clear liquids and the blandest solid foods. Avoid all high-fat and high-fiber foods.",
    ],
    optimization: ["Favor broth-based meals, plain rice, plain banana, dry crackers, or boiled chicken."],
    escalationWarning: null,
    patientSummaryLines: ["Meals are adjusted to be as gentle as possible while your stomach recovers."],
  },
  moderate: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Patient experiencing moderate vomiting. Portions under 200 calories only. Only the most easily retained foods — dry toast, plain crackers, banana, broth, plain rice. No dairy, no fried food, no high-fat items.",
    ],
    optimization: ["Focus on BRAT-adjacent foods (banana, rice, applesauce, toast) and clear fluids."],
    escalationWarning: "⚠️ Moderate vomiting — monitor for dehydration. Provider should be notified if persisting.",
    patientSummaryLines: [
      "Your meals are very gentle today to reduce nausea and vomiting.",
      "Focus on staying hydrated with small sips of fluid.",
    ],
  },
  severe: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Patient reporting severe vomiting. Only clear fluids and the most minimal solid foods if tolerated. Meal recommendations must be minimal and non-provocative.",
    ],
    optimization: [],
    escalationWarning: "🚨 ESCALATE: Severe vomiting — repeated vomiting and inability to retain fluids is a clinical emergency. Notify provider immediately.",
    patientSummaryLines: [
      "Severe vomiting has been flagged. Please contact your provider if you cannot keep fluids down.",
    ],
  },
};

const CONSTIPATION_PROMPTS: Record<InterventionSeverity, InterventionPromptResult> = {
  none: { hardLimits: [], optimization: [], escalationWarning: null, patientSummaryLines: [] },
  mild: {
    hardLimits: [],
    optimization: [
      "PROVIDER DIRECTIVE — Patient experiencing mild constipation: increase fiber through fruits, vegetables, and whole grains. Include prunes, flaxseed, chia, or psyllium where appropriate. Ensure adequate hydration.",
    ],
    escalationWarning: null,
    patientSummaryLines: ["More fiber-rich foods are included to support digestive comfort."],
  },
  moderate: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Patient experiencing moderate constipation: prioritize high-fiber ingredients (target 8g+ fiber per meal). Include vegetables, legumes, whole grains, and natural laxative foods (prunes, kiwi, flaxseed). Minimize low-fiber, processed foods.",
    ],
    optimization: ["Increase fluid-supporting foods. Favor cooked vegetables over raw for easier tolerance."],
    escalationWarning: null,
    patientSummaryLines: ["High-fiber meals are planned to support digestive regularity."],
  },
  severe: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Patient experiencing severe constipation: highest fiber priority. Every meal should include multiple fiber sources. Limit binding foods (cheese, white rice, white bread). Emphasize hydration.",
    ],
    optimization: [],
    escalationWarning: "⚠️ Severe constipation — provider should review if not resolving within 3–5 days.",
    patientSummaryLines: ["Meals are high in fiber and hydration-friendly to address constipation."],
  },
};

const DIARRHEA_PROMPTS: Record<InterventionSeverity, InterventionPromptResult> = {
  none: { hardLimits: [], optimization: [], escalationWarning: null, patientSummaryLines: [] },
  mild: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Patient experiencing mild diarrhea: avoid high-fat, high-fiber, spicy, or dairy-heavy foods. Choose binding, gentle foods (plain rice, banana, boiled potato, plain chicken).",
    ],
    optimization: ["Favor low-residue foods. Avoid raw vegetables, bran, prunes, or sorbitol-containing foods."],
    escalationWarning: null,
    patientSummaryLines: ["Meals are gentler and binding to support digestive comfort."],
  },
  moderate: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Patient experiencing moderate diarrhea: BRAT-adjacent diet (banana, rice, applesauce, toast). No dairy, no fried food, no raw vegetables, no high-fiber foods. Small portions only.",
    ],
    optimization: [],
    escalationWarning: "⚠️ Moderate diarrhea — monitor for dehydration. Replace fluids and electrolytes.",
    patientSummaryLines: ["Gentle, binding foods are recommended. Stay hydrated with electrolyte fluids."],
  },
  severe: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Patient experiencing severe diarrhea. Only the most minimal, bland solid foods. Electrolyte replacement is critical. Do not suggest any high-fiber, dairy, fatty, or spicy items.",
    ],
    optimization: [],
    escalationWarning: "🚨 ESCALATE: Severe diarrhea with dehydration risk — provider review required.",
    patientSummaryLines: ["Severe GI symptoms noted. Please contact your provider. Stay hydrated."],
  },
};

const LOW_PROTEIN_PROMPTS: Record<InterventionSeverity, InterventionPromptResult> = {
  none: { hardLimits: [], optimization: [], escalationWarning: null, patientSummaryLines: [] },
  mild: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Patient's protein intake is below target. Prioritize protein in every meal. Every meal must include a substantial lean protein source.",
    ],
    optimization: ["Distribute protein across all meals and snacks. Choose high-bioavailability proteins (egg, chicken, fish, Greek yogurt)."],
    escalationWarning: null,
    patientSummaryLines: ["Protein is prioritized in every meal to help meet your daily target."],
  },
  moderate: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Patient's protein intake is consistently too low. Every meal must include at minimum 30g protein. Choose high-density, lower-volume protein sources to maximize protein without requiring large portion sizes.",
    ],
    optimization: [
      "Favor concentrated protein sources: Greek yogurt, cottage cheese, egg whites, whey, chicken breast, fish.",
      "Include protein in snacks. Suggest protein shakes or protein-enriched foods if volume is a barrier.",
    ],
    escalationWarning: null,
    patientSummaryLines: [
      "Your provider has flagged low protein intake. Every meal is protein-prioritized.",
      "Smaller, protein-dense options are recommended.",
    ],
  },
  severe: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Patient has critically low protein intake. Maximum protein density is the top priority for every meal and snack. Every generated item must include 35g+ protein. Do not suggest low-protein options.",
    ],
    optimization: [],
    escalationWarning: "⚠️ Critically low protein — lean-tissue loss risk. Provider should review and consider supplementation.",
    patientSummaryLines: [
      "Your provider has flagged very low protein intake. High-protein options are shown first.",
      "Discuss supplementation options with your provider.",
    ],
  },
};

const POOR_HYDRATION_PROMPTS: Record<InterventionSeverity, InterventionPromptResult> = {
  none: { hardLimits: [], optimization: [], escalationWarning: null, patientSummaryLines: [] },
  mild: {
    hardLimits: [],
    optimization: [
      "PROVIDER DIRECTIVE — Patient's hydration is below goal. Include fluid-rich foods (broth-based soups, cucumber, watermelon, smoothies). Mention hydration reminders in meal context.",
    ],
    escalationWarning: null,
    patientSummaryLines: ["Hydration-supporting foods are included in your plan."],
  },
  moderate: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Patient has poor hydration. Every meal should include a fluid-rich component. Avoid very high-sodium, high-caffeine, or diuretic foods. Suggest water or electrolyte drinks alongside meals.",
    ],
    optimization: ["Include broth soups, smoothies, water-rich fruits and vegetables."],
    escalationWarning: null,
    patientSummaryLines: [
      "Hydration is a focus for today. Fluid-rich foods are included in every meal.",
      "Aim to sip fluids consistently throughout the day rather than large amounts at once.",
    ],
  },
  severe: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Patient is significantly under-hydrating. Hydration is the top clinical priority. Include fluid-rich foods in every meal and snack. Avoid any dehydrating foods. Limit sodium.",
    ],
    optimization: [],
    escalationWarning: "⚠️ Severe hydration deficit — if patient is also experiencing vomiting or diarrhea, dehydration risk is significant. Provider review recommended.",
    patientSummaryLines: [
      "Hydration is critical. Drink fluids in small, frequent amounts.",
      "Contact your provider if you feel dizzy, very thirsty, or have dark urine.",
    ],
  },
};

const MUSCLE_PRESERVATION_PROMPTS: Record<InterventionSeverity, InterventionPromptResult> = {
  none: { hardLimits: [], optimization: [], escalationWarning: null, patientSummaryLines: [] },
  mild: {
    hardLimits: [],
    optimization: [
      "PROVIDER DIRECTIVE — Lean-tissue preservation priority: maximize protein density, distribute protein evenly across meals, favor resistance-training-friendly meal timing.",
    ],
    escalationWarning: null,
    patientSummaryLines: ["Meals are protein-optimized to support muscle preservation."],
  },
  moderate: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Muscle preservation is a clinical priority. Every meal must include 30g+ protein. Do not generate low-protein or very low-calorie meals. Avoid aggressive caloric restriction.",
    ],
    optimization: [
      "Favor leucine-rich proteins (whey, egg, chicken, fish). Distribute protein evenly across 4–5 meals.",
      "Avoid meals that are very high in carbohydrates at the expense of protein.",
    ],
    escalationWarning: null,
    patientSummaryLines: ["Your plan is designed to preserve muscle while supporting your goals."],
  },
  severe: {
    hardLimits: [
      "PROVIDER DIRECTIVE — High lean-tissue loss risk. Protein is the absolute top priority. Minimum 35g protein per meal. No meal under 300 calories. Provider is actively monitoring for muscle wasting indicators.",
    ],
    optimization: [],
    escalationWarning: "⚠️ Significant lean-tissue loss risk — provider is monitoring. Protein and caloric adequacy must be maintained.",
    patientSummaryLines: [
      "Your provider is monitoring for lean-tissue preservation. High-protein meals are required.",
    ],
  },
};

const EARLY_FULLNESS_PROMPTS: Record<InterventionSeverity, InterventionPromptResult> = {
  none: { hardLimits: [], optimization: [], escalationWarning: null, patientSummaryLines: [] },
  mild: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Patient experiences early fullness: keep meals compact and nutrient-dense. Avoid large-volume or high-bulk meals.",
    ],
    optimization: ["Favor calorie-dense, low-volume foods to maximize nutrition in small portions."],
    escalationWarning: null,
    patientSummaryLines: ["Smaller, more concentrated meals are planned for comfort."],
  },
  moderate: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Patient has moderate early fullness. Meal portions must be small (under 300 calories). Favor high-density nutrition in compact servings. Suggest 5–6 small meals.",
    ],
    optimization: ["Avoid bulky vegetables, large grain portions, or high-volume soups as main items."],
    escalationWarning: null,
    patientSummaryLines: ["Smaller, frequent meals are recommended because larger meals cause discomfort."],
  },
  severe: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Severe early fullness. Very small portions only (under 200 calories). Maximum caloric density per bite. No bulky or high-volume foods whatsoever.",
    ],
    optimization: [],
    escalationWarning: "⚠️ Severe early fullness — if caloric intake is inadequate, provider review needed.",
    patientSummaryLines: ["Very small portions are required. Meals are calorie-dense to compensate."],
  },
};

const REFLUX_PROMPTS: Record<InterventionSeverity, InterventionPromptResult> = {
  none: { hardLimits: [], optimization: [], escalationWarning: null, patientSummaryLines: [] },
  mild: {
    hardLimits: [],
    optimization: [
      "PROVIDER DIRECTIVE — Patient experiencing mild reflux: avoid citrus, tomato-based sauces, fried foods, chocolate, mint, coffee, and very spicy foods.",
    ],
    escalationWarning: null,
    patientSummaryLines: ["Foods that commonly trigger reflux are minimized in your plan."],
  },
  moderate: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Patient experiencing moderate reflux: strictly avoid citrus, tomatoes, vinegar, fried foods, high-fat meals, chocolate, mint, peppermint, spicy foods, carbonated drinks, and coffee. Favor upright-friendly smaller meals.",
    ],
    optimization: ["Favor lower-fat, non-acidic preparations. Small, frequent meals over large ones."],
    escalationWarning: null,
    patientSummaryLines: ["Reflux triggers are avoided. Smaller, gentler meals are recommended."],
  },
  severe: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Severe reflux. Avoid all known reflux-triggering foods. Very low-fat, non-acidic, small-portion meals only. No tomato, citrus, fried, spicy, or high-fat items under any circumstances.",
    ],
    optimization: [],
    escalationWarning: "⚠️ Severe reflux — provider should review for GERD management.",
    patientSummaryLines: ["Severe reflux is noted. All trigger foods are removed from your plan."],
  },
};

const RAPID_WEIGHT_LOSS_PROMPTS: Record<InterventionSeverity, InterventionPromptResult> = {
  none: { hardLimits: [], optimization: [], escalationWarning: null, patientSummaryLines: [] },
  mild: {
    hardLimits: [],
    optimization: [
      "PROVIDER DIRECTIVE — Patient is losing weight rapidly. Ensure caloric adequacy. Do not generate very low-calorie meals. Prioritize protein and caloric density.",
    ],
    escalationWarning: null,
    patientSummaryLines: ["Meals are planned to ensure adequate calories and prevent excessive loss."],
  },
  moderate: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Rapid weight loss flagged by provider. Every meal must meet the patient's caloric target. Do not generate meals below 350 calories. Prioritize caloric and protein density.",
    ],
    optimization: [],
    escalationWarning: "⚠️ Rapid weight loss — monitor for lean-tissue loss, micronutrient deficiency, and dehydration. Provider review recommended.",
    patientSummaryLines: ["Your provider is monitoring your weight loss rate. Calorie adequacy is emphasized."],
  },
  severe: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Rapid weight loss at clinically concerning rate. Caloric adequacy is the top priority. No meal under 400 calories. Maximize protein. Do not suggest calorie restriction of any kind.",
    ],
    optimization: [],
    escalationWarning: "🚨 ESCALATE: Rapid weight loss requires urgent provider review.",
    patientSummaryLines: ["Your provider requires urgent review of your weight loss rate. Please contact your provider."],
  },
};

const TRANSITIONING_OFF_MED_PROMPTS: Record<InterventionSeverity, InterventionPromptResult> = {
  none: { hardLimits: [], optimization: [], escalationWarning: null, patientSummaryLines: [] },
  mild: {
    hardLimits: [],
    optimization: [
      "PROVIDER DIRECTIVE — Patient is transitioning off GLP-1 or similar medication. Appetite may return. Gradually normalize portion sizes. Maintain protein focus for muscle preservation.",
    ],
    escalationWarning: null,
    patientSummaryLines: ["As your medication changes, meals will gradually normalize in size."],
  },
  moderate: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Patient is actively transitioning off medication. Appetite will likely increase. Do not continue aggressive portion restriction from GLP-1 protocol. Transition to standard weight-management targets: adequate protein, balanced macros, normal portion sizes.",
    ],
    optimization: ["Maintain protein priority. Avoid excessive caloric restriction. Support sustainable habits."],
    escalationWarning: null,
    patientSummaryLines: [
      "Your meal plan is transitioning to support your new phase of treatment.",
      "Portion sizes will gradually increase as your appetite returns.",
    ],
  },
  severe: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Patient has discontinued medication. Full transition to standard weight-management protocol. Do not apply GLP-1-specific portion restrictions. Resume normal caloric targets and balanced macros.",
    ],
    optimization: [],
    escalationWarning: null,
    patientSummaryLines: ["Your plan has been updated now that your medication has changed. Contact your provider with any questions."],
  },
};

const FATIGUE_PROMPTS: Record<InterventionSeverity, InterventionPromptResult> = {
  none: { hardLimits: [], optimization: [], escalationWarning: null, patientSummaryLines: [] },
  mild: {
    hardLimits: [],
    optimization: [
      "PROVIDER DIRECTIVE — Patient experiencing fatigue: prioritize iron-rich foods, B-vitamin sources, complex carbohydrates for sustained energy, and adequate protein.",
    ],
    escalationWarning: null,
    patientSummaryLines: ["Energy-supporting foods are prioritized in your meals."],
  },
  moderate: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Patient experiencing significant fatigue. Every meal must include an energy-supporting protein source and complex carbohydrates. Avoid blood-sugar-crashing simple carbs alone. Include iron, B12, magnesium-rich foods.",
    ],
    optimization: ["Favor nutrient-dense whole foods over processed options. Steady blood sugar is key."],
    escalationWarning: null,
    patientSummaryLines: ["Meals are designed to support sustained energy throughout the day."],
  },
  severe: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Severe fatigue flagged. All meals must maximize micronutrient density, iron, B vitamins, and protein. No empty-calorie or highly processed meals.",
    ],
    optimization: [],
    escalationWarning: "⚠️ Severe fatigue — provider should evaluate for anemia, thyroid, or other clinical causes.",
    patientSummaryLines: ["Nutrient-dense meals are recommended. Discuss your fatigue with your provider."],
  },
};

const FOOD_AVERSION_PROMPTS: Record<InterventionSeverity, InterventionPromptResult> = {
  none: { hardLimits: [], optimization: [], escalationWarning: null, patientSummaryLines: [] },
  mild: {
    hardLimits: [],
    optimization: [
      "PROVIDER DIRECTIVE — Patient is experiencing food aversion. Avoid strongly flavored, pungent, or aromatic foods. Favor mild, neutral preparations.",
    ],
    escalationWarning: null,
    patientSummaryLines: ["Milder, less aromatic food options are prioritized."],
  },
  moderate: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Patient has moderate food aversion. Only bland, mild, low-aroma foods. Avoid garlic, onion (raw), strong herbs, pungent cheeses, fishy seafood, strong spices, and very rich sauces.",
    ],
    optimization: ["Favor plain preparations. Mild chicken, plain grains, steamed vegetables with little seasoning."],
    escalationWarning: null,
    patientSummaryLines: ["Very mild foods are planned because of food aversion."],
  },
  severe: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Severe food aversion. Only the most neutral, odorless, texturally simple foods. Nutrition must be maintained through plain, acceptable foods only.",
    ],
    optimization: [],
    escalationWarning: "⚠️ Severe food aversion — if intake is compromised, provider review needed.",
    patientSummaryLines: ["Only the plainest foods are recommended. Talk to your provider about maintaining nutrition."],
  },
};

const GLUCOSE_CONCERNS_PROMPTS: Record<InterventionSeverity, InterventionPromptResult> = {
  none: { hardLimits: [], optimization: [], escalationWarning: null, patientSummaryLines: [] },
  mild: {
    hardLimits: [],
    optimization: [
      "PROVIDER DIRECTIVE — Blood glucose concerns noted. Favor low-glycemic foods, limit refined carbohydrates, include fiber with every meal, and distribute carbohydrates evenly.",
    ],
    escalationWarning: null,
    patientSummaryLines: ["Low-glycemic meal options are recommended."],
  },
  moderate: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Provider has flagged blood glucose concerns. Limit total carbohydrates to 30–40g per meal. Favor low-GI carbohydrates only (whole grains, legumes, non-starchy vegetables). No refined sugars, white bread, white rice, or sweetened beverages.",
    ],
    optimization: ["Always pair carbohydrates with protein and fat to blunt glucose response."],
    escalationWarning: null,
    patientSummaryLines: ["Carbohydrates are moderated and paired with protein to support blood sugar balance."],
  },
  severe: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Significant blood glucose concerns. Maximum 25g carbohydrates per meal. Only very low-GI sources. Prioritize protein and fat. No sugars, no refined carbs, no starchy vegetables without clinical clearance.",
    ],
    optimization: [],
    escalationWarning: "🚨 ESCALATE: Significant glucose concerns flagged — provider review urgently needed, especially if patient is on insulin or sulfonylurea.",
    patientSummaryLines: ["Blood glucose is closely monitored. Very low-carb meals are required. Contact your provider."],
  },
};

const POOR_APPETITE_PROMPTS: Record<InterventionSeverity, InterventionPromptResult> = {
  none: { hardLimits: [], optimization: [], escalationWarning: null, patientSummaryLines: [] },
  mild: {
    hardLimits: [],
    optimization: [
      "PROVIDER DIRECTIVE — Patient has reduced appetite. Favor calorie-dense, nutrient-rich foods in smaller portions. Suggest frequent small meals rather than large ones.",
    ],
    escalationWarning: null,
    patientSummaryLines: ["Calorie-dense, smaller options are recommended to support adequate intake."],
  },
  moderate: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Patient has moderate appetite suppression. Every meal must be calorie-dense and protein-rich in a small portion. Do not generate low-calorie meals. Suggest 5–6 small meals.",
    ],
    optimization: ["Favor healthy fats (avocado, olive oil, nut butters) to increase caloric density without volume."],
    escalationWarning: null,
    patientSummaryLines: ["Calorie-dense, small frequent meals are planned to ensure adequate nutrition."],
  },
  severe: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Severe appetite suppression. Maximum caloric density in minimum volume. Every meal should be nutritionally dense. No low-calorie fillers. Supplement shakes or fortified options are appropriate.",
    ],
    optimization: [],
    escalationWarning: "⚠️ Severe appetite suppression — monitor caloric intake carefully. Provider review if patient is consistently under-eating.",
    patientSummaryLines: ["Very small but calorie-dense meals are planned. Discuss supplementation with your provider."],
  },
};

const LOW_CALORIE_PROMPTS: Record<InterventionSeverity, InterventionPromptResult> = {
  none: { hardLimits: [], optimization: [], escalationWarning: null, patientSummaryLines: [] },
  mild: {
    hardLimits: [],
    optimization: [
      "PROVIDER DIRECTIVE — Patient's caloric intake is below target. Increase meal calorie density. Do not generate very low-calorie meals.",
    ],
    escalationWarning: null,
    patientSummaryLines: ["Meals are planned to better meet your calorie goal."],
  },
  moderate: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Patient consistently under-eating. Every meal must reach at least 400 calories. Do not suggest any reduced-calorie or diet versions. Maximize nutritional density.",
    ],
    optimization: [],
    escalationWarning: "⚠️ Consistently low caloric intake — provider review recommended to ensure nutritional adequacy.",
    patientSummaryLines: ["Your provider has noted low calorie intake. Meals are planned to better meet your needs."],
  },
  severe: {
    hardLimits: [
      "PROVIDER DIRECTIVE — Critically low caloric intake. Caloric adequacy is the only priority. Every meal must be 450+ calories. No diet, light, or reduced-calorie items. Prioritize calorie and protein density.",
    ],
    optimization: [],
    escalationWarning: "🚨 ESCALATE: Critically low caloric intake — urgent provider review required.",
    patientSummaryLines: ["Your provider urgently notes very low calorie intake. Please contact your provider."],
  },
};

const PROMPT_MAP: Record<string, Record<InterventionSeverity, InterventionPromptResult>> = {
  nausea:                       NAUSEA_PROMPTS,
  vomiting:                     VOMITING_PROMPTS,
  constipation:                 CONSTIPATION_PROMPTS,
  diarrhea:                     DIARRHEA_PROMPTS,
  early_fullness:               EARLY_FULLNESS_PROMPTS,
  poor_appetite:                POOR_APPETITE_PROMPTS,
  poor_hydration:               POOR_HYDRATION_PROMPTS,
  low_protein:                  LOW_PROTEIN_PROMPTS,
  low_calorie:                  LOW_CALORIE_PROMPTS,
  muscle_preservation_risk:     MUSCLE_PRESERVATION_PROMPTS,
  fatigue:                      FATIGUE_PROMPTS,
  food_aversion:                FOOD_AVERSION_PROMPTS,
  rapid_weight_loss:            RAPID_WEIGHT_LOSS_PROMPTS,
  glucose_concerns:             GLUCOSE_CONCERNS_PROMPTS,
  reflux:                       REFLUX_PROMPTS,
  transitioning_off_medication: TRANSITIONING_OFF_MED_PROMPTS,
};

/**
 * Build all prompt blocks for a set of active interventions.
 * Returns combined hardLimits, optimization strings, escalation warnings,
 * and patient-facing summary lines.
 */
export function buildInterventionPrompts(interventions: ActiveIntervention[]): {
  hardLimits: string[];
  optimization: string[];
  escalationWarnings: string[];
  patientSummaryLines: string[];
} {
  const hardLimits: string[] = [];
  const optimization: string[] = [];
  const escalationWarnings: string[] = [];
  const patientSummaryLines: string[] = [];

  for (const intervention of interventions) {
    if (intervention.severity === "none") continue;

    const conditionMap = PROMPT_MAP[intervention.conditionKey];
    if (!conditionMap) continue;

    const result = conditionMap[intervention.severity];
    if (!result) continue;

    hardLimits.push(...result.hardLimits);
    optimization.push(...result.optimization);
    if (result.escalationWarning) escalationWarnings.push(result.escalationWarning);
    patientSummaryLines.push(...result.patientSummaryLines);
  }

  return { hardLimits, optimization, escalationWarnings, patientSummaryLines };
}

/**
 * Generate the provider-facing summary label for an active intervention.
 */
export function describeIntervention(i: ActiveIntervention): string {
  const condMap: Record<string, string> = {
    nausea: "Nausea", vomiting: "Vomiting", constipation: "Constipation",
    diarrhea: "Diarrhea", early_fullness: "Early Fullness", poor_appetite: "Reduced Appetite",
    poor_hydration: "Poor Hydration", low_protein: "Low Protein", low_calorie: "Low Calorie Intake",
    muscle_preservation_risk: "Lean-Tissue Risk", fatigue: "Fatigue",
    food_aversion: "Food Aversion", rapid_weight_loss: "Rapid Weight Loss",
    glucose_concerns: "Glucose Concerns", reflux: "Reflux",
    transitioning_off_medication: "Transitioning Off Medication",
  };
  const sevMap: Record<string, string> = { mild: "Mild", moderate: "Moderate", severe: "Severe" };
  return `${condMap[i.conditionKey] ?? i.conditionKey} — ${sevMap[i.severity] ?? i.severity}`;
}
