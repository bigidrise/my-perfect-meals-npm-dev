import { getFelineFirewallPromptBlock } from "./felineToxicFirewall";

/**
 * FELINE NUTRITION COMPANION PROTOCOL
 *
 * Complete feline protocol engine. Cats are obligate carnivores with fundamentally
 * different nutritional requirements from dogs and humans. This envelope must NEVER
 * fall back to canine logic. Every cat profile must route here exclusively.
 *
 * Core feline nutritional principles enforced in every generated recipe:
 *   1. Taurine — cats cannot synthesize taurine; must come from animal protein
 *   2. Arachidonic acid — cats cannot convert linoleic acid; must come from animal fat
 *   3. Preformed vitamin A — cats cannot convert beta-carotene; must come from liver/animal tissue
 *   4. High dietary protein — primary energy substrate for obligate carnivores
 *   5. Very low carbohydrates — cats lack glucokinase and have limited carb metabolism
 *   6. High moisture — cats have low thirst drive; dehydration underlies many feline diseases
 *
 * Primary veterinary references:
 *   - NRC (National Research Council) Nutrient Requirements of Cats, 2006
 *   - WSAVA Global Nutrition Guidelines (wsava.org)
 *   - AAHA Nutritional Assessment Guidelines for Dogs and Cats (aaha.org)
 *   - Tufts Cummings School of Veterinary Medicine (vetnutrition.tufts.edu)
 *   - ASPCA Animal Poison Control Center (aspca.org)
 *   - IRIS — International Renal Interest Society (iris-kidney.com)
 *   - AAHA Diabetes Management Guidelines for Dogs and Cats
 */

export interface CatProfile {
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

export interface FelineProtocolEnvelope {
  promptBlock: string;
  citationSources: { source: string; note: string }[];
  activeLayers: string[];
}

const FELINE_WELLNESS_GOAL_PROTOCOLS: Record<
  string,
  { prompt: string; citations: { source: string; note: string }[] }
> = {
  "healthy weight support": {
    prompt:
      "HIGH PROTEIN, LOW CARBOHYDRATE approach for feline weight management. Animal protein must dominate — minimum 40% of dry matter. Minimal to zero starchy carbohydrates (cats lack glucokinase for efficient carb metabolism). Wet/moist food strongly preferred over dry kibble for satiety and weight control. Include high-moisture ingredients. Measured portions — free feeding is contraindicated for overweight cats.",
    citations: [
      {
        source: "WSAVA Global Nutrition Guidelines",
        note: "Body condition scoring and weight management protocols for cats — emphasizing high-protein, low-carbohydrate dietary patterns for feline weight control — wsava.org/guidelines",
      },
      {
        source: "AAHA Nutritional Assessment Guidelines for Dogs and Cats",
        note: "Feline weight management: protein-first, low-carbohydrate approach with moisture emphasis — aaha.org",
      },
    ],
  },

  "overweight cat support": {
    prompt:
      "THERAPEUTIC WEIGHT REDUCTION for cats. Very high quality animal protein to preserve lean muscle mass during calorie restriction. Cats losing weight can develop hepatic lipidosis (fatty liver disease) if calorie reduction is too rapid — gradual reduction is essential. Very low carbohydrate. High moisture content to promote satiety. Structured meal timing (2 meals per day) rather than free feeding. Lean proteins: chicken breast, turkey, white fish. Avoid high-fat preparations.",
    citations: [
      {
        source: "Tufts Cummings School of Veterinary Medicine — Clinical Nutrition Service",
        note: "Feline obesity management: protein-preserved caloric restriction and hepatic lipidosis prevention — vetnutrition.tufts.edu",
      },
      {
        source: "WSAVA Global Nutrition Guidelines",
        note: "Therapeutic weight management guidance for overweight companion animals — wsava.org",
      },
    ],
  },

  "senior wellness support": {
    prompt:
      "HIGH-QUALITY PROTEIN is MORE critical for senior cats than younger adults — not less. Senior cats experience sarcopenia (age-related muscle loss) and require 50% or more protein on a dry matter basis to maintain lean muscle mass. This is opposite to the outdated advice of protein restriction in senior cats without confirmed kidney disease. Highly digestible proteins (chicken, turkey, fish). Kidney-aware: moderate phosphorus. Joint support: omega-3 fatty acids (cooked salmon, sardines). Easy-to-chew textures. Antioxidants for immune support (blueberries). High moisture content.",
    citations: [
      {
        source: "AAHA Senior Care Guidelines for Dogs and Cats",
        note: "Feline senior nutrition: high-protein requirement, muscle preservation, and kidney-aware phosphorus management — aaha.org",
      },
      {
        source: "NRC Nutrient Requirements of Cats, 2006",
        note: "Increased protein digestibility requirements in aging cats; sarcopenia prevention through adequate dietary protein",
      },
      {
        source: "WSAVA Global Nutrition Guidelines — Senior Considerations",
        note: "Age-appropriate nutrition modifications for senior cats — wsava.org",
      },
    ],
  },

  "urinary tract health": {
    prompt:
      "HIGH MOISTURE is the most critical intervention for feline urinary tract health. Cats evolved as desert animals with a low thirst drive — concentrated urine is a primary driver of urinary crystal and stone formation. Wet/moist food is strongly preferred. Target urine dilution through dietary moisture. Avoid excessive minerals (magnesium, phosphorus, calcium) that contribute to crystal formation. Protein from animal sources promotes acidic urine pH which discourages struvite crystal formation. Avoid dry-only food. Include moisture-rich ingredients. Note: urinary blockages are a veterinary emergency — always recommend vet evaluation.",
    citations: [
      {
        source: "AAHA Nutritional Assessment Guidelines for Dogs and Cats",
        note: "Feline lower urinary tract disease (FLUTD) — dietary moisture and mineral balance management — aaha.org",
      },
      {
        source: "Tufts Cummings School of Veterinary Medicine — Clinical Nutrition Service",
        note: "High-moisture dietary strategies for feline urinary health — vetnutrition.tufts.edu",
      },
    ],
  },

  "kidney support nutrition": {
    prompt:
      "FELINE CHRONIC KIDNEY DISEASE (CKD) NUTRITIONAL SUPPORT. Phosphorus restriction is the most evidence-based dietary intervention for slowing CKD progression in cats. Avoid high-phosphorus proteins (organ meat, dairy, legumes, sardines with bones). Maintain adequate HIGH-QUALITY protein — current IRIS and WSAVA guidance supports moderate (not severely restricted) protein to prevent muscle wasting while managing phosphorus load. High moisture is essential — promotes urine dilution and reduces kidney work. Potassium support if hypokalemia is present. Low sodium. Important: always note this is wellness support only; veterinary staging and monitoring are essential.",
    citations: [
      {
        source: "IRIS — International Renal Interest Society — Feline CKD Guidelines",
        note: "Phosphorus restriction staging and nutritional management framework for feline chronic kidney disease — iris-kidney.com",
      },
      {
        source: "WSAVA Global Nutrition Guidelines — Chronic Kidney Disease",
        note: "Evidence-based dietary phosphorus restriction and protein management for cats with CKD — wsava.org",
      },
      {
        source: "Tufts Cummings School of Veterinary Medicine — Renal Diet Support",
        note: "Protein and phosphorus balance in feline CKD: avoiding muscle wasting while controlling phosphorus — vetnutrition.tufts.edu",
      },
    ],
  },

  "hairball reduction": {
    prompt:
      "Hairball reduction through dietary fiber and moisture. High moisture content (wet food preferred) is the most effective dietary tool — dry stool and constipation worsen hairball retention. Soluble and insoluble fiber (plain pumpkin puree — 1–2 tsp — is a well-established feline fiber source). Omega-3 fatty acids improve coat condition and reduce excessive shedding. Avoid overfeeding high-fat foods that slow gastric motility. Regular grooming should be recommended alongside dietary support.",
    citations: [
      {
        source: "Tufts Cummings School of Veterinary Medicine — Clinical Nutrition Service",
        note: "Dietary fiber and moisture strategies for feline hairball management — vetnutrition.tufts.edu",
      },
    ],
  },

  "indoor cat wellness": {
    prompt:
      "Indoor cats have significantly lower caloric needs than outdoor cats due to reduced activity. Weight management is a primary concern — indoor cats are at high risk for obesity. High protein to maintain lean muscle mass despite lower activity. Low carbohydrate. Controlled portion sizes — avoid free feeding. Enrichment feeding (puzzle feeders) helps maintain mental engagement. High moisture to support urinary health (indoor cats are at higher FLUTD risk). Ensure adequate physical activity through play before meals.",
    citations: [
      {
        source: "WSAVA Global Nutrition Guidelines",
        note: "Activity-adjusted caloric requirements for indoor-confined cats and weight management strategies — wsava.org",
      },
      {
        source: "AAHA Nutritional Assessment Guidelines for Dogs and Cats",
        note: "Indoor cat lifestyle factors and obesity prevention — aaha.org",
      },
    ],
  },

  "digestive wellness support": {
    prompt:
      "Highly digestible animal proteins — plain cooked chicken, turkey, or white fish. Avoid high-fat preparations that impair gastric motility. Gentle fiber from plain pumpkin (1–2 tsp) to normalize bowel transit. High moisture content. Small, frequent meals (2–3 per day). Avoid abrupt food changes — introduce new proteins gradually. Single protein source preferred to identify sensitivities.",
    citations: [
      {
        source: "WSAVA Global Nutrition Guidelines — Gastrointestinal Support",
        note: "Highly digestible protein and fiber management for feline GI wellness — wsava.org",
      },
    ],
  },

  "sensitive stomach support": {
    prompt:
      "Limited ingredient diet. Maximum 2–3 total ingredients. Single novel protein source — no mixing protein types. No dairy (cats are lactose intolerant). No high-fat content. Highly digestible only. Plain boiled or steamed protein with plain cooked vegetables. Introduce ingredients one at a time. Eliminate common feline allergens: chicken, beef, fish, dairy, wheat, corn.",
    citations: [
      {
        source: "AAHA Nutritional Assessment Guidelines for Dogs and Cats",
        note: "Elimination diet and food sensitivity management for cats — aaha.org",
      },
    ],
  },

  "skin & coat support": {
    prompt:
      "Omega-3 fatty acids from cooked fish (salmon, sardines) for coat luster and anti-inflammatory skin support. Omega-6 balance — arachidonic acid must come from animal fat, not plant oils alone (cats cannot convert plant-derived linoleic acid efficiently). Taurine is critical for skin integrity in cats. Biotin from cooked egg yolk. Zinc from animal proteins. Avoid nutrient-poor ingredients that dilute protein density.",
    citations: [
      {
        source: "Journal of Veterinary Dermatology — Nutritional Approach to Feline Skin Disorders",
        note: "Dietary fatty acids, taurine, and essential amino acids in feline dermatological health",
      },
      {
        source: "NRC Nutrient Requirements of Cats, 2006",
        note: "Arachidonic acid and taurine requirements for feline skin and coat — cannot be substituted with plant-derived precursors",
      },
    ],
  },

  "dental health support": {
    prompt:
      "Texture and mechanical action through appropriate food forms. Wet food is nutritionally superior for most feline health parameters but provides less mechanical dental action than dry kibble — a trade-off to acknowledge. Avoid sticky, high-sugar ingredients. Adequate hydration (wet food) supports oral tissue health. Regular dental care should be recommended alongside dietary support.",
    citations: [
      {
        source: "AVMA — American Veterinary Medical Association",
        note: "Companion animal dental health and the role of diet in oral wellness — avma.org",
      },
    ],
  },

  "diabetic support nutrition": {
    prompt:
      "FELINE DIABETES REQUIRES A VERY HIGH PROTEIN, VERY LOW CARBOHYDRATE DIET — this is fundamentally different from canine diabetes management. Cats are obligate carnivores that evolved without significant carbohydrate metabolism. High dietary carbohydrates directly worsen feline diabetes by requiring insulin to process glucose cats cannot efficiently handle. Target: less than 10% carbohydrates on a dry matter basis. Very high animal protein (minimum 45–50% dry matter). No grains, no potatoes, no rice, no starchy vegetables. Consistent meal timing — blood glucose regulation requires predictable meal schedule. High moisture (wet food only). Note: veterinary supervision is essential for diabetic cats — this is wellness nutrition support, not medical treatment.",
    citations: [
      {
        source: "AAHA Diabetes Management Guidelines for Dogs and Cats",
        note: "Feline diabetes nutrition: very low carbohydrate, high-protein dietary management — carbohydrate restriction as primary dietary intervention — aaha.org",
      },
      {
        source: "WSAVA Global Nutrition Guidelines — Endocrine Disease",
        note: "Obligate carnivore carbohydrate intolerance and insulin regulation in diabetic cats — wsava.org",
      },
    ],
  },

  "anti-inflammatory support": {
    prompt:
      "Omega-3 fatty acids from cooked fish (salmon, sardines in water — no added salt). EPA and DHA from marine sources — cats cannot efficiently convert plant-based ALA to EPA/DHA. Antioxidants from safe vegetables (blueberries, cooked pumpkin, cooked sweet potato in small amounts). Avoid processed ingredients and fillers. Turmeric: safe for cats in very small amounts (a pinch) — may provide anti-inflammatory support. High-quality animal protein to support tissue repair.",
    citations: [
      {
        source: "Journal of Veterinary Internal Medicine — Omega-3 Fatty Acids in Feline Nutrition",
        note: "EPA and DHA supplementation from marine sources for anti-inflammatory benefit in cats",
      },
      {
        source: "Tufts Cummings School of Veterinary Medicine",
        note: "Anti-inflammatory dietary approaches for companion animals — vetnutrition.tufts.edu",
      },
    ],
  },

  "allergy-sensitive meals": {
    prompt:
      "Novel protein elimination approach. Use proteins this cat has never been exposed to before (rabbit, venison, duck, kangaroo — select based on diet history). Single protein source only — never mix. Limited to 2–3 total ingredients. No common feline allergens: chicken, fish, beef, dairy, wheat, corn, soy, eggs. Avoid any ingredient not confirmed as novel. Introduce ingredients one at a time over 8–12 weeks. Strict avoidance is essential — even trace amounts of allergens can perpetuate symptoms.",
    citations: [
      {
        source: "AAHA Nutritional Assessment Guidelines for Dogs and Cats",
        note: "Novel protein and hydrolyzed protein elimination diet protocols for feline food allergy management — aaha.org",
      },
    ],
  },

  "taurine optimization": {
    prompt:
      "TAURINE IS NON-NEGOTIABLE FOR CATS. Unlike dogs and humans, cats cannot synthesize adequate taurine — it must be provided entirely through diet. Taurine deficiency causes dilated cardiomyopathy (DCM — an often fatal heart condition), retinal degeneration leading to blindness, and reproductive failure. Every cat recipe must be anchored on taurine-rich animal protein sources: chicken heart, beef heart, or dark poultry meat (thigh, leg) — these are the highest natural taurine sources. Cooked fish (salmon, sardines) also provides taurine. Do NOT substitute plant proteins — they provide no taurine. Include at least one high-taurine ingredient as the primary protein in every recipe. Note the taurine content explicitly in the wellness notes.",
    citations: [
      {
        source: "NRC Nutrient Requirements of Cats, 2006",
        note: "Taurine as an essential amino acid for cats — minimum dietary requirements and consequences of deficiency (DCM, retinal degeneration) — National Research Council",
      },
      {
        source: "WSAVA Global Nutrition Guidelines",
        note: "Taurine requirement in obligate carnivores — dietary sourcing and deficiency prevention — wsava.org",
      },
      {
        source: "Journal of Veterinary Internal Medicine — Taurine and Feline Cardiomyopathy",
        note: "Evidence linking dietary taurine deficiency to dilated cardiomyopathy in cats and the critical role of animal-derived protein sources",
      },
    ],
  },
};

// ── MANDATORY BASE PROTOCOL — injected into every cat recipe ─────────────────

const FELINE_OBLIGATE_CARNIVORE_BASE = `
FELINE OBLIGATE CARNIVORE PROTOCOL — MANDATORY IN EVERY RECIPE:
Cats are obligate carnivores. These rules apply to EVERY cat recipe regardless of wellness goals:

1. TAURINE REQUIREMENT: Every recipe must include at least one taurine-rich animal protein.
   Best sources: chicken heart, beef heart (highest taurine), dark poultry meat (thigh/leg), cooked fish.
   Taurine cannot be synthesized by cats — dietary taurine deficiency causes fatal heart disease and blindness.

2. ANIMAL PROTEIN DOMINANCE: Animal protein must be the primary macronutrient (>40% dry matter minimum).
   Do NOT substitute plant proteins for animal proteins. Cats cannot thrive on plant-derived protein alone.

3. ARACHIDONIC ACID: Ensure animal fat is present — cats cannot convert plant-derived linoleic acid to arachidonic acid.
   Small amounts of cooked fatty fish or dark meat provide this.

4. VERY LOW CARBOHYDRATES: Keep starches and sugars minimal or absent.
   Cats have limited glucokinase activity and do not efficiently metabolize carbohydrates.
   Avoid: grains, potatoes, rice, high-starch vegetables as primary ingredients.

5. HIGH MOISTURE: Wet/moist preparation is strongly preferred.
   Cats evolved with a low thirst drive — dehydration underlies many common feline diseases.

6. COOKING: All proteins must be fully cooked. Never use raw fish (thiaminase) or raw egg whites (avidin).
`.trim();

// ── Envelope builder ──────────────────────────────────────────────────────────

export function buildFelineProtocolEnvelope(
  profile: CatProfile
): FelineProtocolEnvelope {
  const activeLayers: string[] = [];
  const citationSources: { source: string; note: string }[] = [
    {
      source: "ASPCA Animal Poison Control Center",
      note: "Primary reference for feline toxic ingredient identification — aspca.org/pet-care/animal-poison-control",
    },
    {
      source: "NRC Nutrient Requirements of Cats, 2006",
      note: "Foundational nutrient requirements for cats including taurine, arachidonic acid, preformed vitamin A, and protein minimums — National Research Council",
    },
  ];

  let protocolBlock = "";

  // LAYER 1: Feline Safety Firewall (always active)
  protocolBlock += `\n${getFelineFirewallPromptBlock()}\n`;
  activeLayers.push("Feline Toxic Ingredient Firewall");

  // LAYER 2: Obligate Carnivore Base Protocol (always active)
  protocolBlock += `\n${FELINE_OBLIGATE_CARNIVORE_BASE}\n`;
  activeLayers.push("Obligate Carnivore Protocol");

  // LAYER 3: Wellness Goals (condition-specific, stackable)
  const goals = profile.wellnessGoals || [];
  const goalBlocks: string[] = [];
  for (const goal of goals) {
    const goalLower = goal.toLowerCase();
    const protocol = Object.entries(FELINE_WELLNESS_GOAL_PROTOCOLS).find(
      ([key]) => goalLower.includes(key) || key.includes(goalLower)
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
    protocolBlock += `\nFELINE WELLNESS PROTOCOL STACK:\n${goalBlocks.map((b) => `- ${b}`).join("\n")}\n`;
  }

  // LAYER 4: Dietary Constraints (Allergies, Sensitivities, Vet Restrictions)
  const allergies = profile.allergies?.filter(Boolean) || [];
  const sensitivities = profile.foodSensitivities?.filter(Boolean) || [];
  const vetRestrictions = profile.vetDietaryRestrictions;

  if (allergies.length > 0) {
    protocolBlock += `\nCAT ALLERGIES — DO NOT USE: ${allergies.join(", ")}\n`;
    activeLayers.push("Allergy Enforcement");
  }
  if (sensitivities.length > 0) {
    protocolBlock += `\nFOOD SENSITIVITIES — AVOID: ${sensitivities.join(", ")}\n`;
    activeLayers.push("Sensitivity Awareness");
  }
  if (vetRestrictions) {
    protocolBlock += `\nVETERINARIAN DIETARY RESTRICTIONS: ${vetRestrictions}\n`;
    activeLayers.push("Vet-Specified Restrictions");
    citationSources.push({
      source: "Attending Veterinarian Guidance",
      note: `Veterinary dietary restrictions specified for ${profile.name}: ${vetRestrictions}`,
    });
  }

  // LAYER 5: Cat Profile Context
  const ageInMonths = profile.ageYears * 12 + (profile.ageMonths || 0);
  const lifestage =
    ageInMonths < 12 ? "kitten" : ageInMonths >= 144 ? "senior" : "adult";
  const sizeCategory =
    profile.weightLbs < 8
      ? "small (lightweight)"
      : profile.weightLbs <= 12
        ? "average size"
        : "large breed";
  const isOverweight =
    profile.goalWeightLbs && profile.goalWeightLbs < profile.weightLbs;
  const activityLevel = profile.activityLevel || "moderate";

  // Add AAHA senior cats citation if senior
  if (lifestage === "senior") {
    const seniorcite = {
      source: "AAHA Senior Care Guidelines for Dogs and Cats",
      note: "Nutritional recommendations for aging companion animals including protein maintenance and kidney-aware phosphorus management — aaha.org",
    };
    if (!citationSources.find((c) => c.source === seniorcite.source)) {
      citationSources.push(seniorcite);
    }
  }

  protocolBlock += `
CAT PROFILE CONTEXT:
- Name: ${profile.name} (${profile.breed}${profile.isMixedBreed ? " mix" : ""})
- Species: CAT (obligate carnivore — feline nutrition rules apply)
- Lifestage: ${lifestage} (${profile.ageYears} years${profile.ageMonths ? `, ${profile.ageMonths} months` : ""})
- Size: ${sizeCategory} (current weight: ${profile.weightLbs} lbs${profile.goalWeightLbs ? `, goal: ${profile.goalWeightLbs} lbs` : ""})
- Sex: ${profile.sex}${profile.isNeutered ? " (neutered/spayed)" : " (intact — consider reproductive nutritional status)"}
- Activity level: ${activityLevel}
- Current diet type: ${profile.currentDietType || "commercial wet food"}
${isOverweight ? "- WEIGHT MANAGEMENT: This cat needs to lose weight. Very high protein, very low carbohydrate. Controlled portions. Avoid hepatic lipidosis risk — gradual caloric reduction only." : ""}
${lifestage === "kitten" ? "- KITTEN: Higher protein, fat, and caloric density for growth. Taurine is especially critical for developing eyes and heart." : ""}
${lifestage === "senior" ? "- SENIOR CAT: Prioritize high-quality digestible protein to prevent sarcopenia. Kidney-aware phosphorus. Easy-to-chew textures." : ""}
${profile.behaviorNotes ? `- Notes: ${profile.behaviorNotes}` : ""}
`.trim();

  activeLayers.push("Feline Profile Context");

  // Generation instructions
  protocolBlock += `

FELINE RECIPE GENERATION INSTRUCTIONS:
- Generate a complete, specific cat recipe with exact ingredient amounts and step-by-step instructions
- Use ${sizeCategory}-appropriate serving sizes for a ${profile.weightLbs}-lb cat
- ALL proteins must be fully cooked — never raw fish, never raw egg whites
- NO added salt, NO seasoning, NO human spices (plain is correct for cats)
- NO dairy products of any kind
- ENSURE taurine-rich protein is the anchor ingredient (chicken heart, beef heart, dark poultry, or cooked fish)
- Keep carbohydrates minimal or absent
- High moisture content preferred
- Include estimated protein content per serving
- Include 1–2 wellness notes explaining why key ingredients benefit this specific cat
- Explicitly mention the taurine source in the wellness notes
- Include 1–2 brief citation references relevant to wellness goals
- This is a FELINE WELLNESS NUTRITION recipe, not veterinary treatment. Include a one-line note recommending veterinary guidance for medical conditions.
`;

  return {
    promptBlock: protocolBlock,
    citationSources,
    activeLayers,
  };
}
