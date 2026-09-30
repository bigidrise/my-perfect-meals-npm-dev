---
name: Dish Adaptation Layer
description: Identity-preserving meal generation — DAL directive, substitution map, identity validator; how they wire into craving-creator.
---

# Dish Adaptation Layer (Phases 2–4 shipped)

Architecture authority: `docs/dish-adaptation-layer/ARCHITECTURE.md`.

**Rule:** protocol compliance may change ingredients/prep/portion, never the requested dish. If the dish can't be made compliant, return HTTP 400 `dishIdentityFailure: true` naming the conflicts — never a silent generic plate.

Key design decisions (non-obvious):
- **No hardcoded dish tables.** Dish decomposition comes from one gpt-4o-mini call (temp 0, max_tokens 200, JSON); substitutions come from `shared/dishAdaptation/guardrailSubstitutionMap.ts`, which is *extracted* from existing prompt builders (each profile cites its source file). When a builder's substitution text changes, the map must be updated in lockstep.
- **LRU cache is mandatory** (`dishAdaptationCache.ts`, max 500 / 24h TTL, key = hash(dish + sorted guardrail IDs)). The cache stores the decomposition + conflicts core; the adaptationBlock is re-rendered per callContext, so first_pass and fallback share one LLM call. Fallback rendering appends the explicit "DO NOT return a generic protein plate" line — fallback prompts must be MORE specific than first pass, never less.
- **Identity validator is rule-based, no LLM** (`dishIdentityValidator.ts`): name-token match + defining-component keyword presence. Catastrophic = zero name relation AND <1/3 defining components. Only catastrophic deviations are filtered in `filterMealsByProtocol` (via `context.dishIdentity`); weak matches are logged but kept to avoid over-filtering renamed-but-valid dishes ("Cajun Cauliflower Rice Stew").
- **Functional-role bias:** role-tagged substitution rules win over generic ones for the same component. A functional role must only be attached to rules whose every blocked ingredient actually performs it (split multi-ingredient rules), and roleRequirement text must never unconditionally name an ingredient another guardrail could block — list universally compliant options first, condition the rest ("egg only where eggs are permitted").
- **Allergen structural rules:** a dairy or egg ALLERGY (not just vegan identity) now gets role-aware binder/setter substitution via `ALLERGEN_STRUCTURAL_RULES` in the shared map; in `resolveConflicts` these win over the generic `ALLERGEN_SUBSTITUTES` string for a matching component. Lookup is by exact lowercase allergen key (aliases: milk/cheese→dairy, eggs→egg) — free-text allergen phrasings like "dairy (milk)" bypass it.
- **Override continuity:** overridden allergens are excluded from `GuardrailContext.activeAllergens`, so the DAL never directs substituting an ingredient the user authenticated-unlocked.
- DAL failure (decomposition error) returns null and generation proceeds unenriched — the identity validator downstream still blocks silent substitution.

Proof matrix: `scripts/proof-dish-adaptation.ts` (7 scenarios + cache proof, live gpt-4o-mini; 35 assertions).

Remaining phases (not shipped): Phase 5 (DAL on dessert/beverage/kids/restaurant/GLP-1 surfaces), Phase 6 (override threading on all surfaces).

## Physical-form gate (dish-form collapse)
The identity validator rejects a dish that keeps its name but arrives in a different physical format (cheesecake → parfait/bowl/mousse, stew → soup) — form mismatch is catastrophic even when name and defining components pass.
**Why:** a model that can't solve a constraint escapes by converting the dish to another format while keeping the name.
**How to apply:** form is judged from the generated meal's NAME only (descriptions/instructions legitimately mention "mixing bowl", bread, etc.), and a free-form dishForm string contributes only ONE primary allowed family — structural descriptors like "broth-based" must never whitelist a different presentation.

**Rule:** A person-authorized vessel adaptation can preserve a prepared dish even when its default physical form changes; the permission must come from resolved person context and a changeable vessel in the dish contract, never the generated title. The finished recipe must independently prove its defining structure and pass all food protections.
**Why:** A low-carb burger bowl or lettuce wrap can fulfill a burger request without a bun, while a merely renamed unrelated bowl must still fail. Gluten-free bread is not necessarily low-carb.
**How to apply:** Keep the default physical-form rejection for other requests. For an authorized adaptation, test structured core and serving-vessel evidence separately; do not relax allergy, clinical, nutrition, or final-release validation. Do not infer permission from a user-selected form or generated name.

## Candidate-derived identity evidence
**Rule:** cuisine, flavor, and identity evidence must describe the generated candidate; never copy the requested context into candidate evidence as a fallback.

**Why:** request-derived evidence lets a recipe prove its own compliance without actually expressing the requested cuisine, while plant-based compound names can be falsely rejected if validators treat words such as “milk” or “cream” as standalone animal products.

**How to apply:** generators emit structured evidence from the finished recipe, normalizers preserve it, and final validators compare it with authoritative request context. Missing explicit-request evidence requires review; mismatches are repairable. Recognized plant compounds prevent deterministic substring false positives, but actual animal ingredients remain blocked.

**Confirmed product expectation:** when a choice surface hands a selected concept into full generation, the completed meal may adapt ingredients for governance but must remain recognizably different from other choices and preserve the selected cuisine. Users notice and value both properties.

## Pre-generation food intent
**Rule:** raw dish requests describe food identity, not verified ingredients; compound concepts must be interpreted before dietary token matching.

**Why:** a preflight scan can reject a feasible transformation before structured generation and final validation ever run—for example, treating “cream” inside “vegan ice cream” as dairy evidence.

**How to apply:** share semantic compound normalization between client and server preflight checks. Preserve term-specific allergy detection, then validate actual animal products from generated structured ingredients.

## Selected-concept ingredient specificity

**Rule:** A choice card's defining-ingredient list must contain concrete ingredients if selection requires those foods in the final structured recipe. Reject abstract roles before offering the card; compare concrete names using only bounded grammatical variants in structured ingredients, not arbitrary substrings or recipe prose.

**Why:** A recipe can preserve the intended dish yet fail literal selected-card matching after both initial generation and targeted repair because an abstract concept phrase cannot naturally appear as a recipe ingredient.

**How to apply:** Make concept-generation output concrete before the user selects a card. A plural-to-singular wording change can still verify the same food, but a flavored product, a missing component, or an unauthorized substitute cannot. Do not weaken the dish-identity validator or invent unreviewed equivalences merely to make a selection pass.
