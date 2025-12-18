# Hybrid Meal Engine – System Specification (v1)

Goal:
Make meals **deterministic, fast, and professional** by using a **curated catalog as the source of truth**, with AI as a controlled assistant — not the boss.

---

## 1. System Blueprint

### 1.1 Core Principle

* **Catalog is authoritative.**
  Ingredients, techniques, macros, and images come from **curated data**, not AI guesses.
* **AI is optional and constrained.**
  It can:

  * Rephrase instructions
  * Suggest variations
  * Create **rare** new combos
    But everything it outputs must pass deterministic validation before saving.

---

### 1.2 Components

**Client (Web + iOS/Capacitor)**

* Meal Builders (Weekly, Diabetic, GLP-1, Anti-Inflammatory, Pro/Competition, etc.)
* AI Premades Picker
* "Create with AI" / Fridge Rescue
* Meal Detail cards (macros, instructions, image)
* Local caching (recent meals & images)

**Backend**

1. **Catalog Service**

   * Stores:

     * Ingredients
     * Techniques
     * Ingredient↔Technique mappings
     * MealTemplates (canonical meals)
   * Responsible for deterministic behavior:
     "egg_whole + scrambled = scrambled egg image and instructions every time."

2. **Meal Engine**

   * Builds final meals from:

     * Catalog templates
     * User substitutions
     * Prep method selections
   * Optionally uses AI for **text only** (instructions / descriptions).
   * Enforces validation rules before anything is saved.

3. **Image Service**

   * Resolves which image to use:

     * Static catalog image
     * Cached generated image (for rare/special combos)
     * Category-level fallback image
   * Controls naming, storage paths, and deduplication.

4. **Validation & Rules Engine**

   * Validates:

     * Ingredient IDs
     * Technique IDs (allowed pairings)
     * Diet profile compliance
     * Macros within allowed range
     * AI instructions match the requested prep method & ingredients.

5. **Cache Layer**

   * Fast cache (Redis/in-memory) for meals & images.
   * Persistent object store (S3/R2/etc.) for images.

6. **External AI Provider**

   * Used **only** for:

     * Instruction text generation / refinement
     * Rare, new image generation when no static asset exists
   * Everything coming back is checked by Validation Engine.

---

### 1.3 High-Level Data Flow

**Premade / Catalog Meal**

1. Client → `GET /api/catalog/meals/:id`
2. Backend:

   * Fetches `MealTemplate`
   * Resolves canonical `imageUrl`
   * Returns deterministic macros & instructions
3. Client renders instantly. No AI call required.

**AI-Assisted Variation**

1. Client → `POST /api/meals/compose` with:

   * `baseTemplateId`
   * `substitutions`
   * `techniqueOverrides`
   * options (e.g., `useAIForInstructions`)
2. Meal Engine:

   * Builds candidate meal from catalog.
   * Optionally calls AI for text.
   * Runs validation:

     * Ingredient/technique valid
     * Macros within allowed deviation
     * Instructions match requested method
3. If valid → save as `MealVariant`, compute `mealSignatureHash`, cache it.
4. Client gets final, canonicalized meal + image.

**Caching**

* Every composed meal is keyed by `mealSignatureHash`.
* If the same hash shows up again:

  * Return cached meal & image immediately.

---

## 2. Meal Catalog Structure (Data Schema)

All schemas shown in TypeScript-style interfaces for clarity.

### 2.1 Ingredient

```ts
export interface Ingredient {
  id: string;            // "egg_whole", "salmon_fillet", "oats_rolled"
  name: string;          // "Whole Egg"
  category:
    | "protein"
    | "carb"
    | "fat"
    | "veg"
    | "fruit"
    | "dairy"
    | "misc";
  defaultUnit: "g" | "oz" | "cup" | "tbsp" | "tsp";
  caloriesPerUnit: number;
  macrosPerUnit: {
    protein: number;     // grams per defaultUnit
    carbs: number;
    fat: number;
    fiber: number;
  };
  dietTags: string[];    // e.g. ["gluten_free", "keto_friendly"]
  allergenTags: string[];// e.g. ["egg", "fish", "dairy"]
}
```

### 2.2 Technique (Prep Method)

```ts
export interface Technique {
  id: string;            // "scrambled", "sunny_side_up", "baked", "grilled"
  name: string;          // "Scrambled"
  applicableCategories: string[]; // ["protein", "potato", "veg"]
  cookingProfile: {
    methodType: "dry" | "moist" | "fat_added";
    defaultFatAddedGrams: number;
    heatLevel: "low" | "medium" | "high";
    timeMinutes: number;
  };
}
```

### 2.3 IngredientTechniqueMapping

Defines what pairings are legal and how they display.

```ts
export interface IngredientTechniqueMapping {
  ingredientId: string;
  techniqueId: string;
  allowed: boolean;
  displayName: string;   // "Scrambled Eggs", "Baked Potato"
  imageKey?: string;     // "egg_whole__scrambled"
}
```

### 2.4 MealTemplate (Catalog Meal)

```ts
export interface MealTemplate {
  id: string;            // "breakfast_egg_scramble_veggies"
  name: string;          // "Veggie Egg Scramble"
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  dietProfileIds: string[]; // ["general", "diabetic"]
  ingredients: {
    ingredientId: string;
    techniqueId?: string; // optional if prep-independent (e.g., plain yogurt)
    quantity: number;
    unit?: string;        // defaults to Ingredient.defaultUnit
  }[];
  baseInstructionsKey: string; // reference to template instructions
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  imageKey?: string;     // canonical image mapping
  tags: string[];        // ["high_protein", "low_sugar"]
}
```

### 2.5 MealVariant (User-Specific Instance)

```ts
export interface MealVariant {
  id: string;
  baseTemplateId: string;
  userId?: string | null;  // null = shared variant
  source: "catalog" | "user_custom" | "ai_assisted";
  ingredients: {
    ingredientId: string;
    techniqueId?: string;
    quantity: number;
    unit: string;
  }[];
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  instructions: string;
  imageUrl: string;
  mealSignatureHash: string; // deterministic hash of structure
  createdAt: string;
}
```

---

## 3. Prep & Category Mapping

### 3.1 Goal

Guarantee:

* When user chooses **Scrambled** →

  * ingredient-technique is valid
  * title & instructions say "scrambled"
  * image shows scrambled, **not** sunny-side-up.

### 3.2 Example Mappings

**Eggs**

```ts
// Ingredient
egg_whole => category: "protein"

// Mappings
[
  {
    ingredientId: "egg_whole",
    techniqueId: "scrambled",
    allowed: true,
    displayName: "Scrambled Eggs",
    imageKey: "egg_whole__scrambled"
  },
  {
    ingredientId: "egg_whole",
    techniqueId: "sunny_side_up",
    allowed: true,
    displayName: "Sunny-Side-Up Eggs",
    imageKey: "egg_whole__sunny"
  },
  {
    ingredientId: "egg_whole",
    techniqueId: "boiled",
    allowed: true,
    displayName: "Boiled Eggs",
    imageKey: "egg_whole__boiled"
  }
]
```

**Potatoes**

```ts
[
  {
    ingredientId: "potato_russet",
    techniqueId: "baked",
    allowed: true,
    displayName: "Baked Potato",
    imageKey: "potato_russet__baked"
  },
  {
    ingredientId: "potato_russet",
    techniqueId: "mashed",
    allowed: true,
    displayName: "Mashed Potatoes",
    imageKey: "potato_russet__mashed"
  },
  {
    ingredientId: "potato_russet",
    techniqueId: "hash_brown",
    allowed: true,
    displayName: "Hash Browns",
    imageKey: "potato_russet__hash"
  }
]
```

### 3.3 Validation Helper

```ts
function validateIngredientTechnique(
  ingredientId: string,
  techniqueId?: string
): IngredientTechniqueMapping | null {
  if (!techniqueId) return null;
  const mapping = lookupMapping(ingredientId, techniqueId);
  if (!mapping || !mapping.allowed) {
    throw new Error("Invalid preparation style for this ingredient.");
  }
  return mapping;
}
```

AI output must always pass this mapping check before being accepted.

---

## 4. Image Strategy

### 4.1 Image Types

1. **Static Catalog Images**

   * For `(ingredientId, techniqueId)` or `(mealTemplateId, techniqueId)`
   * Deterministic, curated, and pre-rendered.

2. **Generated Images (Rare)**

   * Only for:

     * New, unusual combinations not covered by catalog.
   * Generated once → stored → reused.

3. **Fallback Images**

   * Category-level:

     * "Generic protein bowl"
     * "Generic smoothie"
     * "Generic salad"
   * Used when:

     * No specific image exists
     * AI generation fails
     * Validation flags inconsistency

---

### 4.2 Naming Conventions

**Keys (no extension):**

* Ingredient + Technique
  `ingredientId__techniqueId`
  e.g. `egg_whole__scrambled`

* Meal Template + Technique
  `mealTemplateId__techniqueId`
  e.g. `breakfast_egg_scramble_veggies__scrambled`

* Variant Hash
  `mealSignatureHash`
  e.g. `msig_5f4c8f...`

**Paths in Object Storage:**

```text
/catalog/ingredients/egg_whole__scrambled@1x.jpg
/catalog/ingredients/egg_whole__scrambled@2x.jpg

/catalog/meals/breakfast_egg_scramble_veggies__scrambled@1x.jpg

/generated/meals/msig_5f4c8f.jpg
/fallbacks/protein_generic.jpg
```

---

### 4.3 Deduplication Rules

* Before generating a new image:

  * Compute `mealSignatureHash`.
  * Check if `/generated/meals/{mealSignatureHash}.jpg` exists.
  * If yes → reuse existing image.
  * If no → generate, store, and index it.

---

## 5. Validation Rules

### 5.1 Structural Validation

Always run **before saving** a `MealVariant`.

1. **Ingredient Check**

   * All `ingredientId`s must exist in catalog.
   * No banned ingredients for the user's diet profile.

2. **Technique Check**

   * Every `(ingredientId, techniqueId)` combination must pass:

     * `validateIngredientTechnique(...)`.

3. **Macro Consistency**

   * Recalculate macros from:

     * Ingredient macros
     * Technique cookingProfile (fat added, etc.)
   * Reject if outside allowed deviation from:

     * Base template, or
     * User's macro policy, depending on context.

---

### 5.2 Instruction Validation

When AI is used for instructions:

* Requirements:

  * All ingredients in instructions must exist in the final ingredient list.
  * No "surprise" ingredients appear.
  * Technique-specific keywords appear (e.g. "whisk" / "scramble" / "medium heat" for scrambled eggs).
  * Time ranges and methods are within technique's allowed profile.

Pseudo-code:

```ts
function validateInstructions(
  instructions: string,
  meal: MealVariant
): void {
  const text = instructions.toLowerCase();

  // Technique keyword check
  for (const item of meal.ingredients) {
    if (!item.techniqueId) continue;
    const technique = getTechnique(item.techniqueId);
    const keywords = techniqueValidationKeywords[technique.id] || [];
    const hasKeyword = keywords.some(k => text.includes(k));
    if (!hasKeyword) {
      throw new Error(`Instructions do not match technique: ${technique.id}`);
    }
  }

  // Ingredient name sanity check can be added here
}
```

If validation fails:

* Either:

  * Regenerate instructions with tighter prompt, OR
  * Fallback to catalog baseInstructions.

---

### 5.3 Image Validation (Optional Future Step)

If image tagging / vision is used:

* Confirm image category matches meal:

  * Meat vs fish vs eggs vs grains.
* If mismatch → fallback to static catalog or category image.

---

## 6. Caching Rules

### 6.1 Meal Cache

**Key:** `mealSignatureHash` (deterministic)

Inputs used to form the signature:

* `baseTemplateId`
* sorted list of `(ingredientId, quantity, unit, techniqueId)`
* any relevant options (e.g., "no oil", "extra crispy" flag, if supported)

Strategy:

```ts
function getOrCreateMealVariant(request): MealVariant {
  const hash = computeMealSignatureHash(request);
  const cached = mealCache.get(hash);
  if (cached) return { ...cached, fromCache: true };

  const meal = composeMealFromCatalog(request);
  validateMeal(meal);
  saveMealVariant(meal, hash);
  mealCache.set(hash, meal);
  return { ...meal, fromCache: false };
}
```

* TTL: can be long (days/weeks) because these are deterministic meals.

---

### 6.2 Image Cache

**Keys:**

* `imageKey` for catalog images.
* `mealSignatureHash` for generated images.

Flow:

* On first use:

  * If `imageKey` exists → map to `/catalog/...`
  * If not and allowed → generate AI image, store at `/generated/meals/{hash}.jpg`

* No strict TTL on object store; these are assets.

---

### 6.3 Client Cache

* Use HTTP cache headers on images.
* Optionally cache:

  * Last N meals
  * Their image URLs
* Use localStorage / IndexedDB / Capacitor Storage for quick rehydration in builders.

---

## 7. API Structure

### 7.1 Catalog Endpoints

**GET `/api/catalog/meals`**

Query params:

* `dietProfileId?`
* `mealType?`
* `tags?`
* `limit?`
* `offset?`

Response:

```json
{
  "meals": [
    {
      "id": "breakfast_egg_scramble_veggies",
      "name": "Veggie Egg Scramble",
      "mealType": "breakfast",
      "dietProfileIds": ["general", "diabetic"],
      "macros": { "calories": 420, "protein": 35, "carbs": 25, "fat": 18 },
      "imageUrl": "https://cdn.mpm.com/catalog/meals/breakfast_egg_scramble_veggies__scrambled@1x.jpg",
      "tags": ["high_protein"]
    }
  ],
  "total": 1
}
```

---

**GET `/api/catalog/meals/:id`**

Response:

```json
{
  "mealTemplate": {
    "id": "breakfast_egg_scramble_veggies",
    "name": "Veggie Egg Scramble",
    "mealType": "breakfast",
    "dietProfileIds": ["general", "diabetic"],
    "ingredients": [
      { "ingredientId": "egg_whole", "techniqueId": "scrambled", "quantity": 3, "unit": "unit" },
      { "ingredientId": "spinach_fresh", "quantity": 1, "unit": "cup" }
    ],
    "macros": { "calories": 420, "protein": 35, "carbs": 25, "fat": 18, "fiber": 4 },
    "imageUrl": "https://cdn.mpm.com/catalog/meals/breakfast_egg_scramble_veggies__scrambled@1x.jpg",
    "tags": ["high_protein"],
    "baseInstructions": "Whisk the eggs..."
  }
}
```

---

### 7.2 Compose / Variation Endpoint

**POST `/api/meals/compose`**

Request:

```json
{
  "baseTemplateId": "breakfast_egg_scramble_veggies",
  "dietProfileId": "general",
  "substitutions": [
    {
      "fromIngredientId": "egg_whole",
      "toIngredientId": "egg_white"
    }
  ],
  "techniqueOverrides": [
    {
      "ingredientId": "potato_russet",
      "techniqueId": "baked"
    }
  ],
  "options": {
    "useAIForInstructions": true,
    "allowMacroDeviationPercent": 10
  }
}
```

Response:

```json
{
  "mealVariant": {
    "id": "mv_123",
    "baseTemplateId": "breakfast_egg_scramble_veggies",
    "source": "ai_assisted",
    "ingredients": [
      { "ingredientId": "egg_white", "techniqueId": "scrambled", "quantity": 5, "unit": "unit" },
      { "ingredientId": "spinach_fresh", "quantity": 1, "unit": "cup" }
    ],
    "macros": { "calories": 360, "protein": 38, "carbs": 20, "fat": 8, "fiber": 4 },
    "instructions": "Whisk the egg whites and scramble over medium heat...",
    "imageUrl": "https://cdn.mpm.com/catalog/meals/breakfast_egg_scramble_veggies__scrambled@1x.jpg",
    "mealSignatureHash": "msig_5f4c8f..."
  },
  "fromCache": false
}
```

---

### 7.3 Premade Endpoint

**GET `/api/meals/premade`**

Query:

* `dietProfileId`
* `mealType`
* `tags?`
* `limit?`

Response:

* List of deterministic, catalog-backed meals or variants (no AI required).

---

## 8. Implementation Roadmap

### Phase 1 – Catalog Backbone (Week 1-2)

* Implement:

  * `Ingredient`, `Technique`, `IngredientTechniqueMapping`, `MealTemplate` schemas.
* Seed:

  * ~50–100 high-priority templates across all core diet profiles.
* Build:

  * `GET /api/catalog/meals`
  * `GET /api/catalog/meals/:id`

**Output:** Builders can show complete meals **without AI**.

---

### Phase 2 – Compose Engine + Validation (Week 3-4)

* Implement `POST /api/meals/compose`:

  * Substitution logic
  * Technique overrides using `IngredientTechniqueMapping`
  * Macro recalculation
* Implement validation:

  * Ingredient validity
  * Technique validity
  * Macro deviation rules
  * Diet profile enforcement

**Output:** Safe, deterministic variations, no whack-a-mole.

---

### Phase 3 – Image System & Caching (Week 5-6)

* Implement `imageKey` resolution.
* Configure object storage structure.
* Implement:

  * `mealSignatureHash`
  * Meal cache
  * Image dedupe & reuse

**Output:** Fast, consistent images for premades & composed meals.

---

### Phase 4 – AI Layer (Controlled) (Week 7-8)

* Add AI for instructions **only**, behind a flag:

  * `useAIForInstructions`
* Add instruction validation.
* Fallback to catalog base instructions when AI fails.

**Output:** "Chef-voice" instructions without sacrificing stability.

---

### Phase 5 – Refinement & Admin Tools (Week 9-10)

* Better error messages when validation fails.
* Optional internal admin screens:

  * Review AI variants and promote to catalog templates.
* UX polish for builders:

  * Async image load
  * Clear states for "from catalog" vs "custom" vs "AI-assisted".

---

## Summary

This hybrid approach gives you:
- **Consistency**: Catalog is the source of truth
- **Speed**: Cached meals return instantly
- **Quality**: AI is controlled and validated
- **Reliability**: Fallbacks at every step
- **Scalability**: Hash-based deduplication prevents bloat
