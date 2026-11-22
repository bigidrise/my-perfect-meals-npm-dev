# Shopping List Development verification

## Scope and outcome

Only the My Perfect Meals grocery recommendation and Shopping List workflow is in scope. This audit did not change application behavior, clinical rules, prompts, catalog ranking, authentication, database configuration or release settings.

**The Shopping List mechanics have supporting verification; consistent recommendation safeguards across all four entry points are not yet established. Do not mark the overall workflow complete.**

The practical standard is to use the customer's current dietary preferences, allergies, avoided foods and applicable medical, lab-derived and physician/personal protocol guidance. Reject known conflicts, use genuine products, and distinguish a useful qualified recommendation from a claim of verified compatibility. This does not require inventing new clinical thresholds or rebuilding the clinical system.

## Verified

The focused tests exercise actual discovery, selection, persistence and presentation code with synthetic profile/catalog/API dependencies:

- Current subject resolution retains dietary identity, allergies and avoided foods; disagreement or genuinely unavailable context does not become an unrestricted profile.
- Catalog checks reject demonstrated meat/dairy dietary conflicts, explicit avoided ingredients, declared allergens and shellfish traces. Unresolved clinical product authority does not become clearance.
- Discovery continues past rejected/incomplete candidates within its bounded search budget, preserves exact catalog identity and never pads missing results with invented eligible products.
- Product choice saves in one action. Change/Clear, consolidated source amounts, recipe contributions, account isolation and rejected writes have passing tests.
- Compact Shopping List/Shop Online presentation and retailer-query identity have passing regression coverage. The preceding isolated desktop/mobile browser check also remains applicable to the unchanged application code; it was not rerun here.
- A new numeric-macro round-trip test passes: calories, protein, carbohydrate and fat facts, serving basis and source payload survive a newly created store's API hydration. Required quantities/units, recipe provenance and checked state remain unchanged. This verifies persistence of supplied nutrition, not recalculation or independent validation of its nutritional accuracy.

## Remaining customer-facing gaps and smallest corrections

### 1. Different recommendation paths still provide different guarantees

Shopping options and the Development Find Product route use catalog discovery and product evidence. The older Grocery Coach advisor screens the ingredient/category/brand text with the protocol scanner, not an exact product's complete composition. Product Scan's by-name alternatives are parsed/capped model suggestions with qualification notices; they do not traverse that same exact-catalog eligibility check.

Consequently, a passing prompt/profile test is not proof that all alternatives are genuine catalog products or that a hidden ingredient conflict would be excluded. This is an inspected coverage gap, not a claim that a conflicting product was observed in a customer's live account during this audit.

**Smallest correction:** Reuse the existing current-subject/catalog decision for the selectable products returned by these paths. Keep the current profile and applicable medical/lab/protocol guidance; do not create another recommendation engine or new condition-wide prohibitions. Present up to three supported, distinct products and fewer when the evidence cannot support three. Do not promote model suggestions or qualified references into verified eligibility.

Evidence: `server/routes/groceryCoach.ts`, `server/services/productAdvisor.ts`, `server/services/ingredientScanService.ts`, `server/services/productDiscovery/findShoppingProductRecommendationsDevelopment.ts`.

### 2. Missing product verification can be diagnosed as a missing profile

The shared evaluator emits `context_unavailable` / “Current subject requirements could not be resolved” for an unresolved product-requirement policy as well as an actually unresolved subject. Existing tests reproduce a successfully resolved pescatarian/quinoa-avoidance profile whose plain-oil decision remains unverified.

**Smallest correction:** Give genuine profile failures, incomplete product evidence and unavailable product-rule authority distinct diagnostic reasons. Keep uncertainty honest without telling a customer that their stored profile failed to load when it did not. Do not manufacture a compatible result to suppress the warning.

Evidence: `server/services/productDiscovery/evaluateProductCandidate.ts`, `docs/shopping-dietary-verification-investigation.md`.

### 3. A saved product assessment is historical, not current compatibility

Reload and Shop Online preserve the selected identity and stored evidence. They do not themselves re-evaluate the saved assessment against a later profile or protocol change.

**Smallest correction:** Use a fresh authorized profile when suitability is requested or a saved assessment is reused as a current recommendation. Preserve the user's selected shopping identity, quantities, recipe provenance and historical evidence separately. Do not silently rewrite or delete shopping choices merely because their assessment needs review.

Evidence: existing selection/metadata persistence tests and the preceding dietary investigation.

## Verification status

Across 13 focused suites, with database/authentication initialization isolated where required, the latest distinct results are **343 passing tests and three failing assertions**. These are offline tests: no customer records, paid-provider calls, real external catalog availability or new live-account browser journey were used to establish these counts.

The three remaining assertions are:

1. Two origin-transfer tests still expect the chosen product title inside the small Change/Clear component. That component intentionally no longer duplicates the title; the parent list row owns it. The data/hydration assertions preceding those checks pass.
2. One Product Scan test expects a frozen full-analysis prompt hash. A previously added medical-authority instruction changed that shared prompt, causing the hash mismatch. This is a real verification failure, not proof of an unsafe result.

Smallest test corrections: assert the compact component/parent-row contract, and review/assert the intended medical prompt behavior rather than blindly updating its hash. Do not restore the redundant row title or remove medical guidance just to make tests pass.

Initial missing-database and Vite `import.meta` test setup failures were separated from application failures. A verification-only setup supplies an inert database mock and a fixed valid measurement preference. The affected foundation and quantity tests then pass. No shared database was accessed; the runner rejected socket connections and live fetches.

## Preservation and release boundary

- The Beverage backup remains unchanged at `.local/paused-work/beverage-creator-unfinished.patch`.
- This audit did not touch Beverage application files or restore its unfinished feature.
- Only a Shopping persistence regression test, this report and the standing scope note were added/updated for this audit; the verification-only setup is under ignored `.local/`.
- No commits, pushes, merges, publication or deployment were performed.
- Spanish, Beverage Creator, Recipe Maker and other queued tasks remain out of scope. No next task starts automatically.
