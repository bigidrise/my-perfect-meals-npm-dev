/**
 * Cultural & Religious Relationship Rules
 * Phase 1 — Food Intelligence Layer
 *
 * Defines RELATIONAL rules that cannot be expressed as single-ingredient blocks.
 * Three rule types:
 *   - ingredient_pair_conflict: two ingredients together violate a protocol
 *   - ingredient_condition:     an ingredient is allowed only if a condition is met
 *   - dish_category_review:     a dish name/category always triggers review
 *
 * Rules are data, not code. Adding a new protocol = adding new rule entries.
 */

export type RuleKind =
  | "ingredient_pair_conflict"
  | "ingredient_condition"
  | "dish_category_review";

export type RuleDecision = "BLOCK" | "REVIEW_REQUIRED";
export type RuleSeverity = "hard" | "soft";

export interface RelationshipRule {
  id: string;
  kind: RuleKind;
  protocols: string[];
  description: string;

  /**
   * Whether a chef can fix this conflict by substituting ingredients.
   * true  → show both "Pick Something Else" and "Let Chef Adapt It" in the intercept.
   * false → hard-block; only "Pick Something Else" is shown (certification uncertainty cannot be resolved by substitution alone).
   */
  isAdaptable: boolean;

  when: {
    allIngredients?: string[];
    anyIngredient?: string[];
    dishNameContains?: string[];
    dishCategory?: string[];
  };

  condition?: {
    requiresCertification?: string[];
    requiresSource?: string[];
  };

  effect: {
    decision: RuleDecision;
    severity: RuleSeverity;
    reasonCode: string;
    message: string;
    suggestedSubstitute?: string;
    reviewOverrideAllowed: boolean;
  };
}

export const CULTURAL_RULES: RelationshipRule[] = [

  // ─────────────────────────────────────────────────────────────────
  // KOSHER RULES
  // ─────────────────────────────────────────────────────────────────

  {
    id: "kosher-meat-dairy-conflict",
    kind: "ingredient_pair_conflict",
    protocols: ["kosher"],
    description: "Meat and dairy cannot appear in the same kosher meal",
    isAdaptable: true,
    when: {
      allIngredients: ["meat", "dairy"],
    },
    effect: {
      decision: "BLOCK",
      severity: "hard",
      reasonCode: "KOSHER_MEAT_DAIRY_CONFLICT",
      message: "Kosher law prohibits combining meat and dairy in the same meal.",
      suggestedSubstitute: "Chef can remove the dairy component and use olive oil or a pareve alternative instead.",
      reviewOverrideAllowed: false,
    },
  },

  {
    id: "kosher-pork-block",
    kind: "ingredient_condition",
    protocols: ["kosher"],
    description: "Pork and pork products are not kosher",
    isAdaptable: true,
    when: {
      anyIngredient: [
        "pork", "pig", "bacon", "ham", "prosciutto", "pancetta", "salami",
        "pepperoni", "chorizo", "sausage", "hot dog", "bratwurst", "lard",
        "pork belly", "pork chop", "pulled pork", "ribs", "spare ribs",
        "pork tenderloin", "pork roast", "carnitas", "chicharron",
      ],
    },
    effect: {
      decision: "BLOCK",
      severity: "hard",
      reasonCode: "KOSHER_PORK_FORBIDDEN",
      message: "Pork and pork products are not kosher.",
      suggestedSubstitute: "Replace with kosher beef, chicken, turkey, or lamb.",
      reviewOverrideAllowed: false,
    },
  },

  {
    id: "kosher-shellfish-block",
    kind: "ingredient_condition",
    protocols: ["kosher"],
    description: "Shellfish and crustaceans are not kosher",
    isAdaptable: true,
    when: {
      anyIngredient: [
        "shrimp", "prawn", "crab", "lobster", "clam", "mussel",
        "oyster", "scallop", "squid", "calamari", "octopus",
        "crawfish", "crayfish",
      ],
    },
    effect: {
      decision: "BLOCK",
      severity: "hard",
      reasonCode: "KOSHER_SHELLFISH_FORBIDDEN",
      message: "Shellfish and crustaceans are not kosher.",
      suggestedSubstitute: "Replace with a kosher fish (salmon, tuna, cod, tilapia) or another kosher protein.",
      reviewOverrideAllowed: false,
    },
  },

  {
    id: "kosher-dish-meat-dairy-categories",
    kind: "dish_category_review",
    protocols: ["kosher"],
    description: "Dish names that commonly combine meat and dairy trigger a review",
    isAdaptable: true,
    when: {
      dishNameContains: [
        "cheeseburger", "cheese burger", "bacon cheeseburger",
        "chicken parmesan", "chicken parmigiana", "chicken parm",
        "meat lasagna", "bolognese with cheese", "mac and cheese with meat",
        "hamburger with cheese", "philly cheesesteak", "chili with cheese",
        "beef quesadilla", "chicken quesadilla with cheese",
        // Cream/butter-based pasta with meat — classic kosher meat+dairy conflict
        "beef alfredo", "chicken alfredo with cream", "steak alfredo",
        "meat in cream sauce", "beef in cream sauce",
        // Creamy meat dishes — dairy + meat combination
        "creamy beef", "creamy chicken", "creamy lamb", "creamy turkey",
        "creamy steak", "creamy brisket", "creamy veal", "creamy meat",
        "beef stroganoff", "chicken stroganoff", "beef with cream",
        "chicken with cream", "meat with cream sauce", "beef in cream",
        "creamy pot roast", "creamy beef stew", "creamy chicken stew",
      ],
    },
    effect: {
      decision: "REVIEW_REQUIRED",
      severity: "soft",
      reasonCode: "KOSHER_MEAT_DAIRY_DISH_REVIEW",
      message: "This dish typically combines meat and dairy, which is not permitted under kosher law.",
      suggestedSubstitute: "Chef can remove the dairy component and use olive oil or an herb sauce instead.",
      reviewOverrideAllowed: true,
    },
  },

  // ─────────────────────────────────────────────────────────────────
  // HALAL RULES
  // ─────────────────────────────────────────────────────────────────

  {
    id: "halal-pork-block",
    kind: "ingredient_condition",
    protocols: ["halal"],
    description: "Pork and all pork derivatives are haram",
    isAdaptable: true,
    when: {
      anyIngredient: [
        "pork", "pig", "bacon", "ham", "prosciutto", "pancetta", "salami",
        "pepperoni", "chorizo", "sausage", "hot dog", "bratwurst", "lard",
        "pork belly", "pork chop", "pulled pork", "ribs", "spare ribs",
        "pork tenderloin", "pork roast", "carnitas", "chicharron",
      ],
    },
    effect: {
      decision: "BLOCK",
      severity: "hard",
      reasonCode: "HALAL_PORK_FORBIDDEN",
      message: "Pork and pork derivatives are not halal (haram).",
      suggestedSubstitute: "Replace with halal-certified beef, chicken, turkey, or lamb.",
      reviewOverrideAllowed: false,
    },
  },

  {
    id: "halal-alcohol-block",
    kind: "ingredient_condition",
    protocols: ["halal"],
    description: "Alcohol and alcohol-based ingredients are haram",
    isAdaptable: true,
    when: {
      anyIngredient: [
        "wine", "red wine", "white wine", "beer", "ale", "lager", "stout",
        "vodka", "rum", "whiskey", "bourbon", "brandy", "sake", "mirin",
        "wine sauce", "beer batter", "marsala", "champagne", "prosecco",
        "cooking wine", "white wine sauce", "red wine reduction",
      ],
    },
    effect: {
      decision: "BLOCK",
      severity: "hard",
      reasonCode: "HALAL_ALCOHOL_FORBIDDEN",
      message: "Alcohol-based ingredients are not halal.",
      suggestedSubstitute: "Replace wine with halal-certified grape juice or pomegranate juice. Replace beer with sparkling water or halal broth.",
      reviewOverrideAllowed: false,
    },
  },

  {
    id: "halal-blood-block",
    kind: "ingredient_condition",
    protocols: ["halal"],
    description: "Blood and blood products are haram",
    isAdaptable: true,
    when: {
      anyIngredient: [
        "blood sausage", "black pudding", "blood pudding", "blood cake",
        "boudin noir",
      ],
    },
    effect: {
      decision: "BLOCK",
      severity: "hard",
      reasonCode: "HALAL_BLOOD_FORBIDDEN",
      message: "Blood and blood products are not halal.",
      suggestedSubstitute: "Request an alternative sausage or protein using halal-certified meat.",
      reviewOverrideAllowed: false,
    },
  },

  // ─────────────────────────────────────────────────────────────────
  // UNIVERSAL CERTIFICATION RULES (apply to any strict protocol)
  // ─────────────────────────────────────────────────────────────────

  {
    id: "strict-gelatin-certification-required",
    kind: "ingredient_condition",
    protocols: ["kosher", "halal"],
    description: "Plain gelatin (unknown source) requires certification for strict protocols",
    isAdaptable: false,
    when: {
      anyIngredient: ["gelatin", "gelatine"],
    },
    condition: {
      requiresCertification: ["kosher-certified", "halal-certified", "both-certified"],
    },
    effect: {
      decision: "REVIEW_REQUIRED",
      severity: "hard",
      reasonCode: "GELATIN_CERTIFICATION_UNKNOWN",
      message: "Gelatin source and certification are unknown. Pork-derived gelatin is forbidden for kosher and halal.",
      suggestedSubstitute: "Use agar-agar, pectin, or certified kosher/halal gelatin.",
      reviewOverrideAllowed: true,
    },
  },

  {
    id: "strict-mono-diglycerides-review",
    kind: "ingredient_condition",
    protocols: ["kosher", "halal"],
    description: "Mono- and diglycerides may be pork-derived; require review for strict protocols",
    isAdaptable: false,
    when: {
      anyIngredient: ["mono- and diglycerides", "monoglycerides", "diglycerides", "e471"],
    },
    effect: {
      decision: "REVIEW_REQUIRED",
      severity: "soft",
      reasonCode: "EMULSIFIER_SOURCE_UNKNOWN",
      message: "Mono- and diglycerides may be derived from pork fat and require certification to be kosher or halal.",
      suggestedSubstitute: "Request certified kosher/halal alternatives or a product without emulsifiers.",
      reviewOverrideAllowed: true,
    },
  },
];

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ");
}

export interface RuleViolation {
  rule: RelationshipRule;
  matchedOn: string;
}

function textContainsAny(text: string, terms: string[]): string | null {
  const norm = normalize(text);
  for (const term of terms) {
    if (norm.includes(normalize(term))) return term;
  }
  return null;
}

function extractMeatDairyPresence(ingredients: string[]): { hasMeat: boolean; hasDairy: boolean } {
  const meatTerms = [
    "beef", "chicken", "turkey", "lamb", "veal", "duck", "pork", "ham",
    "steak", "ground beef", "ground turkey", "ground chicken", "brisket",
    "sirloin", "ribeye", "roast", "meat", "poultry",
  ];
  const dairyTerms = [
    "cheese", "milk", "butter", "cream", "yogurt", "whey", "casein",
    "sour cream", "cream cheese", "cheddar", "mozzarella", "parmesan",
    "ricotta", "brie", "gouda", "feta", "dairy",
  ];

  const combinedText = ingredients.join(" ").toLowerCase();
  const hasMeat = meatTerms.some(t => combinedText.includes(t));
  const hasDairy = dairyTerms.some(t => combinedText.includes(t));
  return { hasMeat, hasDairy };
}

export function evaluateRelationshipRules(
  inputText: string,
  ingredients: string[],
  dishName: string,
  activeProtocols: string[]
): RuleViolation[] {
  const violations: RuleViolation[] = [];

  for (const rule of CULTURAL_RULES) {
    if (!rule.protocols.some(p => activeProtocols.includes(p))) continue;

    let matched: string | null = null;

    if (rule.kind === "ingredient_pair_conflict") {
      const groups = rule.when.allIngredients || [];
      if (groups.includes("meat") && groups.includes("dairy")) {
        // At pre-flight time ingredients[] is empty — fall back to scanning
        // the raw input text and dish name so the conflict is caught immediately
        // rather than after 30+ seconds of generation.
        const textSources = ingredients.length > 0
          ? ingredients
          : [inputText, dishName].filter(Boolean);
        const { hasMeat, hasDairy } = extractMeatDairyPresence(textSources);
        if (hasMeat && hasDairy) {
          matched = "meat + dairy combination";
        }
      }
    }

    if (rule.kind === "ingredient_condition" || rule.kind === "ingredient_pair_conflict") {
      if (!matched && rule.when.anyIngredient) {
        matched = textContainsAny(inputText, rule.when.anyIngredient)
          || textContainsAny(ingredients.join(" "), rule.when.anyIngredient);
      }
    }

    if (rule.kind === "dish_category_review") {
      if (rule.when.dishNameContains) {
        matched = textContainsAny(dishName, rule.when.dishNameContains)
          || textContainsAny(inputText, rule.when.dishNameContains);
      }
    }

    if (matched) {
      violations.push({ rule, matchedOn: matched });
    }
  }

  return violations;
}
