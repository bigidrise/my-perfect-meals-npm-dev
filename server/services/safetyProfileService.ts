// server/services/safetyProfileService.ts
// SAFETY INTELLIGENCE LAYER: Pre-generation enforcement for allergies and dietary restrictions
// This module sits ABOVE every meal generator and provides deterministic blocking

import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { ALLERGEN_EXPANSION, RESTRICTION_EXPANSION, maskPlantMilks, maskNutButters } from "./allergyGuardrails";
import { SafetyMode, validateAndConsumeOverrideToken, logSafetyOverride } from "./safetyPinService";

export interface SafetyOptions {
  safetyMode?: SafetyMode;
  overrideToken?: string;
}

export type SafetyResult = "SAFE" | "AMBIGUOUS" | "BLOCKED" | "DIET_ADAPT";

export interface SafetyAssessment {
  result: SafetyResult;
  blockedTerms: string[];
  blockedCategories: string[];
  ambiguousTerms: string[];
  message: string;
  suggestion?: string;
}

export interface SafetyProfile {
  userId: string;
  allergies: string[];
  dietaryRestrictions: string[];
  healthConditions: string[];
  avoidIngredients: string[];
  lastUpdatedSource?: string;
}

const AMBIGUOUS_DISHES: Record<string, { allergens: string[]; warningText: string; safeAlternative: string }> = {
  "jambalaya": {
    allergens: ["shellfish"],
    warningText: "Jambalaya often includes shrimp or shellfish.",
    safeAlternative: "chicken and andouille jambalaya with no shellfish"
  },
  "paella": {
    allergens: ["shellfish", "fish"],
    warningText: "Traditional paella typically contains shellfish and fish.",
    safeAlternative: "chicken and chorizo paella without seafood"
  },
  "seafood": {
    allergens: ["shellfish", "fish"],
    warningText: "Seafood dishes contain fish or shellfish.",
    safeAlternative: "a specific non-seafood protein like chicken or tofu"
  },
  "stir fry": {
    allergens: ["soy", "peanuts", "shellfish"],
    warningText: "Stir fry often uses soy sauce, peanut oil, or shrimp.",
    safeAlternative: "coconut aminos-based stir fry with safe proteins"
  },
  "thai": {
    allergens: ["peanuts", "fish", "shellfish", "soy"],
    warningText: "Thai cuisine commonly uses peanuts, fish sauce, and shrimp.",
    safeAlternative: "specify peanut-free and fish-sauce-free options"
  },
  "pad thai": {
    allergens: ["peanuts", "fish", "shellfish", "eggs"],
    warningText: "Traditional pad thai contains peanuts, fish sauce, and often shrimp.",
    safeAlternative: "chicken pad thai without peanuts and with coconut aminos"
  },
  "fried rice": {
    allergens: ["eggs", "soy", "shellfish"],
    warningText: "Fried rice typically contains eggs and soy sauce.",
    safeAlternative: "egg-free fried rice with coconut aminos"
  },
  "curry": {
    allergens: ["dairy", "tree nuts", "peanuts"],
    warningText: "Many curries contain cream, yogurt, or nut-based sauces.",
    safeAlternative: "coconut milk-based curry without nuts"
  },
  "massaman": {
    allergens: ["peanuts", "tree nuts"],
    warningText: "Massaman curry traditionally includes peanuts.",
    safeAlternative: "massaman-style curry without peanuts"
  },
  "satay": {
    allergens: ["peanuts"],
    warningText: "Satay sauce is made with peanuts.",
    safeAlternative: "grilled skewers with sunflower seed sauce"
  },
  "noodles": {
    allergens: ["gluten", "wheat", "eggs", "soy"],
    warningText: "Most noodles contain wheat/gluten and dishes often use soy sauce.",
    safeAlternative: "rice noodles with coconut aminos"
  },
  "ramen": {
    allergens: ["gluten", "wheat", "eggs", "soy"],
    warningText: "Ramen noodles are wheat-based and broth often contains soy.",
    safeAlternative: "rice noodle soup with tamari or coconut aminos"
  },
  "sushi": {
    allergens: ["fish", "shellfish", "soy", "sesame"],
    warningText: "Sushi typically contains raw fish and is served with soy sauce.",
    safeAlternative: "vegetable sushi rolls with coconut aminos"
  },
  "gumbo": {
    allergens: ["shellfish"],
    warningText: "Gumbo often includes shrimp or crab.",
    safeAlternative: "chicken and sausage gumbo without seafood"
  },
  "bisque": {
    allergens: ["shellfish", "dairy"],
    warningText: "Bisque is typically made with shellfish and cream.",
    safeAlternative: "tomato-based soup without shellfish"
  },
  "chowder": {
    allergens: ["shellfish", "dairy", "fish"],
    warningText: "Chowder typically contains clams or fish and cream.",
    safeAlternative: "corn chowder with coconut milk"
  },
  "ceviche": {
    allergens: ["fish", "shellfish"],
    warningText: "Ceviche is made with raw fish or shellfish.",
    safeAlternative: "hearts of palm ceviche or mango salsa"
  },
  "tempura": {
    allergens: ["gluten", "wheat", "eggs", "shellfish"],
    warningText: "Tempura batter contains wheat and often includes shrimp.",
    safeAlternative: "vegetable tempura with rice flour batter"
  },
  "dan dan": {
    allergens: ["peanuts", "soy", "gluten"],
    warningText: "Dan dan noodles contain peanut sauce and wheat noodles.",
    safeAlternative: "rice noodles with sunflower seed sauce"
  },
  "kung pao": {
    allergens: ["peanuts", "soy"],
    warningText: "Kung pao dishes are made with peanuts.",
    safeAlternative: "kung pao-style with cashews (if safe) or no nuts"
  },
  "laksa": {
    allergens: ["shellfish", "fish", "peanuts"],
    warningText: "Laksa often contains shrimp paste and peanuts.",
    safeAlternative: "chicken laksa without shrimp paste"
  },
  "pho": {
    allergens: ["fish", "soy"],
    warningText: "Pho may contain fish sauce and is served with soy-based condiments.",
    safeAlternative: "vegetable pho with coconut aminos"
  },
  "baklava": {
    allergens: ["tree nuts", "gluten", "wheat"],
    warningText: "Baklava is made with phyllo dough and tree nuts.",
    safeAlternative: "a nut-free, gluten-free dessert"
  },
  "tiramisu": {
    allergens: ["dairy", "eggs", "gluten"],
    warningText: "Tiramisu contains mascarpone cheese, eggs, and ladyfingers.",
    safeAlternative: "vegan tiramisu with cashew cream"
  },
  "cheesecake": {
    allergens: ["dairy", "eggs", "gluten"],
    warningText: "Cheesecake contains cream cheese, eggs, and graham cracker crust.",
    safeAlternative: "vegan cheesecake with nut-free crust"
  }
};

function normalize(s: string): string {
  return s.trim().toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/['']/g, '')
    .replace(/\s+/g, ' ');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function loadSafetyProfile(userId: string): Promise<SafetyProfile | null> {
  try {
    const [user] = await db.select({
      id: users.id,
      allergies: users.allergies,
      dietaryRestrictions: users.dietaryRestrictions,
      healthConditions: users.healthConditions,
      dislikedFoods: users.dislikedFoods,
      avoidedFoods: users.avoidedFoods,
    }).from(users).where(eq(users.id, userId));

    if (!user) {
      console.warn(`⚠️ [SAFETY] User not found: ${userId}`);
      return null;
    }

    return {
      userId,
      allergies: user.allergies || [],
      dietaryRestrictions: user.dietaryRestrictions || [],
      healthConditions: user.healthConditions || [],
      avoidIngredients: [
        ...(user.dislikedFoods || []),
        ...(user.avoidedFoods || [])
      ],
    };
  } catch (error) {
    console.error("Error loading safety profile:", error);
    return null;
  }
}

function buildAllergyTermBank(profile: SafetyProfile): Set<string> {
  const terms = new Set<string>();

  // ALLERGIES ONLY — avoidances are prompt-level preferences, not hard safety blocks
  for (const allergy of profile.allergies) {
    const key = normalize(allergy);
    const expanded = ALLERGEN_EXPANSION[key];
    if (expanded) {
      expanded.forEach(term => terms.add(normalize(term)));
    } else {
      // Fallback: split by spaces — handles merged entries like "Dairy shellfish"
      // stored as a single string (e.g. user typed without comma separators)
      const words = key.split(/\s+/).filter(Boolean);
      let anyWordMatched = false;
      for (const word of words) {
        const wordExpanded = ALLERGEN_EXPANSION[word];
        if (wordExpanded) {
          wordExpanded.forEach(term => terms.add(normalize(term)));
          anyWordMatched = true;
        }
      }
      if (!anyWordMatched) {
        // Last resort: store the whole key so at least an exact phrase match still works
        terms.add(key);
      }
    }
  }

  return terms;
}

function buildDietTermBank(profile: SafetyProfile): Set<string> {
  const terms = new Set<string>();

  for (const restriction of profile.dietaryRestrictions) {
    const key = normalize(restriction);
    const expanded = RESTRICTION_EXPANSION[key];
    if (expanded) {
      expanded.forEach(term => terms.add(normalize(term)));
    }
  }

  return terms;
}

export function buildActiveTermBank(profile: SafetyProfile): Set<string> {
  const allergyTerms = buildAllergyTermBank(profile);
  const dietTerms = buildDietTermBank(profile);
  return new Set([...allergyTerms, ...dietTerms]);
}

function findMatchedTerms(text: string, termBank: Set<string>): string[] {
  const normalizedText = normalize(text);

  // Mask plant milks so bare "milk" doesn't match "almond milk", "oat milk", etc.
  const milkMaskedText     = maskPlantMilks(normalizedText);
  const milkMaskedOriginal = maskPlantMilks(text.toLowerCase());

  // Mask nut butters so bare "butter" doesn't match "peanut butter", "almond butter", etc.
  const butterMaskedText     = maskNutButters(normalizedText);
  const butterMaskedOriginal = maskNutButters(text.toLowerCase());

  const matches: string[] = [];
  const termsArray = Array.from(termBank);
  
  for (const term of termsArray) {
    if (!term) continue;
    
    const pattern = new RegExp(`\\b${escapeRegex(term)}\\b`, 'i');

    const isBareMilk   = (term === "milk");
    const isBareButter = (term === "butter");

    let textToScan: string;
    let origToScan: string;

    if (isBareMilk) {
      textToScan = milkMaskedText;
      origToScan = milkMaskedOriginal;
    } else if (isBareButter) {
      textToScan = butterMaskedText;
      origToScan = butterMaskedOriginal;
    } else {
      textToScan = normalizedText;
      origToScan = text.toLowerCase();
    }
    
    if (pattern.test(textToScan) || pattern.test(origToScan)) {
      matches.push(term);
    }
  }
  
  return Array.from(new Set(matches));
}

function findMatchedCategories(terms: string[], profile: SafetyProfile): string[] {
  const categories: string[] = [];
  
  for (const allergyCategory of profile.allergies) {
    const key = normalize(allergyCategory);

    // Collect all expansion lists for this stored allergy value
    // (handles merged entries like "Dairy shellfish" → try "dairy" + "shellfish" separately)
    const expansions: string[][] = [];
    const direct = ALLERGEN_EXPANSION[key];
    if (direct) {
      expansions.push(direct);
    } else {
      for (const word of key.split(/\s+/).filter(Boolean)) {
        const wordExpanded = ALLERGEN_EXPANSION[word];
        if (wordExpanded) expansions.push(wordExpanded);
      }
    }

    for (const expanded of expansions) {
      const expandedNormalized = expanded.map(e => normalize(e));
      for (const term of terms) {
        if (expandedNormalized.includes(normalize(term))) {
          if (!categories.includes(allergyCategory)) {
            categories.push(allergyCategory);
          }
          break;
        }
      }
    }
  }
  
  return categories;
}

function checkAmbiguousDishes(text: string, profile: SafetyProfile): { dish: string; info: typeof AMBIGUOUS_DISHES[string] }[] {
  const normalizedText = normalize(text);
  const ambiguous: { dish: string; info: typeof AMBIGUOUS_DISHES[string] }[] = [];
  
  const userAllergensArray = profile.allergies.map(a => normalize(a));
  
  for (const [dish, info] of Object.entries(AMBIGUOUS_DISHES)) {
    const pattern = new RegExp(`\\b${escapeRegex(dish)}\\b`, 'i');
    if (pattern.test(normalizedText)) {
      const hasRelevantAllergy = info.allergens.some(allergen => {
        const normalizedAllergen = normalize(allergen);
        for (const userAllergen of userAllergensArray) {
          if (normalizedAllergen === userAllergen || 
              normalizedAllergen.includes(userAllergen) || 
              userAllergen.includes(normalizedAllergen)) {
            return true;
          }
        }
        return false;
      });
      
      if (hasRelevantAllergy) {
        ambiguous.push({ dish, info });
      }
    }
  }
  
  return ambiguous;
}

export function getSafeSubstitute(blockedTerm: string): string {
  const substitutes: Record<string, string> = {
    shrimp: "chicken or tofu",
    crab: "jackfruit or hearts of palm",
    lobster: "mushrooms or cauliflower",
    scallop: "king oyster mushrooms",
    fish: "chicken or tempeh",
    salmon: "marinated tofu or jackfruit",
    tuna: "chickpeas",
    egg: "flax egg or silken tofu",
    eggs: "flax eggs or silken tofu",
    milk: "oat milk or coconut milk",
    cheese: "nutritional yeast or vegan cheese",
    butter: "coconut oil or vegan butter",
    cream: "coconut cream",
    yogurt: "coconut yogurt",
    peanut: "sunflower seed butter",
    peanuts: "sunflower seeds",
    "peanut butter": "sunflower seed butter",
    almond: "pumpkin seeds",
    walnut: "sunflower seeds",
    "tree nuts": "seeds (sunflower, pumpkin)",
    beef: "portobello mushrooms or seitan",
    pork: "jackfruit or tempeh",
    chicken: "tofu or seitan",
    gluten: "rice flour or almond flour",
    wheat: "rice or quinoa",
    soy: "coconut aminos",
    "soy sauce": "coconut aminos"
  };
  
  const key = blockedTerm.toLowerCase();
  return substitutes[key] || "a suitable alternative";
}

export async function enforceSafetyProfile(
  userId: string,
  userText: string,
  builderId: string,
  options?: SafetyOptions
): Promise<SafetyAssessment> {
  const safetyMode = options?.safetyMode || "STRICT";
  const overrideToken = options?.overrideToken;
  
  const profile = await loadSafetyProfile(userId);
  
  if (!profile) {
    return {
      result: "SAFE",
      blockedTerms: [],
      blockedCategories: [],
      ambiguousTerms: [],
      message: "No safety profile found - proceeding with caution"
    };
  }
  
  if (profile.allergies.length === 0 && profile.dietaryRestrictions.length === 0 && profile.avoidIngredients.length === 0) {
    return {
      result: "SAFE",
      blockedTerms: [],
      blockedCategories: [],
      ambiguousTerms: [],
      message: "No allergies or restrictions configured"
    };
  }

  // === PATH 1: ALLERGY CHECK — hard block for medical safety ===
  const allergyTermBank = buildAllergyTermBank(profile);
  const allergyMatches = findMatchedTerms(userText, allergyTermBank);
  const allergyCategories = findMatchedCategories(allergyMatches, profile);

  if (allergyMatches.length > 0) {
    // Check for authenticated override with valid one-time token
    if (safetyMode === "CUSTOM_AUTHENTICATED" && overrideToken) {
      const tokenData = validateAndConsumeOverrideToken(overrideToken, userId);

      if (tokenData) {
        await logSafetyOverride(userId, userText, tokenData.allergen, builderId);
        console.log(`[SafetyGuard] Authenticated override used for user ${userId}, allergen: ${tokenData.allergen}`);
        return {
          result: "SAFE",
          blockedTerms: [],
          blockedCategories: [],
          ambiguousTerms: [],
          message: "Allergen override authorized with Safety PIN - proceeding with user consent"
        };
      } else {
        console.log(`[SafetyGuard] Invalid/expired override token for user ${userId}`);
      }
    }

    const primaryTerm = allergyMatches[0];
    const primaryCategory = allergyCategories[0] || "your allergy profile";
    const substitute = getSafeSubstitute(primaryTerm);

    await logSafetyBlock(userId, builderId, allergyMatches, allergyCategories, userText);

    return {
      result: "BLOCKED",
      blockedTerms: allergyMatches,
      blockedCategories: allergyCategories,
      ambiguousTerms: [],
      message: `🚨 Safety Alert: Your request includes "${primaryTerm}" which conflicts with ${primaryCategory}. For your safety, this meal cannot be generated.`,
      suggestion: `Try requesting with ${substitute} instead.`
    };
  }

  // === PATH 2: AMBIGUOUS DISH CHECK — allergy-only, no change ===
  const ambiguousDishes = checkAmbiguousDishes(userText, profile);

  if (ambiguousDishes.length > 0) {
    if (safetyMode === "CUSTOM_AUTHENTICATED" && overrideToken) {
      const tokenData = validateAndConsumeOverrideToken(overrideToken, userId);

      if (tokenData) {
        await logSafetyOverride(userId, userText, tokenData.allergen, builderId);
        console.log(`[SafetyGuard] Authenticated override for AMBIGUOUS dish, user ${userId}, allergen: ${tokenData.allergen}`);
        return {
          result: "SAFE",
          blockedTerms: [],
          blockedCategories: [],
          ambiguousTerms: [],
          message: "Ambiguous dish override authorized with Safety PIN - proceeding with user consent"
        };
      } else {
        console.log(`[SafetyGuard] Invalid/expired override token for AMBIGUOUS check, user ${userId}`);
      }
    }

    const firstDish = ambiguousDishes[0];
    return {
      result: "AMBIGUOUS",
      blockedTerms: [],
      blockedCategories: [],
      ambiguousTerms: ambiguousDishes.map(d => d.dish),
      message: `⚠️ Caution: ${firstDish.info.warningText} Based on your allergy profile, please specify a safer version.`,
      suggestion: `Try requesting: "${firstDish.info.safeAlternative}"`
    };
  }

  // === PATH 3: DIET CHECK — soft adaptation, AI handles generation ===
  if (profile.dietaryRestrictions.length > 0) {
    const dietTermBank = buildDietTermBank(profile);
    const dietMatches = findMatchedTerms(userText, dietTermBank);

    if (dietMatches.length > 0) {
      const primaryDiet = profile.dietaryRestrictions[0];
      console.log(`🔄 [DIET ADAPT] User ${userId} — "${userText}" conflicts with ${primaryDiet} diet (${dietMatches.join(", ")}) — AI will adapt`);
      return {
        result: "DIET_ADAPT",
        blockedTerms: [],
        blockedCategories: [],
        ambiguousTerms: [],
        message: `Adapting to your ${primaryDiet} preferences`,
        suggestion: `The AI will create a ${primaryDiet}-friendly version for you.`
      };
    }
  }

  return {
    result: "SAFE",
    blockedTerms: [],
    blockedCategories: [],
    ambiguousTerms: [],
    message: "Request passed safety check"
  };
}

export function enforceSafetyProfileSync(
  profile: SafetyProfile,
  userText: string
): SafetyAssessment {
  if (profile.allergies.length === 0 && profile.dietaryRestrictions.length === 0 && profile.avoidIngredients.length === 0) {
    return {
      result: "SAFE",
      blockedTerms: [],
      blockedCategories: [],
      ambiguousTerms: [],
      message: "No allergies or restrictions configured"
    };
  }

  // === PATH 1: ALLERGY CHECK — hard block for medical safety ===
  const allergyTermBank = buildAllergyTermBank(profile);
  const allergyMatches = findMatchedTerms(userText, allergyTermBank);
  const allergyCategories = findMatchedCategories(allergyMatches, profile);

  if (allergyMatches.length > 0) {
    const primaryTerm = allergyMatches[0];
    const primaryCategory = allergyCategories[0] || "your allergy profile";
    const substitute = getSafeSubstitute(primaryTerm);

    return {
      result: "BLOCKED",
      blockedTerms: allergyMatches,
      blockedCategories: allergyCategories,
      ambiguousTerms: [],
      message: `🚨 Safety Alert: Your request includes "${primaryTerm}" which conflicts with ${primaryCategory}. For your safety, this meal cannot be generated.`,
      suggestion: `Try requesting with ${substitute} instead.`
    };
  }

  // === PATH 2: AMBIGUOUS DISH CHECK — allergy-only ===
  const ambiguousDishes = checkAmbiguousDishes(userText, profile);

  if (ambiguousDishes.length > 0) {
    const firstDish = ambiguousDishes[0];
    return {
      result: "AMBIGUOUS",
      blockedTerms: [],
      blockedCategories: [],
      ambiguousTerms: ambiguousDishes.map(d => d.dish),
      message: `⚠️ Caution: ${firstDish.info.warningText} Based on your allergy profile, please specify a safer version.`,
      suggestion: `Try requesting: "${firstDish.info.safeAlternative}"`
    };
  }

  // === PATH 3: DIET CHECK — soft adaptation, AI handles generation ===
  if (profile.dietaryRestrictions.length > 0) {
    const dietTermBank = buildDietTermBank(profile);
    const dietMatches = findMatchedTerms(userText, dietTermBank);

    if (dietMatches.length > 0) {
      const primaryDiet = profile.dietaryRestrictions[0];
      return {
        result: "DIET_ADAPT",
        blockedTerms: [],
        blockedCategories: [],
        ambiguousTerms: [],
        message: `Adapting to your ${primaryDiet} preferences`,
        suggestion: `The AI will create a ${primaryDiet}-friendly version for you.`
      };
    }
  }

  return {
    result: "SAFE",
    blockedTerms: [],
    blockedCategories: [],
    ambiguousTerms: [],
    message: "Request passed safety check"
  };
}

export function validateGeneratedMeal(
  meal: { name?: string; ingredients?: Array<{name: string} | string>; instructions?: string[]; description?: string },
  profile: SafetyProfile
): SafetyAssessment {
  const textParts: string[] = [];
  
  if (meal.name) textParts.push(meal.name);
  if (meal.description) textParts.push(meal.description);
  
  if (meal.ingredients) {
    for (const ing of meal.ingredients) {
      const name = typeof ing === 'string' ? ing : ing.name;
      textParts.push(name);
    }
  }
  
  if (meal.instructions) {
    textParts.push(...meal.instructions);
  }
  
  const fullText = textParts.join(" ");
  return enforceSafetyProfileSync(profile, fullText);
}

async function logSafetyBlock(
  userId: string,
  builderId: string,
  matchedTerms: string[],
  matchedCategories: string[],
  requestText: string
): Promise<void> {
  const timestamp = new Date().toISOString();
  const truncatedRequest = requestText.length > 200 ? requestText.substring(0, 200) + "..." : requestText;
  
  console.log(
    `🚫 [SAFETY BLOCK] ${timestamp}\n` +
    `   User: ${userId}\n` +
    `   Builder: ${builderId}\n` +
    `   Terms: ${matchedTerms.join(", ")}\n` +
    `   Categories: ${matchedCategories.join(", ")}\n` +
    `   Request: "${truncatedRequest}"`
  );
}

export function extractSafetyProfileFromUser(user: any): SafetyProfile {
  return {
    userId: user?.id || "unknown",
    allergies: user?.allergies || [],
    dietaryRestrictions: user?.dietaryRestrictions || [],
    healthConditions: user?.healthConditions || [],
    avoidIngredients: [
      ...(user?.dislikedFoods || []),
      ...(user?.avoidedFoods || [])
    ],
  };
}
