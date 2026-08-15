# Dish Adaptation Layer — Architecture

**Status:** Design only. No implementation until approved.  
**Scope:** Every active meal and food generation surface.  
**Core principle:** Protocol compliance may change ingredients, preparation, portioning, or accompaniments. It may never silently change the requested dish into a different meal.

---

## The Problem

The current generation pipeline is:

```
user requests dish → generate (dish + guardrails in prompt) → validate protocol → fallback if fails → return
```

The fallback is weaker than the first pass. It strips the dish-variation context and retries with only the raw constraints. OpenAI sees a dish that traditionally requires blocked ingredients plus a list of things it can't use, concludes the dish is impossible, and generates something safe and generic. That is dish-identity collapse.

The fallback should be **more specific**, not less.

---

## The Architecture

### New layer between intent and generation:

```
user requests dish
    ↓
[Dish Adaptation Layer]
    ↓  identifies identity-preserving components
    ↓  identifies adaptable components  
    ↓  maps user's active guardrails against adaptable components
    ↓  produces: identity anchor + explicit adaptation directives
    ↓
[Generation] (receives enriched prompt — same on first pass and fallback)
    ↓
[Protocol Validator] (existing — does this comply with user's constraints?)
    ↓
[Dish Identity Validator] (new — is this still the dish they asked for?)
    ↓
return or retry with tighter directives
```

---

## Component 1: Dish Adaptation Layer (DAL)

**Location:** `server/services/dishAdaptation/dishAdaptationLayer.ts`  
**Called by:** Every prompt-building function that receives a named dish or craving input.

### Inputs
- `requestedDish: string` — the user's requested dish ("gumbo", "lasagna", "mac and cheese")
- `activeGuardrails: GuardrailContext` — compiled from the user's medical profile, dietary identity, allergies, overrides, GLP-1 status, macros, blood glucose, etc.
- `callContext: 'first_pass' | 'fallback'` — fallback gets more directive language

### What it produces
A `DishAdaptationDirective` object:

```typescript
interface DishAdaptationDirective {
  identityAnchor: string;         // "This IS gumbo. Do not change the dish."
  definingComponents: string[];   // ["Cajun/Creole stew format", "thickened broth", "protein/seafood", "aromatics"]
  adaptableComponents: string[];  // ["rice base", "roux method", "fat content", "sodium level"]
  conflicts: ConflictResolution[]; // each conflict mapped to an explicit directive
  adaptationBlock: string;        // the full text block injected into the prompt
}

interface ConflictResolution {
  component: string;              // "rice base"
  guardrail: string;             // "diabetic: no white rice"
  directive: string;             // "Use cauliflower rice. The dish is still gumbo."
}
```

### How it works — no hardcoded dish table

The DAL does NOT maintain a lookup table of `gumbo → cauliflower rice`. That does not scale.

Instead it uses the **existing guardrail substitution intelligence** as a library:

1. Each guardrail builder (`diabeticPromptBuilder`, `glp1PromptBuilder`, `antiInflammatoryBuilder`, etc.) already knows what substitutes for what. The DAL reads those substitution maps as structured data — not as prompt text — and matches them against the dish's components.

2. For dish decomposition, the DAL makes a **single fast LLM call** (model: `gpt-4o-mini`, temperature 0, max_tokens 200) with this prompt:

```
You are a culinary analyst. For the dish "{requestedDish}", identify:
1. The 3-5 components that define its identity (changing these makes it a different dish)
2. The 3-5 components that can be adapted without losing the dish identity

Return JSON only:
{
  "definingComponents": ["..."],
  "adaptableComponents": ["..."]
}
```

This is a structured reasoning call, not a generation call. It runs once per unique dish per guardrail session and is cacheable by `(dishName, guardrailProfile)` hash.

3. The DAL then cross-references adaptable components against the guardrail substitution maps to produce explicit directives.

### Adaption block format injected into the generation prompt

```
DISH IDENTITY — DO NOT CHANGE THE DISH:
The user has asked for: GUMBO
This is a Cajun/Creole stew with thickened broth, aromatics, and protein/seafood.
These components define the dish and must be preserved.
You are adapting gumbo — not replacing it.

REQUIRED ADAPTATIONS for this user's profile:
- Rice base → Use cauliflower rice. The dish remains gumbo.
- Flour roux → Use okra as thickener, or a small amount of file powder. The dish remains gumbo.
- Sodium → Use low-sodium stock; do not add table salt.

WHAT MAKES THIS STILL GUMBO:
Cajun/Creole seasoning profile, stew consistency, protein and vegetable in thickened broth, served over the adapted rice base.

DO NOT return tilapia with green beans. DO NOT return a generic protein plate. Return gumbo.
```

The final line is added only on `callContext: 'fallback'` — it is explicit about what failure looks like.

---

## Component 2: Dish Identity Validator

**Location:** `server/services/dishAdaptation/dishIdentityValidator.ts`  
**Called by:** Every post-generation validation step, alongside the existing protocol validator.

### What it checks

Given the requested dish and the generated meal result, it asks:

1. **Name check** — is the generated meal name still recognizably the requested dish? (substring match, or semantic match via embedding comparison for renamed versions like "Cajun Cauliflower Rice Stew")
2. **Defining component check** — do the generated ingredients include representatives of the defining components identified by the DAL?
3. **Catastrophic deviation check** — is the generated meal from a completely different culinary category? (gumbo → tilapia with vegetables = catastrophic)

### Implementation approach

Fast rule-based checks first (name check, component presence). Only if those fail is a secondary LLM validation call made. On fallback retry, catastrophic deviation check is always run.

### Return value

```typescript
interface DishIdentityResult {
  passed: boolean;
  score: number;             // 0-1, 1 = exact identity preserved
  failures: string[];        // e.g. ["no thickened broth found in ingredients"]
  catastrophicDeviation: boolean; // true = completely wrong dish
}
```

If `catastrophicDeviation: true`, the generation is retried with an even more explicit adaptation directive — NOT returned to the user and NOT used as a fallback.

---

## Component 3: Override Continuity Fix

The existing `_overriddenAllergens` is correctly extracted and passed to first-pass generation and to `filterMealsByProtocol`. It is dropped in three places:

### Gap A — `generateSingleCompliantFallback` (routes.ts:5194)
```
// Current:
const fallbackMeal = await generateSingleCompliantFallback(...)
// Must become:
const fallbackMeal = await generateSingleCompliantFallback(..., { overriddenAllergens: _overriddenAllergens })
```
The fallback function signature and its internal prompt must:
1. Accept `overriddenAllergens`
2. Remove the overridden allergen from its allergy block (same logic as first pass)
3. NOT say "avoid shellfish" when shellfish was authenticated-overridden

### Gap B — Dessert Creator (server/routes/dessert-creator.ts)
Captures `overrideToken` → calls `enforceSafetyProfile` → does not read `safetyCheck.overriddenAllergen`. Its post-generation scan at lines 394-398 omits `overriddenAllergens`. Fix: capture and thread through.

### Gap C — Beverage Creator (server/routes/beverage-creator.ts)
Same pattern as dessert creator. Lines 137-143 validate the token but the returned allergen is not captured. Post-gen scan at 559-563 omits it.

### Gap D — Fridge Rescue, ai-pairings, chef-pairings, Grocery Coach
None of these thread an override allergen through to their protocol scans or any retry/fallback generation. These need the same capture-and-thread pattern applied.

---

## Affected Files — Full Map

### New files to create
| File | Purpose |
|------|---------|
| `server/services/dishAdaptation/dishAdaptationLayer.ts` | Core DAL — decompose dish, resolve conflicts, produce adaptation directive |
| `server/services/dishAdaptation/dishIdentityValidator.ts` | Post-generation identity check |
| `server/services/dishAdaptation/dishAdaptationCache.ts` | LRU cache for `(dishName, guardrailHash) → DishAdaptationDirective` |
| `server/services/dishAdaptation/types.ts` | Shared types |
| `shared/dishAdaptation/guardrailSubstitutionMap.ts` | Structured substitution data extracted from existing prompt builders |

### Files to modify
| File | Change |
|------|--------|
| `server/services/unifiedMealPipeline.ts` | `generateCravingMealOptions` and `generateSingleCompliantFallback` receive and use DAL output; fallback receives `overriddenAllergens` |
| `server/services/protocolEnvelope.ts` | `filterMealsByProtocol` calls dish identity validator after protocol check |
| `server/routes.ts` (craving-creator route) | Pass `_overriddenAllergens` to `generateSingleCompliantFallback` |
| `server/routes/dessert-creator.ts` | Capture `overriddenAllergen`, thread to post-gen scan and any fallback |
| `server/routes/beverage-creator.ts` | Same as dessert creator |
| `server/routes/fridge-rescue.ts` | Thread override through any protocol scan |
| `server/routes/ai-pairings.ts` | Thread override through scan |
| `server/routes/chef-pairings.ts` | Thread override through scan |
| `server/routes/groceryCoach.ts` | Thread override through retry/scan |
| `server/services/guardrails/prompt/diabeticPromptBuilder.ts` | Export substitution map as structured data (not just prompt text) |
| `server/services/guardrails/prompt/glp1PromptBuilder.ts` | Same |
| `server/services/guardrails/prompt/antiInflammatoryBuilder.ts` | Same (if exists) |
| All other guardrail prompt builders | Same pattern |

---

## How Fallback Changes

| | Current | After DAL |
|--|---------|-----------|
| Fallback prompt | "The meal must be: gumbo" + blocked ingredients | DAL adaptation directive (more specific, not less) + "this is gumbo, here is exactly how to make it compliant" |
| Override in fallback | Not passed | Passed, allergy block filtered same as first pass |
| Identity check | None | Dish identity validator runs on fallback output; catastrophic deviation triggers another retry, not a return |
| Result on total failure | HTTP 400 AVOIDANCE_VIOLATION_ALL_OPTIONS | HTTP 400 with `dishIdentityFailure: true` and a user-facing message: "We couldn't find a way to make [dish] within your current constraints — try adjusting your safety settings" |

---

## Proof Scenarios

### 1. Gumbo + diabetic guardrails

```
requested dish: gumbo
guardrail: diabetic (carbs 20-35g, blocked: white rice, white flour, sugars)

DAL decomposition:
  definingComponents: ["Cajun/Creole stew format", "thickened broth", "protein/seafood", "trinity aromatics", "characteristic seasoning"]
  adaptableComponents: ["rice base", "roux thickener", "fat content", "sodium level", "protein selection"]

conflict resolution:
  rice base ← diabetic blocks white rice → cauliflower rice
  roux ← diabetic blocks white flour → okra + file powder thickener

adaptation directive injected:
  "This IS gumbo. Preserve: stew format, Cajun seasoning, thickened broth, protein, aromatics.
   Adapt: rice base → cauliflower rice. Roux → okra thickener. Fat → reduce oil. Sodium → low-sodium stock.
   Return gumbo. Not a different dish."

expected path:
  requested dish → DAL → enriched prompt → generation produces cauliflower rice gumbo → protocol PASS (carbs compliant) → dish-identity PASS (thickened broth, Cajun profile, protein present) → ✓
```

### 2. Gumbo + diabetic + shellfish override + shrimp allergy overridden + peanut allergy still active

```
requested dish: gumbo with shrimp
guardrail: diabetic
override: shellfish/shrimp authenticated

DAL: same as above + shrimp as protein selection (allowed, override active)
allergyBlock: peanuts present, shrimp removed (override active)
fallback (if needed): also receives overriddenAllergens: ["shrimp"]

expected path:
  → gumbo with shrimp generated, cauliflower rice, okra thickener
  → protocol PASS
  → dish-identity PASS
  → shrimp NOT in allergyBlock (override respected in generation + fallback + scan)
  → peanuts still blocked ✓
```

### 3. Lasagna + diabetic

```
DAL decomposition:
  definingComponents: ["layered baked Italian dish", "tomato/meat sauce profile", "cheese layer", "baked structure"]
  adaptableComponents: ["pasta sheets", "cheese type", "portion size", "fat content"]

conflict resolution:
  pasta sheets ← diabetic blocks regular pasta → zucchini sheets or eggplant slices
  portion size ← macro targets → single serving with defined carb budget

adaptation directive:
  "This IS lasagna. Layered, baked, Italian tomato/meat/cheese profile.
   Adapt: pasta → zucchini or eggplant sheets. Portion → single serving ~25g carbs.
   Return lasagna. Not a protein bowl."

expected path: zucchini lasagna → protocol PASS → dish-identity PASS ✓
```

### 4. Mac and cheese + GLP-1

```
DAL decomposition:
  definingComponents: ["creamy cheese sauce", "pasta-format base", "comfort food texture"]
  adaptableComponents: ["pasta type", "cheese fat content", "portion size", "cream base"]

conflict resolution:
  pasta ← GLP-1 portion restriction → small portion high-protein pasta or cauliflower
  cream base ← GLP-1 fat sensitivity → reduced-fat cheese sauce, Greek yogurt base

adaptation directive:
  "This IS mac and cheese. Creamy, cheesy, pasta-format.
   Adapt: pasta → small portion chickpea or cauliflower base. Sauce → reduced-fat cheese with Greek yogurt.
   Return mac and cheese. Not a side salad."

expected path: GLP-1 compliant mac and cheese → PASS both validators ✓
```

### 5. Fried rice + diabetic

```
DAL decomposition:
  definingComponents: ["stir-fried, wok-cooked", "rice-format base", "egg + protein + vegetable mix", "umami/soy seasoning"]
  adaptableComponents: ["rice base", "oil amount", "sodium", "protein selection"]

conflict resolution:
  rice base ← diabetic blocks white/jasmine rice → cauliflower rice
  sodium ← diabetic cardiovascular → low-sodium soy or coconut aminos

adaptation directive:
  "This IS fried rice. Stir-fried, egg/protein/vegetable combination, umami seasoning.
   Adapt: rice → cauliflower rice. Sodium → coconut aminos. Oil → minimal.
   Return fried rice. Not a stir-fry without rice."

expected path: cauliflower fried rice → PASS ✓
```

### 6. Pasta dish + gluten allergy

```
DAL decomposition:
  definingComponents: ["pasta format", "sauce profile", "Italian culinary identity"]
  adaptableComponents: ["pasta type (wheat)"]

conflict resolution:
  pasta ← gluten allergy blocks wheat → rice pasta, chickpea pasta, or lentil pasta

adaptation directive:
  "This IS pasta. Italian sauce profile, pasta format.
   Adapt: pasta → certified gluten-free rice pasta or chickpea pasta.
   Return pasta. Not rice and vegetables."

expected path: gluten-free pasta → PASS ✓
```

### 7. Traditional dessert (bread pudding) + lower-sugar constraint

```
DAL decomposition:
  definingComponents: ["baked bread-based custard", "warm dessert format", "vanilla/cinnamon profile"]
  adaptableComponents: ["bread type", "sugar content", "cream base", "portion size"]

conflict resolution:
  sugar ← diabetic/GLP-1 → monk fruit or erythritol, reduce quantity
  bread ← diabetic blocks white flour → low-carb or almond flour bread base
  cream ← GLP-1 fat sensitivity → reduced cream, more egg-custard ratio

adaptation directive:
  "This IS bread pudding. Baked, custard-soaked, warm dessert.
   Adapt: bread → low-carb base. Sugar → monk fruit. Cream → reduced.
   Return bread pudding. Not fruit salad."

expected path: low-sugar bread pudding → PASS ✓
```

---

## Surfaces Coverage

| Surface | Has dish identity | Gets DAL | Gets identity validator | Override threaded |
|---------|-------------------|----------|------------------------|-------------------|
| Craving Creator (primary) | Partial (variety prompt anti-drift) | ✓ after | ✓ after | First pass ✓, fallback ✗ → fix |
| Craving Creator (fallback) | ✗ | ✓ after | ✓ after | ✗ → fix |
| Dessert Creator | Partial | ✓ after | ✓ after | ✗ → fix |
| Beverage Creator | Partial | ✓ after | ✓ after | ✗ → fix |
| Fridge Rescue | ✗ (ingredient-based, no dish name) | N/A — no named dish | N/A | ✗ → fix |
| Kids Builder | Partial | ✓ after | ✓ after | Not applicable (no override) |
| Grocery Coach | ✗ (product-based) | N/A | N/A | ✗ → fix |
| Restaurant Finder | Unclear | ✓ after | ✓ after | Review |
| Recipe Scan | N/A (reads recipe, not generates) | N/A | N/A | N/A |
| GLP-1 hub generation | Varies by path | ✓ after | ✓ after | Review |
| Weekly board / planning | Varies by path | ✓ after | ✓ after | Review |
| Barcode scanner | N/A (lookup, not generation) | N/A | N/A | N/A |
| ai-pairings / chef-pairings | Partial | ✓ after | ✓ after | ✗ → fix |

---

## Implementation Order

This is design only. When approved, implementation should be sequenced:

1. **Phase 1 — Override continuity (code only, no new architecture)**
   Pass `_overriddenAllergens` to `generateSingleCompliantFallback`. Fix dessert-creator and beverage-creator capture/thread. This is isolated and unblocks the override feature that already shipped.

2. **Phase 2 — Guardrail substitution map extraction**
   Export substitution data from existing prompt builders as structured data. No prompt changes yet.

3. **Phase 3 — Dish Adaptation Layer**
   Build the DAL with the fast LLM decomposition call + conflict resolver + adaptation directive generator. Wire into craving-creator first (the highest-impact surface).

4. **Phase 4 — Dish Identity Validator**
   Build the validator. Wire into `filterMealsByProtocol` so it runs alongside protocol validation on every surface.

5. **Phase 5 — Remaining surfaces**
   Apply DAL + identity validator to dessert creator, beverage creator, kids builder, restaurant finder, GLP-1 generation paths.

6. **Phase 6 — Override continuity on all surfaces**
   Apply the capture-and-thread pattern to all remaining surfaces (grocery coach, pairings, fridge rescue where applicable).

---

## What This Does Not Change

- Protocol validation (the existing guardrail system). DAL enriches prompts; it does not relax constraints.
- Allergy blocking. Override continuity ensures the override travels correctly — it does not weaken allergy enforcement.
- Safety PIN system. Override token flow is unchanged; only the downstream threading is fixed.
- The blocked ingredients lists in any guardrail builder. Those remain the authority on what cannot be in a meal.

---

## The Test That Passes When This Is Done

User asks for gumbo. User is diabetic. User has authenticated shellfish override.

System returns: a Cajun stew with shrimp, cauliflower rice, okra-thickened broth, trinity aromatics, Cajun seasoning, compliant macros, no white rice, no flour roux, no peanuts (still blocked), shrimp present (override respected).

Name on the card: **Diabetic-Friendly Cajun Gumbo**.

Not tilapia with green beans.
