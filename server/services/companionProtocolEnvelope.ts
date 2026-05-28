import { getFirewallPromptBlock } from "./companionToxicFirewall";

export interface DogProfile {
  id: string;
  name: string;
  breed: string;
  isMixedBreed: boolean;
  ageYears: number;
  ageMonths?: number;
  sex: string;
  isNeutered: boolean;
  weightLbs: number;
  goalWeightLbs?: number | null;
  activityLevel: string;
  bodyConditionScore?: number | null;
  foodSensitivities?: string[];
  allergies?: string[];
  currentDietType?: string;
  treatsPerDay?: number;
  behaviorNotes?: string;
  vetDietaryRestrictions?: string;
  medications?: string[];
  wellnessGoals?: string[];
}

export interface CompanionProtocolEnvelope {
  promptBlock: string;
  citationSources: { source: string; note: string }[];
  activeLayers: string[];
}

const WELLNESS_GOAL_PROTOCOLS: Record<
  string,
  { prompt: string; citations: { source: string; note: string }[] }
> = {
  "healthy weight support": {
    prompt:
      "Target lean protein as the primary macronutrient. Reduce fat content. Include high-fiber vegetables (green beans, broccoli, carrots). Avoid calorie-dense treats. Portion control is essential.",
    citations: [
      {
        source: "WSAVA Global Nutrition Guidelines",
        note: "Body Condition Score assessment and healthy weight management for companion animals — wsava.org/guidelines",
      },
      {
        source: "AAHA Nutritional Assessment Guidelines",
        note: "Weight management protocols and body composition assessment for dogs — aaha.org",
      },
    ],
  },
  "overweight dog support": {
    prompt:
      "Significantly reduce caloric density. Increase dietary fiber from vegetables. Prioritize lean protein (turkey, chicken breast, white fish). Eliminate high-fat ingredients. Small, frequent servings.",
    citations: [
      {
        source: "WSAVA Global Nutrition Guidelines",
        note: "Obesity management and therapeutic diet guidance for dogs",
      },
      {
        source: "Tufts Cummings School of Veterinary Medicine — Clinical Nutrition Service",
        note: "Evidence-based canine weight loss meal planning — vetnutrition.tufts.edu",
      },
    ],
  },
  "senior wellness support": {
    prompt:
      "High-quality digestible protein to preserve muscle mass. Joint-supportive ingredients (omega-3 rich fish, turmeric). Easily chewable textures. Moderate fat. Brain-supportive antioxidants (blueberries, sweet potato). Reduced phosphorus awareness.",
    citations: [
      {
        source: "AAHA Senior Care Guidelines for Dogs and Cats",
        note: "Nutritional recommendations for aging companion animals — aaha.org",
      },
      {
        source: "WSAVA Global Nutrition Guidelines — Senior Considerations",
        note: "Age-appropriate nutrition modifications for senior dogs",
      },
    ],
  },
  "anti-inflammatory support": {
    prompt:
      "Emphasize omega-3 fatty acids (wild salmon, sardines, flaxseed). Include turmeric with a pinch of black pepper for absorption. Add antioxidant-rich vegetables (blueberries, kale, broccoli). Avoid processed ingredients and high-grain fillers.",
    citations: [
      {
        source: "Journal of Veterinary Internal Medicine — Omega-3 Fatty Acids in Dogs",
        note: "Evidence for anti-inflammatory benefits of EPA/DHA in canine nutrition",
      },
      {
        source: "Tufts Cummings School of Veterinary Medicine",
        note: "Anti-inflammatory dietary approaches for companion animals — vetnutrition.tufts.edu",
      },
    ],
  },
  "digestive wellness support": {
    prompt:
      "Easily digestible proteins (plain cooked chicken, turkey, white fish). Bland, gentle preparation methods. Include probiotic-friendly foods (plain pumpkin puree for fiber regulation). Avoid high-fat and rich ingredients. Small portions.",
    citations: [
      {
        source: "WSAVA Global Nutrition Guidelines — GI Support",
        note: "Dietary management of gastrointestinal conditions in dogs",
      },
    ],
  },
  "sensitive stomach support": {
    prompt:
      "Limit to 2–3 ingredients maximum. Single protein source (no mixing proteins). No high-fat content. No dairy. Plain boiled protein with plain cooked vegetables only. Introduce new ingredients one at a time.",
    citations: [
      {
        source: "AAHA Nutritional Assessment Guidelines",
        note: "Elimination diet and food sensitivity management guidance for dogs",
      },
    ],
  },
  "joint wellness support": {
    prompt:
      "Include omega-3 rich fish (salmon, sardines) for joint lubrication. Add turmeric for natural anti-inflammatory support. Keep weight appropriate to reduce joint load. Include glucosamine-supporting ingredients (bone broth, green-lipped mussel if available).",
    citations: [
      {
        source: "Veterinary Evidence Journal — Omega-3 and Canine Osteoarthritis",
        note: "Evidence for EPA/DHA supplementation in joint health management for dogs",
      },
      {
        source: "WSAVA Global Nutrition Guidelines",
        note: "Musculoskeletal nutritional support guidance for companion animals",
      },
    ],
  },
  "skin & coat support": {
    prompt:
      "High omega-3 and omega-6 fatty acids (salmon, sardines, flaxseed, sunflower seeds). Include vitamin E sources (sunflower seeds, spinach). Biotin-rich foods (eggs, sweet potato). Zinc-rich foods (pumpkin seeds, beef).",
    citations: [
      {
        source: "Journal of Veterinary Dermatology — Nutritional Approach to Skin Disorders",
        note: "Dietary fatty acids and their role in canine dermatological health",
      },
    ],
  },
  "kidney support nutrition": {
    prompt:
      "CRITICAL: Restrict phosphorus — avoid high-phosphorus proteins (organ meat, dairy, legumes). Use moderate, high-quality protein. Restrict sodium. Include fresh vegetables low in phosphorus (green beans, cabbage, zucchini). Ensure high moisture content. Always note: this plan is for wellness support only; veterinary guidance is essential.",
    citations: [
      {
        source: "IRIS (International Renal Interest Society) — Staging of CKD",
        note: "Nutritional management framework for canine kidney conditions — iris-kidney.com",
      },
      {
        source: "Tufts Cummings School of Veterinary Medicine — Renal Diet Support",
        note: "Evidence-based kidney-supportive dietary protocols for dogs — vetnutrition.tufts.edu",
      },
      {
        source: "WSAVA Global Nutrition Guidelines — Chronic Kidney Disease",
        note: "Phosphorus restriction and renal diet management guidance",
      },
    ],
  },
  "diabetic support nutrition": {
    prompt:
      "High-quality lean protein as primary macronutrient. Very high dietary fiber (slows glucose absorption). Avoid simple carbohydrates, sugars, and white rice. Include low-glycemic complex carbohydrates only if needed (barley, oats). Small, consistent meal timing. Note: this is nutritional wellness support — veterinary supervision is essential for diabetic dogs.",
    citations: [
      {
        source: "AAHA Diabetes Management Guidelines for Dogs and Cats",
        note: "Evidence-based nutritional management of canine diabetes mellitus — aaha.org",
      },
      {
        source: "WSAVA Global Nutrition Guidelines — Endocrine Disease",
        note: "Dietary management of diabetes in dogs including glycemic control principles",
      },
    ],
  },
  "allergy-sensitive meals": {
    prompt:
      "Novel protein source (proteins not previously fed — duck, venison, rabbit, or kangaroo). Single protein only. Limited ingredient approach. No common allergens (chicken, beef, dairy, wheat, corn, soy, eggs). Rotate ingredients carefully.",
    citations: [
      {
        source: "AAHA Nutritional Assessment Guidelines — Food Allergy",
        note: "Hydrolyzed and novel protein diet protocols for canine food allergy management",
      },
    ],
  },
  "active dog performance nutrition": {
    prompt:
      "Higher caloric density for energy demands. Elevated protein for muscle maintenance and recovery. Include complex carbohydrates for sustained energy. Add omega-3s for joint support. Ensure adequate hydration. Post-workout: lean protein with easily digestible carbs.",
    citations: [
      {
        source: "Canine Sports Medicine and Rehabilitation — Nutritional Requirements",
        note: "Macronutrient requirements for athletic and working dogs",
      },
      {
        source: "WSAVA Global Nutrition Guidelines — Working and Performance Dogs",
        note: "Caloric and nutrient density recommendations for active companion animals",
      },
    ],
  },
};

export function buildCompanionProtocolEnvelope(
  profile: DogProfile
): CompanionProtocolEnvelope {
  const activeLayers: string[] = [];
  const citationSources: { source: string; note: string }[] = [
    {
      source: "ASPCA Animal Poison Control Center",
      note: "Primary reference for canine toxic ingredient identification — aspca.org/pet-care/animal-poison-control",
    },
  ];

  let protocolBlock = "";

  // LAYER 1: Safety (Toxic Firewall — always active)
  protocolBlock += `\n${getFirewallPromptBlock()}\n`;
  activeLayers.push("Toxic Ingredient Firewall");

  // LAYER 2: Wellness Goals (Condition-specific)
  const goals = profile.wellnessGoals || [];
  const goalBlocks: string[] = [];
  for (const goal of goals) {
    const goalLower = goal.toLowerCase();
    const protocol = Object.entries(WELLNESS_GOAL_PROTOCOLS).find(([key]) =>
      goalLower.includes(key) || key.includes(goalLower)
    );
    if (protocol) {
      goalBlocks.push(`${goal}: ${protocol[1].prompt}`);
      activeLayers.push(goal);
      for (const cite of protocol[1].citations) {
        if (!citationSources.find((c) => c.source === cite.source)) {
          citationSources.push(cite);
        }
      }
    }
  }
  if (goalBlocks.length > 0) {
    protocolBlock += `\nWELLNESS PROTOCOL STACK:\n${goalBlocks.map((b) => `- ${b}`).join("\n")}\n`;
  }

  // LAYER 3: Profile Constraints (Allergies, Sensitivities, Vet Restrictions)
  const allergies = profile.allergies?.filter(Boolean) || [];
  const sensitivities = profile.foodSensitivities?.filter(Boolean) || [];
  const vetRestrictions = profile.vetDietaryRestrictions;

  if (allergies.length > 0) {
    protocolBlock += `\nDOG ALLERGIES — DO NOT USE: ${allergies.join(", ")}\n`;
    activeLayers.push("Allergy Enforcement");
  }
  if (sensitivities.length > 0) {
    protocolBlock += `\nFOOD SENSITIVITIES — AVOID: ${sensitivities.join(", ")}\n`;
    activeLayers.push("Sensitivity Awareness");
  }
  if (vetRestrictions) {
    protocolBlock += `\nVETERINARIAN DIETARY RESTRICTIONS: ${vetRestrictions}\n`;
    activeLayers.push("Vet-Specified Restrictions");
  }

  // LAYER 4: Profile Preferences & Context
  const ageInMonths = profile.ageYears * 12 + (profile.ageMonths || 0);
  const lifestage =
    ageInMonths < 12 ? "puppy" : ageInMonths >= 84 ? "senior" : "adult";
  const size =
    profile.weightLbs < 20
      ? "small breed"
      : profile.weightLbs < 50
        ? "medium breed"
        : "large breed";
  const isOverweight =
    profile.goalWeightLbs && profile.goalWeightLbs < profile.weightLbs;
  const activityLevel = profile.activityLevel || "moderate";

  protocolBlock += `
DOG PROFILE CONTEXT:
- Name: ${profile.name} (${profile.breed}${profile.isMixedBreed ? " mix" : ""})
- Lifestage: ${lifestage} (${profile.ageYears} years${profile.ageMonths ? `, ${profile.ageMonths} months` : ""})
- Size: ${size} (current weight: ${profile.weightLbs} lbs${profile.goalWeightLbs ? `, goal: ${profile.goalWeightLbs} lbs` : ""})
- Sex: ${profile.sex}${profile.isNeutered ? " (neutered/spayed)" : ""}
- Activity level: ${activityLevel}
${isOverweight ? "- WEIGHT MANAGEMENT: This dog needs to lose weight. Reduce calories, increase fiber, prioritize lean protein." : ""}
${profile.behaviorNotes ? `- Behavior notes: ${profile.behaviorNotes}` : ""}
- Current diet type: ${profile.currentDietType || "commercial kibble"}
`.trim();

  activeLayers.push("Profile Context");

  // Final instructions
  protocolBlock += `

GENERATION INSTRUCTIONS:
- Generate a complete, specific recipe with exact ingredient amounts and step-by-step instructions
- Use ${size}-appropriate serving sizes for a ${profile.weightLbs}-lb dog
- All ingredients must be plain, unseasoned, and dog-safe
- Cooking method must be simple: boiling, baking, or steaming — no frying, no oil (except a drop of olive/coconut oil if beneficial)
- Include estimated protein and approximate calorie content per serving
- Include 1–2 wellness notes explaining why key ingredients benefit this specific dog
- Include 1–2 brief citation references relevant to the wellness goals addressed
- The meal should feel premium, nourishing, and clearly made with the dog's specific profile in mind
- This is a WELLNESS NUTRITION recipe, not veterinary treatment. Include a one-line note that veterinary guidance is recommended for medical conditions.
`;

  return {
    promptBlock: protocolBlock,
    citationSources,
    activeLayers,
  };
}
