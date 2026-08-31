# Whole-Food Standard Coverage Matrix

**Policy version:** `wfs-v1`  
**Verification date:** 2026-08-30  
**Release rule:** Any active human food, beverage, restaurant, grocery, nutrition-product, fallback, catalog, cache, or assistant recommendation path without the central policy is a blocker for the claim “Better ingredients. Built into every recommendation.”

## Governing contract

All covered surfaces use `server/services/wholeFoodStandard.ts` directly or through the canonical protocol/guardrail boundary.

Classification:

1. Preferred
2. Appropriate
3. Substitute when practical
4. Purposeful exception
5. Uncertain

Precedence:

1. Immediate clinical and safety requirements
2. Allergies and intolerances
3. Authorized medical nutrition requirements
4. Dietary identity
5. Performance and special-population requirements
6. Whole-Food Standard
7. Macro and calorie objectives
8. Explicit avoidances
9. Learned preferences
10. Convenience and variety

`Uncertain` never becomes an invented processing claim. A purposeful processed-product exception requires a matching clinical, hypoglycemia, performance, accessibility, inadequate-intake, or clinician-directed context. Learned preferences may rank policy-compatible options but cannot authorize a substitution violation.

## Active recommendation surfaces

| Surface | Central policy applied | Pre-generation / selection | Post-generation validation | Fallback covered | Uncertainty handling | Applicable exceptions tested | Result |
|---|---|---|---|---|---|---|---|
| Core meal generation and Create With Chef | Yes, through protocol envelope and guardrails | Yes | Yes | Yes | Yes | Yes | **PASS** |
| Weekly Meal Board and immediate templates | Yes | Yes, at generation or deterministic selection | Yes | Yes | Yes | Conservative when no purpose is known | **PASS** |
| Craving Creator | Yes, active unified path and mounted legacy adapter | Yes | Yes | Yes | Yes | Yes | **PASS** |
| Snack Creator | Yes | Yes | Yes | Yes | Yes | Yes | **PASS** |
| Beverage Creator | Yes | Yes | Yes | Yes | Yes | Clinical/performance context | **PASS** |
| Dessert Creator | Yes | Yes | Yes | Yes | Yes | Yes | **PASS** |
| Fridge Rescue | Yes through protocol-aware generation and unified validation | Yes | Yes | Yes | Yes | Yes | **PASS** |
| Clinical and specialized meal builders | Yes through canonical protocol and diet guardrails | Yes | Yes | Yes | Yes | Clinical precedence preserved | **PASS** |
| Performance meal recommendations and performance coach | Yes | Yes | Yes, including macro validation | Yes | Yes | Performance fuel | **PASS** |
| Stable meal catalog | Yes | Yes, deterministic candidate filtering | Yes | Yes | Yes | No purpose is assumed | **PASS** |
| Universal/legacy meal generator | Yes | Yes | Yes | Explicit failure or compliant deterministic fallback | Yes | Matching purpose only | **PASS** |
| Persistent meal cache reads and writes | Yes at the cache boundary | Yes, before persistence | Yes, on memory and database reads | Yes | Yes | No silent exception | **PASS** |
| Deterministic fallback service | Yes | Yes | Yes | Yes | Yes | No purpose is assumed | **PASS** |
| Restaurant Guide, verified menu | Yes | Yes, verified-item selection only | Yes | No menu invention when selection is empty | Explicit processing uncertainty | Clinical context | **PASS** |
| Restaurant Guide AI-estimated fallback and Fast Food Guide | Yes | Yes | Yes | Repair, retry, substitution, then filtering | Clearly disclosed as estimated | Clinical/diabetic context | **PASS** |
| Meal Finder | Yes | Yes | Yes at final output boundary | Yes | Yes | Yes | **PASS** |
| Buffet recommendations | Yes, with protocol envelope | Yes, limited to supplied foods | Yes | Fails closed if no safe plate remains | Unverified preparation is disclosed | Clinical/diabetic context | **PASS** |
| Getaway and venue coach | Yes, with protocol envelope | Yes | Yes for each returned choice | Fails explicitly if no safe choice remains | Venue/menu knowledge is labeled unverified | Clinical context only when present | **PASS** |
| Grocery Coach meal recommendations | Yes | Yes | Yes, including retry candidates | Yes | Yes | GLP-1/diabetic context | **PASS** |
| Grocery ingredient swaps and saved alternatives | Yes | Yes | Yes for primary, alternatives, and saved option | Rejects invalid or cross-role substitutions | Yes | Clinical context | **PASS** |
| Grocery product/cart advisor | Yes | Yes | Yes for every returned product | Explicit unavailable response if all are rejected | Missing verified label is disclosed | Purpose-gated nutrition products | **PASS** |
| Barcode product scan | Yes | Yes after verified resolution | Yes | Unresolved barcode returns an explicit unresolved response; raw barcode is never analyzed as a product | Explicit | Purpose-gated | **PASS** |
| Product-name scan | Yes | Yes | Yes | Low-confidence response instead of fabricated certainty | Explicit “not a verified label” disclosure | Purpose-gated | **PASS** |
| Full-label product and supplement scan | Yes | Yes | Yes | Explicit low-confidence handling | Uses available complete-label evidence | Purpose-gated | **PASS** |
| Chef conversational food advice | Yes | Yes | Yes | One corrective retry, then explicit refusal | Yes | No purpose is assumed | **PASS** |
| Copilot, legacy and modern | Yes | Yes | Yes | Modern-to-legacy safe fallback; explicit refusal if needed | Yes | No unjustified exception | **PASS** |
| Voice meal command | Delegates to guarded Craving Creator | N/A: navigation only | Destination validates | Destination handles | Destination handles | Destination handles | **PASS** |
| Pregnancy coach food replies and actions | Yes | Yes | Yes | Unsafe action removed; unsafe reply fails explicitly | Yes | Clinical/pregnancy context | **PASS** |
| Coach Corner food advice and builder actions | Yes | Yes | Yes | Safe refusal; action destinations are independently guarded | Yes | Downstream context preserved | **PASS** |
| Holiday Feast | Yes | Yes | Yes for every dish and family recipe | One corrective full-menu regeneration; typed failure if requested counts still cannot be met | Yes | No purpose is assumed | **PASS** |
| Holiday gathering meal generation | Yes | Yes | Yes per course | Retry plus deterministic per-course fallback | Yes | Canonical protocol precedence | **PASS** |

## Excluded from the platform-wide human recommendation claim

| Surface | Reason |
|---|---|
| Companion/pet nutrition | Human Whole-Food Standard is not a veterinary policy. A separate approved veterinary standard would be required. |
| Saved-grocery and shopping-list CRUD | Persists user-authored data; does not generate or select a recommendation. Recommendation-time consumers are covered separately. |
| Venue discovery | Finds locations; does not select food. Getaway and restaurant recommendation stages are covered separately. |
| Recipe parsing/import | Extracts user-provided recipe data without recommending a food choice. Any later generated adaptation must pass a covered recommendation boundary. |
| Non-food coaching, translation, image generation, and narration | Does not make a food or nutrition-product recommendation. |

## Verification evidence

- Whole-Food policy and protocol regression tests: **PASS**
- Existing allergy/dish-adaptation regression tests: **PASS**
- Beverage guardrail regression tests: **PASS**
- Barcode unresolved-product contract tests: **PASS**
- Combined targeted run: **99/99 tests passed**
- Changed-file TypeScript diagnostics: **no errors**
- Repository diff whitespace check: **PASS**
- Independent post-change surface audit: **no active human recommendation blockers found**

The full-project TypeScript check still reports unrelated pre-existing client test/type issues outside the Whole-Food Standard changes. Those issues do not reference the files changed for this implementation.
