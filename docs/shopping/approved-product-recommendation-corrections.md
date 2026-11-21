# Approved Development Shopping corrections

## Scope

Implemented only the three approved grocery product-recommendation corrections. No Beverage Creator, Spanish localization, Recipe Maker, clinical-engine, database-schema or release changes were made.

## Implemented

### Shared exact-product checks

- Development Grocery Coach recommendations, Find Product, Product Scan alternatives and Shopping Product Options reuse the existing exact-catalog/profile checks.
- Product Scan's label, name and full-product entry points receive the same final verification. Internal name fallback does not perform the catalog search twice.
- Model-proposed product names and health claims are not transferred into the final alternative cards. Cards use actual catalog identities and sourced ingredient/nutrition statements.
- Known conflicts remain excluded. Missing evidence or applicable rules stays unknown; it does not receive an eligible or Profile-Matched compatibility claim.
- Results are bounded to three supported options, without invented filler. A source-backed shopping reference remains distinct from verified compatibility.
- Primary scans cannot retain a positive compatibility verdict on model knowledge alone. Unverified primary products have an unknown/caution result and neutral score cards; known conflicts remain skip results.
- Source-backed catalog identity is retained on Coach recommendations for downstream shopping actions.
- Production/published activation is explicitly excluded. Existing Production behavior remains unchanged.

### Accurate explanations

Development diagnostics distinguish unavailable current customer authority, insufficient exact product evidence, unavailable applicable verification rules and known conflicts. Catalog outages are retryable failures, not claims that the customer lacks a profile or that no products exist.

The evaluator's eligibility outcome was not relaxed. Adding distinct reason codes does not install clinical thresholds or confer compatibility.

### Current-profile saved assessments

New supported selections carry a safety-relevant profile/protocol reference distinct from the per-request Human Food Context fingerprint.

Development list reads and selection responses compare saved assessments with freshly resolved current authority. Missing legacy references, changed requirements/protocol state, a different day or unavailable current authority require review rather than implying current compatibility. A healthy same-profile read with a new request identifier does not invalidate a selection.

This is a response projection, not a background database rewrite. Product identity, required amounts, recipe contributions, checked state, original source payload and historical assessment timestamps remain intact. Unknown/rejected shopping choices are never upgraded by hydration.

## Automated verification

**386 passing tests across 15 focused suites in the final combined run; zero remaining failing assertions in the scoped suites.**

Coverage includes:

- Pescatarian plus quinoa avoidance; vegan and vegetarian identities.
- Positive meat/dairy, avoided-food and allergen conflicts, including shellfish declarations.
- Applicable clinical authority remaining unresolved rather than becoming clearance.
- Current-profile changes, unavailable authority, legacy saved choices and changed lab/physician protocol references.
- Wiring from Coach and all three Product Scan methods to the shared checks.
- Development-only activation and unchanged Production saved-choice reads.
- One-action Choose Product, Change/Clear, exact identity, quantity/unit preservation, recipe provenance and checked-state persistence.
- Supplied numeric calories, protein, carbohydrate and fat facts, their serving basis and original payload surviving fresh-store API hydration.
- Compact Shopping/Shop Online presentation and retailer-query identity.

The three prior failing assertions were resolved by reviewing their actual contracts:

1. The two origin-transfer checks now verify the retained data identity and normal controls, without requiring the redundant product title inside a control-only component. The parent row still owns the title.
2. The full-scan prompt check now verifies the existing medical-authority instruction, supplied profile, exact product name and scanned ingredients. It no longer assumes an obsolete fixed character-prefix hash.

The release type gate passed against the unchanged reviewed baseline: **109 existing diagnostics, no new diagnostic set**. The baseline was not refreshed or weakened.

Tests ran with synthetic profile/catalog/API dependencies, no shared-database access, rejected socket connections and rejected live fetches.

## Browser verification

One signed-in journey ran against the existing separate local-PostgreSQL Development instance with offline catalog inputs. No customer database was used.

Passed checks:

- Desktop and 390 px mobile options showed no more than three source-backed comparison records with honest unverified status.
- Choose Product was one click, with no additional reference confirmation.
- Exact selection and required `2 tbsp` survived reload.
- Change, Clear and generic ingredient restoration worked.
- Checked-state persistence survived reload and was restored afterward.
- All nine synthetic rows retained their IDs, ingredient identity, quantities, units, scopes, recipe contributions and provenance.
- The original product identity and checked state were restored after the journey. Explicit re-selection regenerated its assessment rather than resurrecting an old compatibility claim.
- Retailer links retained the selected brand, product and variant; no retailer site was opened.
- Compact Shopping rows contained no assessment paragraphs or duplicated product title. Mobile had no horizontal overflow.

The browser identified one display failure: Shop Online used a retail-purchase estimate, which hides amounts for some volume-based ingredients, instead of showing their original required amount.

Corrected this narrowly in Development: Shop Online now displays the original required amounts using the existing measurement formatter and registered quantity translations, while retaining separate retail purchase estimates. It does not change quantities, units, recipe totals, product identity or retailer queries. Production presentation stays unchanged. The correction passed the component and quantity suites (29 tests), the final combined regression run above, and the changed component's language-server check. A second browser journey was not run for this small display correction.

The isolated fixture also showed an unrelated workspace-discovery banner after login. It was not changed. A temporary private-tab welcome-screen dismissal was used without editing persisted coach preferences, server profiles, medical data or application flags.

## Preserved boundaries

- The unfinished Beverage patch remains byte-identical at `.local/paused-work/beverage-creator-unfinished.patch`.
- No Beverage or Spanish source files were modified.
- No commits, pushes, merges, publication or deployment were performed.
- No queued task is started automatically.

## Limitations

Controlled catalog tests verify decision behavior and persistence; they do not establish live retailer inventory, a changed physical package's formulation or universal medical clearance.

Products with insufficient evidence or unavailable applicable rules deliberately remain unknown. These corrections do not invent ingredient-completeness guarantees, approve missing clinical rules or create new physician restrictions.
