/**
 * FELINE TOXIC INGREDIENT FIREWALL
 *
 * Cat-specific toxic and hazardous ingredient list. Cats have fundamentally
 * different metabolic vulnerabilities than dogs — limited glucuronide conjugation
 * ability in the liver makes them sensitive to many compounds dogs tolerate.
 *
 * Primary reference: ASPCA Animal Poison Control Center (aspca.org/pet-care/animal-poison-control)
 * Supporting references: AVMA, Tufts Cummings Veterinary Clinical Nutrition Service,
 * AAHA Nutritional Assessment Guidelines for Dogs and Cats
 */

import { ToxicIngredient, SafetyResult, RecipeScanResult } from "./companionToxicFirewall";

export const FELINE_TOXIC_INGREDIENTS: ToxicIngredient[] = [
  // ── Shared with dogs — kept explicit for feline firewall completeness ──────
  {
    names: ["chocolate", "cocoa", "cacao", "dark chocolate", "milk chocolate", "white chocolate", "cocoa powder", "cocoa butter"],
    reason: "Contains theobromine and caffeine which cats cannot metabolize. Causes vomiting, tremors, seizures, and cardiac arrest. Fatal in sufficient quantities.",
    severity: "TOXIC",
    substitution: "Carob chips or carob powder — naturally sweet and completely safe for cats.",
  },
  {
    names: ["grapes", "grape", "raisins", "raisin", "currants", "currant", "sultanas", "sultana"],
    reason: "Associated with acute kidney failure. The toxic compound is unknown — no safe amount exists. Even a small quantity can be fatal.",
    severity: "TOXIC",
    substitution: "Blueberries or small seedless watermelon pieces — safe and antioxidant-rich.",
  },
  {
    names: ["onion", "onions", "onion powder", "onion flakes", "white onion", "red onion", "yellow onion", "green onion", "scallion", "chives", "leek", "leeks", "shallot", "shallots"],
    reason: "Allium compounds destroy feline red blood cells causing hemolytic anemia. Cats are more sensitive than dogs — all forms (raw, cooked, dried, powdered) are toxic at lower doses.",
    severity: "TOXIC",
    substitution: "Plain cooked zucchini, green beans, or carrots for vegetable content.",
  },
  {
    names: ["garlic", "garlic powder", "garlic flakes", "garlic salt", "garlic clove", "roasted garlic"],
    reason: "Allium family — among the most dangerous foods for cats. Causes severe oxidative damage to red blood cells and hemolytic anemia even in very small amounts.",
    severity: "TOXIC",
    substitution: "Small amounts of fresh parsley (occasional garnish). No alliums in any form.",
  },
  {
    names: ["xylitol", "birch sugar", "e967", "wood sugar"],
    reason: "Causes dangerous hypoglycemia and acute liver failure. Found in sugar-free products, gum, and some nut butters. Always fatal without immediate veterinary treatment.",
    severity: "TOXIC",
    substitution: "Plain unsweetened whole-food ingredients only. No sweeteners in cat food.",
  },
  {
    names: ["avocado", "avocados", "guacamole"],
    reason: "Contains persin, causing vomiting and diarrhea. The pit is also a choking and obstruction hazard.",
    severity: "TOXIC",
    substitution: "Cooked sweet potato or plain pumpkin for any creamy texture element.",
  },
  {
    names: ["nutmeg", "mace"],
    reason: "Contains myristicin which causes neurological symptoms — disorientation, tremors, and seizures — in cats.",
    severity: "TOXIC",
    substitution: "No spices in cat food. All cat recipes must remain plain and unseasoned.",
  },
  {
    names: ["macadamia nuts", "macadamia", "macadamias"],
    reason: "Causes weakness, vomiting, and tremors in cats. Exact mechanism unknown. Avoid entirely.",
    severity: "TOXIC",
    substitution: "Plain cooked chicken or turkey — high-protein, species-appropriate.",
  },
  {
    names: ["alcohol", "beer", "wine", "spirits", "ethanol", "rum", "vodka", "whiskey", "bourbon"],
    reason: "Cats are far more sensitive to alcohol than humans or dogs. Even tiny amounts cause severe hypoglycemia, neurological depression, and liver failure.",
    severity: "TOXIC",
    substitution: "Low-sodium chicken or fish broth for any liquid base in recipes.",
  },
  {
    names: ["caffeine", "coffee", "espresso", "green tea", "black tea", "energy drink", "caffeinated tea"],
    reason: "Methylxanthines cause restlessness, rapid heart rate, and seizures. No safe level for cats.",
    severity: "TOXIC",
    substitution: "Plain water or low-sodium broth.",
  },

  // ── Cat-specific toxins not present in the canine firewall ────────────────
  {
    names: [
      "easter lily", "tiger lily", "asiatic lily", "day lily", "daylily",
      "stargazer lily", "oriental lily", "rubrum lily", "japanese show lily",
      "wood lily", "true lily", "lily", "lilies",
    ],
    reason: "TRUE LILIES (Lilium and Hemerocallis species) cause acute and often fatal kidney failure in cats. ALL parts — petals, leaves, pollen, and even water from the vase — are toxic. Even a small bite or grooming pollen off fur can be fatal. This is one of the most dangerous cat-specific toxins and must never appear in any feline recipe or food recommendation.",
    severity: "TOXIC",
    substitution: "Never include any lily variety. No substitution — simply omit entirely.",
  },
  {
    names: ["propylene glycol", "propylene-glycol", "1,2-propanediol"],
    reason: "A preservative found in some semi-moist pet foods and processed foods. Causes Heinz body anemia in cats — a life-threatening destruction of red blood cells. Considered safe for dogs but is specifically toxic to cats and banned from cat food by FDA regulation.",
    severity: "TOXIC",
    substitution: "Use only fresh, unprocessed whole-food ingredients.",
  },
  {
    names: [
      "tea tree oil", "tea tree", "melaleuca oil", "eucalyptus oil", "pennyroyal oil",
      "clove oil", "ylang ylang", "peppermint oil", "oregano oil", "thyme oil",
      "essential oil", "essential oils",
    ],
    reason: "Essential oils are highly concentrated phenolic compounds that cats cannot safely metabolize due to deficient hepatic glucuronide conjugation. Even topical exposure causes ataxia, tremors, and liver failure; ingestion is frequently fatal.",
    severity: "TOXIC",
    substitution: "Plain whole herbs only if used at all (small amounts of parsley, catnip). Never use essential oil concentrates.",
  },
  {
    names: ["raw salmon", "raw salmon fillet", "raw trout", "raw fish", "raw tuna", "raw ahi tuna", "raw tilapia", "raw cod", "raw herring"],
    reason: "Raw fish contains thiaminase — an enzyme that destroys thiamine (vitamin B1). Cats are obligate carnivores with higher thiamine requirements than dogs; thiaminase-induced thiamine deficiency causes severe neurological damage, seizures, and death. Always cook fish thoroughly for cats.",
    severity: "TOXIC",
    substitution: "Fully cooked fish (salmon, sardines in water with no added salt) — excellent omega-3 and protein sources when cooked.",
  },
  {
    names: ["raw egg white", "raw egg whites", "uncooked egg white", "raw eggs"],
    reason: "Raw egg whites contain avidin, which blocks biotin (vitamin B7) absorption. Cats require higher biotin as obligate carnivores — biotin deficiency causes dermatitis, coat damage, and neurological symptoms. Cook eggs fully.",
    severity: "CAUTION",
    substitution: "Fully cooked egg (scrambled or hard-boiled) — an excellent protein and amino acid source for cats.",
  },
  {
    names: ["milk", "cow milk", "whole milk", "dairy milk", "cream", "heavy cream", "half and half"],
    reason: "Most adult cats are lactose intolerant and lack sufficient lactase. Cow milk causes digestive upset, bloating, and diarrhea. Despite the cultural myth, milk is inappropriate for cats.",
    severity: "CAUTION",
    substitution: "Fresh water for hydration. High-moisture wet food or unsalted fish broth.",
  },
  {
    names: ["dog food", "dog kibble", "canine formula", "canine food"],
    reason: "Dog food is nutritionally incomplete for cats. It lacks sufficient taurine, arachidonic acid, and preformed vitamin A — all nutrients cats cannot synthesize themselves. Long-term feeding of dog food causes dilated cardiomyopathy (DCM), retinal degeneration, and blindness from taurine deficiency.",
    severity: "TOXIC",
    substitution: "Cat-specific recipes anchored on animal protein sources that provide taurine naturally (heart meat, dark poultry, fish).",
  },
  {
    names: ["table salt", "sea salt", "kosher salt", "added salt", "soy sauce", "teriyaki", "tamari"],
    reason: "Cats have lower sodium tolerance than dogs or humans. Excessive sodium causes sodium ion poisoning, vomiting, tremors, and seizures. Never season cat food.",
    severity: "CAUTION",
    substitution: "No added salt. Low-sodium fish or chicken broth only for moisture and flavor.",
  },
  {
    names: ["raw yeast dough", "yeast dough", "raw bread dough", "unbaked dough"],
    reason: "Yeast ferments in the stomach producing ethanol and causing dangerous expansion. Causes alcohol poisoning and potentially fatal gastric distension in cats.",
    severity: "TOXIC",
    substitution: "Fully baked plain whole grain additions only if any grain is used at all.",
  },
  {
    names: ["apple seeds", "cherry pits", "peach pits", "plum pits", "apricot pits", "nectarine pits"],
    reason: "Contain amygdalin which metabolizes into hydrogen cyanide. Always remove seeds and pits completely.",
    severity: "TOXIC",
    substitution: "Seedless apple flesh or pitted fruit flesh — safe in small amounts.",
  },
];

// ── Firewall functions ────────────────────────────────────────────────────────

export function checkFelineIngredientSafety(ingredient: string): SafetyResult {
  const lower = ingredient.toLowerCase().trim();
  for (const entry of FELINE_TOXIC_INGREDIENTS) {
    const match = entry.names.find(
      (name) => lower.includes(name) || name.includes(lower)
    );
    if (match) {
      return {
        safe: false,
        severity: entry.severity,
        ingredient,
        reason: entry.reason,
        substitution: entry.substitution,
      };
    }
  }
  return { safe: true, severity: "SAFE", ingredient };
}

export function scanRecipeForFelineToxins(recipeText: string): RecipeScanResult {
  const violations: SafetyResult[] = [];
  const lower = recipeText.toLowerCase();
  for (const entry of FELINE_TOXIC_INGREDIENTS) {
    for (const name of entry.names) {
      if (lower.includes(name)) {
        violations.push({
          safe: false,
          severity: entry.severity,
          ingredient: name,
          reason: entry.reason,
          substitution: entry.substitution,
        });
        break;
      }
    }
  }
  return { safe: violations.length === 0, violations };
}

export function getFelineFirewallPromptBlock(): string {
  const toxicList = FELINE_TOXIC_INGREDIENTS.filter((i) => i.severity === "TOXIC")
    .map((i) => i.names[0])
    .join(", ");
  const cautionList = FELINE_TOXIC_INGREDIENTS.filter((i) => i.severity === "CAUTION")
    .map((i) => i.names[0])
    .join(", ");

  return `
FELINE SAFETY FIREWALL — MANDATORY — NON-NEGOTIABLE:
The following ingredients are ABSOLUTELY PROHIBITED in any cat meal or treat recipe.
Do NOT include them. Do NOT suggest them. Do NOT use them in any form (raw, cooked, dried, powdered, or trace amounts).

TOXIC (NEVER USE): ${toxicList}
CAUTION (AVOID COMPLETELY): ${cautionList}

Feline-specific safety rules:
- NEVER include any member of the lily family (easter lily, tiger lily, daylily, etc.) — causes fatal kidney failure in cats
- NEVER use essential oils in any form — cats cannot metabolize phenolic compounds
- NEVER use raw fish of any kind — thiaminase destroys vitamin B1 causing neurological damage; always cook fish
- NEVER use propylene glycol — banned from cat food for causing hemolytic anemia
- NEVER include dog food or dog-formulated products
- NEVER add salt, sodium, or human seasoning of any kind
- NEVER include milk or dairy — cats are lactose intolerant
- ALWAYS ensure taurine is present from animal protein sources (heart meat, dark poultry, cooked fish)
- ALWAYS use fully cooked animal proteins — no raw fish, raw egg whites
- This is a CAT recipe formulated for an OBLIGATE CARNIVORE. Cats require animal protein as their primary nutrient source.
`.trim();
}
