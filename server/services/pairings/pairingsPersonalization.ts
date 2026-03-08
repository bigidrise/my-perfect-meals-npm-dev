import { PairingsUserProfile } from "./profileContext";

export interface PairingsPromptConstraints {
  allergyExclusions: string;
  dietaryRules: string;
  medicalGuidance: string;
  alcoholContraindications: string;
  palatePreferences: string;
  fullConstraintBlock: string;
}

export function buildPairingsConstraints(profile: PairingsUserProfile): PairingsPromptConstraints {
  const sections: string[] = [];

  let allergyExclusions = "";
  if (profile.allergies.length > 0) {
    allergyExclusions = `CRITICAL ALLERGY RESTRICTIONS: The user is allergic to: ${profile.allergies.join(", ")}. NEVER recommend drinks containing these ingredients. This is a safety requirement.`;
    sections.push(allergyExclusions);
  }

  let dietaryRules = "";
  const restrictions = [...profile.dietaryRestrictions, ...profile.avoidedFoods];
  if (restrictions.length > 0) {
    dietaryRules = `Dietary restrictions: Avoid recommending drinks that contain: ${restrictions.join(", ")}.`;
    sections.push(dietaryRules);
  }
  if (profile.dislikedFoods.length > 0) {
    const disliked = `Disliked flavors/ingredients: ${profile.dislikedFoods.join(", ")}. Prefer alternatives when possible.`;
    dietaryRules += " " + disliked;
    sections.push(disliked);
  }

  let medicalGuidance = "";
  if (profile.hasDiabetes) {
    medicalGuidance = `DIABETES GUIDANCE (${profile.diabetesType || "diabetes"}): Recommend low-sugar and dry options. Avoid sweet wines, sugary cocktails, and high-sugar beers. Prefer: dry reds, light lagers, neat spirits. Always note sugar content in explanations.`;
    sections.push(medicalGuidance);
  }
  if (profile.hasGLP1) {
    const glp1 = "GLP-1 MEDICATION: User takes GLP-1 medication. Alcohol may amplify nausea and blood sugar effects. Recommend lighter portions and lower-alcohol options when possible. Note this in serving tips.";
    medicalGuidance += (medicalGuidance ? " " : "") + glp1;
    sections.push(glp1);
  }

  let alcoholContraindications = "";
  if (profile.alcoholContraindications.length > 0) {
    alcoholContraindications = `ALCOHOL CONTRAINDICATIONS: ${profile.alcoholContraindications.join(". ")}.`;
    sections.push(alcoholContraindications);
  }

  let palatePreferences = "";
  if (profile.palateSpiceTolerance || profile.palateFlavorStyle) {
    const parts: string[] = [];
    if (profile.palateSpiceTolerance) parts.push(`spice tolerance: ${profile.palateSpiceTolerance}`);
    if (profile.palateSeasoningIntensity) parts.push(`seasoning intensity: ${profile.palateSeasoningIntensity}`);
    if (profile.palateFlavorStyle) parts.push(`flavor style: ${profile.palateFlavorStyle}`);
    palatePreferences = `Palate preferences: ${parts.join(", ")}. Match drink recommendations to these preferences when relevant.`;
    sections.push(palatePreferences);
  }

  return {
    allergyExclusions,
    dietaryRules,
    medicalGuidance,
    alcoholContraindications,
    palatePreferences,
    fullConstraintBlock: sections.length > 0 ? "\n\nUSER PROFILE CONSTRAINTS:\n" + sections.join("\n") : "",
  };
}
