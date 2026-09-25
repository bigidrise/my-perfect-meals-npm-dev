# Phase 2D — Development nutrition release gate

Scope: classification and release-gate cleanup for existing human-food paths. No new clinical thresholds, schema changes, Production deployment, or clinical protocol architecture. Phase 2C's surface inventory remains in `docs/phase-2c-enforcement-report.md`.

## A. Hard-safety rules

These reject a demonstrably prohibited food or fail when an established ingredient-dependent safety policy requires evidence the surface cannot supply: active allergies, Alpha-gal, trimester pregnancy food safety, known thyroid hard stops, vegan/vegetarian/pescatarian direct conflicts and hidden derivatives, explicit clinician restrictions with an applicable existing check, and other already-established prohibited foods/instructions. They do **not** turn every health-condition label into a universal ingredient or nutrient prohibition. The common output scan, specific validators, and final Human Food checks remain in place.

Brand-only Product Advisor output and unverified Pairings or Restaurant/Fast Food menus cannot clear active allergies, Alpha-gal, or trimester pregnancy: these paths now return a clear unavailable response rather than certifying unknown ingredients. An authenticated Pairings request no longer falls back to a guest envelope, and Restaurant AI fallback no longer proceeds if subject nutrition context cannot be resolved. Restaurant Alpha-gal badges cannot turn incomplete menu evidence into a green “protected” claim.

## B. Guidance/optimization rules

Cardiac Health, renal/kidney, Liver Support, Liver Disease, Anti-Inflammatory, thyroid advisory guidance, Menopause, Perimenopause, Hormone Optimization, Metabolic Recovery, and oncology nutrition guidance inform food construction. Any existing specific hard stop within those protocols remains hard. A condition's placement in a legacy `medicalHardLimits` list is not, on its own, proof that every ingredient-less Weekly Board template must be rejected. No universal sodium, potassium, phosphorus, protein, or saturated-fat ceiling was created.

GLP-1 Nutrition Support remains distinct from medication status; its existing resolver, targets, and Builder handling remain authoritative, with no second personal support block under the GLP-1 Builder. Diabetes stays in its existing Builder/profile/glucose-aware system, with its existing numeric gates unchanged. Performance remains separate.

## C. Patient-specific numeric rules

Only an existing authoritative target or directive may supply a patient-specific numeric limit. Existing GLP-1/diabetes and other supported route-specific numeric checks remain. Weekly Board's provided template nutrition and Restaurant AI's macro *estimates* are not independently verified nutrient analysis; a prompt or a tag does not prove clinical compliance. This cleanup does not assert all-surface cardiac/renal/liver numeric validation.

## D. Grocery Coach failures and resolution

The two positive saved-option assertions were failing independently because the test still mocked a retired compliance filter. Grocery Coach now calls authoritative saved-grocery revalidation and selects only approved IDs. The outdated mock supplied no approval decisions, so the route correctly returned `null`. The test now supplies explicit approved/blocked decisions through the current path and uses the real approved-ID selector/prompt builder. A new blocked-ID test confirms that a model-asserted saved product stays unavailable when revalidation blocks it. This was stale test setup, **not** a reason to remove the production membership/safety gate.

## E. Weekly Board solution

The existing selector reads ingredients from `meal_template_ingredients` where present and has fallback templates. Before constructing a plan, the source now excludes templates that fail the existing protocol scan or an established ingredient-evidence requirement; the canonical final scan still validates selected meals before return/save. Unknown generic ingredients under an active ingredient-dependent restriction remain unavailable. Cardiac/renal/liver guidance alone does not force the missing-ingredient hard stop.

Template diet tags and badges now contribute to ranking **only when they explicitly match** an active support or selected Builder. Anti-Inflammatory, GLP-1 Nutrition Support, and exact supported condition tags can influence selection; the picker no longer shuffles away that ranking. Recent selections still rotate for variety. Untagged or placeholder metadata cannot prove optimization; no recipe-generation fallback was added to invent ingredients. A restricted profile with no eligible templates may still receive no plan.

## F. Unknown-composition handling

| Evidence state | Behavior |
|---|---|
| Known conflict | Reject/filter through existing protocol or route-specific checks. |
| Sufficient verified ingredients and no known conflict | May recommend, subject to existing checks; do not imply numeric clinical proof without verified numbers. |
| Unknown packaged product | Product Advisor screens known contradictions and labels remaining brand-only results unverified, asking the user to scan the package. High-risk ingredient-dependent profiles receive an unavailable response. |
| Unknown Pairings composition | Known contradictions are filtered; successful results display an ingredient/nutrition verification note. High-risk profiles and unresolved authenticated context fail closed. |
| Unknown Restaurant/Fast Food composition | Verified menu *names* do not certify complete ingredients. High-risk profiles receive an unavailable response even when menu items exist. Other results identify incomplete composition, and both pages disclose that nutrition figures are estimates, not clinical proof. The AI fallback stops if subject context is unavailable. |

The system may say it considered active nutrition information; it may **not** say that every result satisfies unknown patient-specific clinical nutrient limits.

## G. Regression-test results

Focused coverage includes actual resolved prompt inputs and post-output scans for Alpha-gal, pregnancy, thyroid hard stops, vegan/vegetarian/pescatarian direct conflicts, distinct liver guidance, GLP-1 resolver failure, Anti-Inflammatory, Cardiac, Renal, Grocery Coach saved decisions, Pairings unknown composition, and Weekly Board selector eligibility/ranking. The Grocery Coach swap suite passed independently (**68 tests**). The combined focused nutrition group passed **10 suites / 123 tests**. Safety typecheck, server build, client build, and `git diff --check` passed. These do not replace an authenticated Development meal acceptance test.

## H. Remaining concrete defects

1. Some Weekly Board database templates still have generic placeholder ingredients. For a profile requiring ingredient evidence, if no eligible template exists the whole plan can be unavailable; this cleanup does not manufacture a compliant recipe.
2. Restaurant/menu and brand providers do not expose complete verified ingredient and clinical-nutrition evidence for all items. The high-risk paths now avoid asserting safety, but cannot offer a verified alternative until better source data exists.
3. Patient-specific specialty nutrient limits are not uniformly supported or verified across every generator. This is a capability boundary, **not** a reason to invent limits or block all otherwise safe food.
4. The separate root release-type fingerprint reports 135 diagnostics against its reviewed baseline of 133. None of its printed diagnostics point to the files changed in Phase 2D; the safety typecheck and both builds pass. The type baseline needs separate review before a Production release, not a change to nutrition thresholds.

## I. Controlled authenticated Development acceptance

After the focused checks pass, these limitations do **not** prevent a small, controlled authenticated Development acceptance test that turns a representative protocol on, creates food, inspects the result or explicit unavailability, and changes/turns the protocol off. Include hard-safety and guidance-only examples and check both a generated meal and a recommendation. This report does **not** approve Production cutover or publishing.