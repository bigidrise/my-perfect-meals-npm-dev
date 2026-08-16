# Beverage Creator — Instruction Precedence Trace
**Applies to:** `BeverageCreator.tsx` and `AthleteBeverageCreator.tsx` → `/api/meals/beverage-creator`  
**Purpose:** Document the exact order of every instruction source injected into the LLM prompt, identify which ones enforce vs. suggest, and confirm what the post-generation gate actually rejects.

---

## 1. Prompt Assembly — Source Order

Both beverage creators hit the same server route. The following sources are concatenated into a single prompt in this exact order:

| Position | Source | Content | Source of truth |
|---|---|---|---|
| 1 | `beverageProtocolBlock` | Full `enforceBeforeGenerate()` output (see §2) | User's DB profile via `getActiveNutritionContext` |
| 2 | `_beverageDishDirective.adaptationBlock` | Dish Adaptation Layer — named drinks only | `getDishAdaptationDirective()` |
| 3 | `medicalBeverageBlock` | Clinical ingredient bans per active conditions | `buildBeveragePromptBlocks()` |
| 4 | `glp1CanonicalBlock` | Patient-specific GLP-1 macro ceilings | `resolveGLP1GlobalContext()` |
| 5 | `cuisineOverrideBlock` | Cultural flavor style (geographic only) | `cultureOverride` request param — optional |
| 6 | `beverageBehavioralMemorySection` | Soft preference hints from past behavior | `derivePreferenceProfile()` |
| 7 | `dietCategoryStrategy.coachingBlock` | Diet × category constraint block (e.g. keto smoothie) | `resolveDietCategoryStrategy()` |
| 8 | `softOverrideBlock` | "User explicitly chose this despite their diet" | `userDietOverride` request param — optional |
| 9 | `aceBlock` | ACE coaching context (today's check-in signals) | `buildAcePromptBlock()` |
| 10 | **CRITERIA section** | Explicit user-facing dietary requirements string | `dietaryPreferences` from **request body** |

**Position 10 is the problem.** The CRITERIA section contains:

```
- Dietary requirements: "none specified"
```

…whenever the UI dropdown was left blank. This directly contradicts Position 1, which may say `"This user follows: keto"`. The LLM receives both in the same prompt, with the CRITERIA block appearing last and in imperative form ("CRITERIA"). This creates genuine ambiguity the LLM may resolve incorrectly.

---

## 2. `enforceBeforeGenerate()` — Inner Layer Order

The `beverageProtocolBlock` at Position 1 is itself composed of sub-layers in priority order:

```
🔒 DIETARY IDENTITY — OUTERMOST RULE
   "This user follows: keto."
   Forbidden ingredients: <expandedForbidden list>

🚨 ALLERGY BLOCK — ABSOLUTE MEDICAL SAFETY
   "This user has confirmed allergies to: ..."

⚕️ MEDICAL HARD LIMITS
   "This user has: ..."
   Multi-constraint resolution rule (medical > diet identity > cuisine > preference)

Procedural rules (deriveProcedureRules — prep steps, storage, equipment)

Avoidances

Preferences
```

This layer ordering is correct and matches the intended hierarchy. The problem is that CRITERIA at Position 10 can override it.

---

## 3. Diet × Category Strategy — What Is and Is Not Covered

`resolveDietCategoryStrategy` reads `getPrimaryDiet(restrictions)` first. The priority list is:

```
["carnivore", "vegan", "vegetarian", "pescatarian", "keto", "paleo"]
```

**Kosher is not in this list.** `getPrimaryDiet(["kosher"])` returns `null`. As a result:

- `resolveDietCategoryStrategy` → `conflictLevel: 'none'` for ALL categories
- No caution blocks injected for any kosher + category combination
- No redirect logic fires (e.g. kosher + cocktail with wine → no intervention)

**Keto is in the list.** What keto covers and misses:

| Category | Handling | Coaching block injected? |
|---|---|---|
| `milkshake` | **REDIRECT** → `protein-shake` | Yes — redirect framing |
| `smoothie` | CAUTION | Yes — low-sugar fruits, no banana/mango |
| `frozen` | CAUTION | Yes — no syrups, use heavy cream |
| `cocktail` | CAUTION | Yes — no sugary mixers |
| `mocktail` | CAUTION | Yes — no syrup/honey |
| `protein-shake` | **none** | ❌ No constraint block at all |
| `coffee` | **none** | ❌ No constraint block at all |
| `tea` | **none** | ❌ No constraint block at all |
| `hydration` | **none** | ❌ No constraint block at all |

A keto user ordering a protein shake, coffee, or hydration drink gets no caution coaching block injected — only the protocol block at Position 1.

---

## 4. Post-Generation Validation Gate — What Actually Blocks

`scanGeneratedOutput` is the hard gate. It calls `scanForHiddenDietaryViolations` and `scanInstructionsForViolations`. When it returns `passed: false`, the route **retries up to 3 times then returns HTTP 400** — this is a genuine reject, not a de-badge.

### Keto post-gen coverage

**Checked (via `RESTRICTION_EXPANSION["keto"]`):**
Grains (pasta, rice, bread, tortilla, corn, oats, quinoa, barley...), sugars (sugar, honey, maple syrup, agave, molasses...), starchy vegetables (potato, sweet potato, beet...), legumes (beans, chickpeas, lentils...), fruit juice (orange juice, apple juice, soda...).

**Not checked — coverage gaps:**
- Whole high-carb fruits: banana, mango, apple, pineapple, grapes, dates. None appear in `RESTRICTION_EXPANSION["keto"]`. A keto "strawberry banana smoothie" passes the validator even though a banana has ~27g net carbs. The CAUTION block for smoothie does say "no banana" in the prompt — but this is guidance only, not a validator gate.
- Carb quantity: the validator checks ingredient *names*, not macro totals. A keto-labeled drink with 45g of carbs from "allowed" berries + coconut water would pass the ingredient scan.

### Kosher post-gen coverage

**Checked (KOSHER_HIDDEN_TERMS — 14 derivative terms):**
Gelatin, lard, suet, pork fat, schmaltz, shrimp paste, fish sauce, oyster sauce, clam juice, lobster base, crab base, shellfish broth, seafood stock, worcestershire, caesar dressing.

**Checked (RESTRICTION_EXPANSION["kosher"] — 10 obvious items):**
Pork, bacon, ham, prosciutto, pancetta, lard, shellfish, shrimp, crab, lobster, scallop, clam, oyster, mussel, squid, octopus.

**Checked (detectMeatDairyMixing):**
Meat + dairy combination in the same output — fires as a hard violation unless `skipAdaptableConflicts` is true.

**Not checked — coverage gaps:**
- Non-kosher wine: if the LLM generates a mocktail with "red wine" for a kosher user, "wine" is not in any kosher forbidden list. The KOSHER_HIDDEN_TERMS do not include "wine" or "beer".
- Non-kosher gelatin (already partially covered by HIDDEN_TERMS) vs. certified kosher gelatin — no way to distinguish at this layer.
- Ingredient certification: the system cannot verify whether "chicken" or "beef" used in a drink is kosher-certified. It can only block the obvious non-kosher species.
- Mixing kosher meat with dairy: `detectMeatDairyMixing` covers the *combination* but not the certification status of each.

### The validator does NOT de-badge for keto/kosher

Separately, `buildDietClassification` → `validateDietConsistency` controls the diet label badge. These run AFTER the scan passes. The badge can be nulled if the generated drink doesn't cleanly match the diet profile — but this is purely a UI labeling decision and does not cause a retry or rejection. The scan gate and the badge are fully independent.

---

## 5. Athletic Beverage Creator — Specific Conflict

`AthleteBeverageCreator.tsx` builds `customBeverageDescription` as a structured performance string:

```
Performance goal: endurance.
Drink format: performance drink.
Nutrition targets: carbs 40–80g, high electrolytes, light protein 10–15g, easy on the stomach.
Build a homemade version of a market-style performance drink...
```

This string becomes the highest-priority input in the CRITERIA section:
```
- User's custom beverage idea: "<full performance string>" (this takes FULL priority)
```

**The conflict:** For a keto user (profile says `dietaryIdentity: ["keto"]`), this produces:

| Instruction | Says |
|---|---|
| Position 1 (protocol block) | "This user follows: keto. Forbidden: sugar, honey, oats, rice..." |
| Position 7 (caution block) | None — custom description bypasses `beverageCategory` lookup |
| Position 10 CRITERIA (custom desc) | "carbs 40–80g" — **takes FULL priority** |

The LLM must resolve "carbs 40–80g (full priority)" against "forbidden: sugar, honey, fruit juice" from the protocol block. The path of least resistance is to use ingredients not in the forbidden list (coconut water, banana, dates, fruit) that provide carbs via natural sugar, producing a non-keto drink that passes the ingredient validator because banana/dates are not in `RESTRICTION_EXPANSION["keto"]`.

The macro target number does not trigger the post-gen validator at all — it scans ingredient *names*, not carb gram totals.

---

## 6. What the Contract Should Look Like

The advisor's expected contract:

> **The user tells My Perfect Meals what kind of drink they want. Their active health and dietary guardrails determine how My Perfect Meals is allowed to make it. Performance and cuisine customize the beverage; they do not silently erase higher-priority guardrails.**

Current state mapped to that contract:

| Contract requirement | Current state |
|---|---|
| Dietary identity is invariant | **Partially enforced.** Protocol block at Position 1 is correct. But CRITERIA at Position 10 can contradict it with "none specified." |
| Post-gen gate rejects identity violations | **Mostly enforced for explicit ingredient names.** Whole-fruit carb sources for keto and wine for kosher slip through the scan. |
| Performance targets customize, don't override | **Not enforced.** Athletic macro targets appear as "full priority" in CRITERIA, directly competing with dietary identity. |
| Kosher = procedural constraint, not cuisine | **Not enforced.** Kosher is absent from `getPrimaryDiet` / `resolveDietCategoryStrategy` entirely. |
| Keto + protein-shake gets diet-aware coaching block | **Not enforced.** Only milkshake/smoothie/frozen/cocktail/mocktail get caution blocks. |

---

## 7. Repair Scope (for planning)

This is a trace document, not a fix. The repairs required fall into four areas:

**A — Prompt contradiction (affects both creators, all diets)**  
The `dietaryRules` string in CRITERIA must come from the user's stored dietary identity, not from the request body alone. The body supplements it; the profile sets the invariant floor.

**B — Athletic macro conflict resolution (Athletic Beverage only)**  
When the user has an active dietary identity, the performance macro targets must be annotated as suggestions bounded by the diet. Example: "Target carbs 40–80g from keto-compatible sources (berries, coconut water) — no grains, sugar, or high-glycemic fruit." The macro number does not override the identity; the identity constrains how the macro is met.

**C — Kosher in diet strategy layer (affects both creators)**  
Kosher needs entries in `resolveDietCategoryStrategy` — at minimum, a caution block for cocktail (wine-containing) and a redirect or caution for any category that typically uses non-kosher bases. Separately, "wine" and "beer" should be added to the kosher post-gen validator.

**D — Keto fruit coverage in validator (affects both creators)**  
Whole high-carb fruits (banana, mango, apple, pineapple, grapes, dates) should be added to `RESTRICTION_EXPANSION["keto"]` or to a dedicated keto CAUTION hidden terms list. The smoothie caution prompt already warns against them — the validator should back that up.
