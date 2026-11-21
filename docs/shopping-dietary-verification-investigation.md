# Development Shop Online cleanup and dietary verification investigation

## Scope

Implemented only the approved Development presentation cleanup. No assessment
logic, source-evidence policy, clinical thresholds, physician authority, allergy
rules or compatibility decisions were changed. No Production changes or release
actions were performed.

## Presentation correction

Shop Online now displays the chosen brand/product name (or original generic
ingredient), the existing quantity and normal retailer controls. It no longer
renders internal shopping-reference/assessment paragraphs or repeated search
explanations in Development. The stored variant remains in the retailer query,
even though it is not repeated in the visible product name.

The assessment, exact source snapshot and unresolved requirements remain stored.
The Production path and existing retailer-query behavior are unchanged.

## Confirmed findings

### Saved preferences reach the current assessment path

Edit Profile saves `dietaryRestrictions`, allergies and `avoidedFoods` through the
authenticated profile update. The authorized Human Food Context reads those
stored fields. Product subject resolution compares its diet and allergies
against the protocol envelope and retains explicit avoidances separately.
Disagreement or genuinely unavailable subject authority is not silently treated
as an unrestricted profile.

The investigation reproduced pescatarian plus quinoa avoidance using synthetic,
matching profile sources and the actual resolver/discovery/evaluator. Subject
status was resolved, its issue list was empty, and both restrictions survived.
The resulting plain-oil assessment nevertheless required verification.

This establishes a real reproducible cause for the warning; it is not an
independent inspection or modification of the customer's current private record.

### Loaded profile and reviewed product policy are different gates

The current catalog policy supplies a source-identity freshness policy but has
no reviewed rule-specific packaged-product validators. Pescatarian, vegan,
vegetarian, explicit avoidances and allergies therefore remain unresolved
product-policy requirements when applicable. A plain oil with no known
conflicting ingredient is not automatically a verified dietary pass.
The default rule assessor also deliberately returns unknown. Adding a registry
entry without an approved evidence-backed assessor would not establish a pass.

Known conflicts are separately screened using actual ingredient/allergen
declarations. The unchanged workflow rejects known meat/dairy diet conflicts,
explicit quinoa and known allergens. Absence of a detected conflict is not
treated as proof of full compliance. Clinical and physician-related product
authority also remains unresolved rather than acquiring invented nutrient limits.

### The generic failure wording is misleading

The evaluator uses the same `context_unavailable` reason and “Current subject
requirements could not be resolved” detail for an unavailable subject AND an
unresolved product-policy registry.

The Shopping explanation identifies the missing reviewed checks correctly,
but the reference snapshot also retains the evaluator's generic raw detail.
Both were displayed together. This can falsely look like a failed profile read
even when the subject and saved dietary settings loaded successfully.

No reason-code, evaluator or reference-generation behavior was changed here.

### Shop Online shows historical evidence, not a new decision

Choose saves the assessed identity, source facts and evaluation snapshot. Reload
and Shop Online use that stored product assessment; opening Shop Online does not
call a new compatibility evaluator. Profile changes do not automatically
re-assess every saved choice. An old unresolved message does not demonstrate a
new failed request when the user opens the retailer window.

The current source-backed cards use sourced declarations/nutrition, not AI
health claims. A permitted unverified shopping reference remains distinct from
a verified eligible selection; removing audit text does not grant compatibility.

## Smallest safe next corrections — proposed, NOT implemented

1. Separate actual profile-authority failure from missing product policy,
   incomplete label evidence and stale evidence in diagnostic reasons. Preserve
   the stored historical snapshot rather than rewriting it to appear verified.
2. To establish actual diet/avoidance verification, define and approve narrow
   ingredient-level evidence rules and their completeness/freshness requirements
   for the existing restrictions. Reuse current authority and known-conflict
   enforcement; unknown ingredients, missing labels and unresolved serious risks
   must remain unknown. Do not install generic condition-based clinical limits.
3. Reassess against current authorized profile/evidence when compatibility is
   requested or relevant profile data changes. Keep that result separate from
   the saved shopping identity and historical assessment.

The first item corrects the diagnosis and copy, not the missing verification
capability. Items two and three require a separately approved assessment scope.

## Checks

156 focused tests passed across the modal, real discovery integration, product
foundation and selection/reference suites. New investigation cases verify:

- Loaded pescatarian plus quinoa avoidance, and no fabricated plain-oil pass.
- Pescatarian meat, vegetarian meat and vegan dairy conflicts.
- Plain oils under vegan/vegetarian identities remain unverified where policy is
  missing, despite successful profile resolution.
- Explicit quinoa, milk allergy and peanut allergy conflicts.
- Unresolved clinical product authority does not become medical clearance.

Existing foundation checks also cover profile-source disagreement, unavailable
clinical/nutrition context and provider/physician authority boundaries.

Browser verification is confined to the existing isolated fixture app and local
PostgreSQL, with a synthetic saved pescatarian/quinoa profile. No customer-data
testing or paid-provider calls are used.

The completed browser pass confirmed compact Shop Online rows on desktop and
390px mobile, with no assessment paragraphs. All four desktop retailer queries
retained the exact chosen name and stored variant; mobile Walmart/Kroger queries
also retained them. No retailer links were opened. One-click selection, reload,
Change/Clear and restoration of the generic ingredient passed with the original
2 tbsp unchanged. Saved Groceries retained its one existing bookmark.

Read-only SQL after the journey confirmed all nine original ingredient,
quantity, unit, checked and recipe metadata rows were unchanged. The final
chosen oil retained its `review_required` assessment, both pescatarian/quinoa
unresolved requirements, the original generic raw warning and the original
`needs_verification` source decision internally. The presentation cleanup
neither erased evidence nor granted eligibility.

The release type gate passed against the unchanged baseline. Evidence:
desktop Shop Online `grbzyp`, mobile `gs2t4f`, desktop restored selection
`4v9ps3` and mobile final row `3mpihy`.
