export interface ToxicIngredient {
  names: string[];
  reason: string;
  severity: "TOXIC" | "CAUTION";
  substitution: string;
}

export const TOXIC_INGREDIENTS: ToxicIngredient[] = [
  {
    names: ["chocolate", "cocoa", "cacao", "dark chocolate", "milk chocolate", "white chocolate", "cocoa powder", "cocoa butter"],
    reason: "Contains theobromine and caffeine, which dogs cannot metabolize. Can cause vomiting, seizures, and cardiac arrest. Fatal in sufficient quantities.",
    severity: "TOXIC",
    substitution: "Carob chips or carob powder — naturally sweet and completely safe for dogs.",
  },
  {
    names: ["grapes", "grape", "raisins", "raisin", "currants", "currant", "sultanas", "sultana"],
    reason: "Causes acute kidney failure in dogs. Even small amounts can be fatal. The exact toxic compound is unknown, which makes any amount unsafe.",
    severity: "TOXIC",
    substitution: "Blueberries, watermelon (seedless), or apple slices (no seeds/core).",
  },
  {
    names: ["onion", "onions", "onion powder", "onion flakes", "white onion", "red onion", "yellow onion", "green onion", "scallion", "chives", "leek", "leeks", "shallot", "shallots"],
    reason: "Contains N-propyl disulfide, which destroys red blood cells and causes hemolytic anemia. All forms — raw, cooked, dried, powdered — are toxic.",
    severity: "TOXIC",
    substitution: "Carrots or green beans for crunch and flavor. Parsley in small amounts for seasoning.",
  },
  {
    names: ["garlic", "garlic powder", "garlic flakes", "garlic salt", "garlic clove", "roasted garlic"],
    reason: "Part of the Allium family. Five times more toxic than onions. Damages red blood cells causing anemia. Even small amounts accumulated over time are dangerous.",
    severity: "TOXIC",
    substitution: "Turmeric (anti-inflammatory, dog-safe in small amounts) or fresh parsley for flavor.",
  },
  {
    names: ["xylitol", "birch sugar", "e967", "wood sugar"],
    reason: "Causes a dangerous rapid drop in blood sugar (hypoglycemia) and acute liver failure. Found in sugar-free products, peanut butter, gum, and baked goods. Often fatal.",
    severity: "TOXIC",
    substitution: "Raw honey in very small amounts, or unsweetened peanut butter (check for xylitol-free labeling).",
  },
  {
    names: ["macadamia nuts", "macadamia", "macadamias"],
    reason: "Causes weakness, vomiting, tremors, and hyperthermia in dogs. Mechanism unknown. Even small amounts cause significant symptoms.",
    severity: "TOXIC",
    substitution: "Pumpkin seeds or unsalted sunflower seeds — both are safe and nutritious for dogs.",
  },
  {
    names: ["alcohol", "beer", "wine", "spirits", "ethanol", "rum", "vodka", "whiskey", "bourbon"],
    reason: "Dogs' livers cannot process alcohol. Even small amounts cause vomiting, disorientation, seizures, coma, and death.",
    severity: "TOXIC",
    substitution: "Low-sodium chicken or beef broth for liquid flavor in recipes.",
  },
  {
    names: ["caffeine", "coffee", "espresso", "tea", "green tea", "black tea", "energy drink"],
    reason: "Contains methylxanthines (same family as theobromine in chocolate). Causes restlessness, heart palpitations, seizures. No safe level for dogs.",
    severity: "TOXIC",
    substitution: "Chamomile broth (very diluted, plain) or plain water for liquid base.",
  },
  {
    names: ["avocado", "avocados", "guacamole"],
    reason: "Contains persin, which causes vomiting and diarrhea. The pit is also a choking and obstruction hazard.",
    severity: "TOXIC",
    substitution: "Cooked sweet potato or pumpkin for creamy texture and healthy fats.",
  },
  {
    names: ["nutmeg", "mace"],
    reason: "Contains myristicin, which is toxic to dogs and can cause disorientation, rapid heartbeat, and seizures.",
    severity: "TOXIC",
    substitution: "Cinnamon (in very small amounts) — anti-inflammatory and dog-safe.",
  },
  {
    names: ["raw yeast dough", "yeast dough", "raw bread dough", "unbaked dough"],
    reason: "Yeast produces ethanol as it ferments and expands in the stomach, causing alcohol poisoning and potentially fatal bloat (GDV).",
    severity: "TOXIC",
    substitution: "Use fully baked, plain whole grain treats instead of any dough-based preparation.",
  },
  {
    names: ["salt", "sodium", "table salt", "sea salt", "kosher salt", "soy sauce", "teriyaki"],
    reason: "Excessive sodium causes sodium ion poisoning: vomiting, tremors, seizures, and death. Dogs need only trace sodium; human seasoning levels are dangerous.",
    severity: "CAUTION",
    substitution: "No added salt. Use low-sodium broth for flavor. Dog meals are never seasoned with salt.",
  },
  {
    names: ["macadamia", "walnuts", "black walnuts"],
    reason: "Walnuts (especially black walnuts) can harbor Penicillium mold which produces toxic tremorgenic mycotoxins.",
    severity: "TOXIC",
    substitution: "Pumpkin seeds or flaxseed — both are safe and nutritionally beneficial for dogs.",
  },
  {
    names: ["raw salmon", "raw trout", "raw fish"],
    reason: "Can carry Neorickettsia helminthoeca, causing salmon poisoning disease — a potentially fatal condition in dogs. Always cook fish thoroughly.",
    severity: "CAUTION",
    substitution: "Fully cooked salmon or sardines (in water, no salt) — excellent omega-3 sources for dogs.",
  },
  {
    names: ["apple seeds", "cherry pits", "peach pits", "plum pits", "apricot pits", "nectarine pits"],
    reason: "Contain amygdalin, which metabolizes into hydrogen cyanide. Seeds and pits must always be fully removed.",
    severity: "TOXIC",
    substitution: "Seedless apple slices or pitted fruits — the flesh of these fruits is perfectly safe.",
  },
];

export interface SafetyResult {
  safe: boolean;
  severity: "SAFE" | "CAUTION" | "TOXIC";
  ingredient: string;
  reason?: string;
  substitution?: string;
}

export function checkIngredientSafety(ingredient: string): SafetyResult {
  const lower = ingredient.toLowerCase().trim();
  for (const entry of TOXIC_INGREDIENTS) {
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

export interface RecipeScanResult {
  safe: boolean;
  violations: SafetyResult[];
}

export function scanRecipeForToxins(recipeText: string): RecipeScanResult {
  const violations: SafetyResult[] = [];
  for (const entry of TOXIC_INGREDIENTS) {
    for (const name of entry.names) {
      if (recipeText.toLowerCase().includes(name)) {
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

export function getFirewallPromptBlock(): string {
  const toxicList = TOXIC_INGREDIENTS.filter((i) => i.severity === "TOXIC")
    .map((i) => i.names[0])
    .join(", ");
  const cautionList = TOXIC_INGREDIENTS.filter((i) => i.severity === "CAUTION")
    .map((i) => i.names[0])
    .join(", ");

  return `
COMPANION SAFETY FIREWALL — MANDATORY — NON-NEGOTIABLE:
The following ingredients are ABSOLUTELY PROHIBITED in any dog meal or treat recipe.
Do NOT include them. Do NOT suggest them. Do NOT use them in any form (raw, cooked, dried, powdered, or trace amounts).

TOXIC (NEVER USE): ${toxicList}
CAUTION (AVOID COMPLETELY): ${cautionList}

Additional rules:
- NEVER add salt, sodium, or any human seasoning
- NEVER include alcohol in any form including cooking wine
- NEVER include raw fish (only fully cooked)
- NEVER include apple seeds, cherry pits, or any fruit pits
- ALWAYS keep portions appropriate for the dog's weight
- ALWAYS use plain, unseasoned cooking methods (boiling, baking, steaming)
- This is a DOG recipe, NOT human food. Do not apply human flavor seasoning principles.
`.trim();
}
