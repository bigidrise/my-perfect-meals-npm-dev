# Craving Category — Development verification

## Status

The category implementation is saved, but the updated backend has not been
activated. No startup skip has been installed and Development was not restarted
during this investigation. Production startup was not edited. No database
queries, migrations, record changes, or migration-history changes were performed
by this investigation.

## Startup inspection and blocker

There is no existing general migration-free launch switch. The configured
account-maintenance skip covers the legacy LMS/account-maintenance block, not
the entire startup sequence.

Mutation paths found in `server/index.ts` include:

- Synchronous clinic-pilot migrations, default organization seeding, onboarding
  maintenance, and the grants/pilots/organization/commercial/billing migration chain.
- Hydration, email-identity, safety-correlation, voice-storage, nutrition-priority,
  and One-Touch migrations and pre-route column alterations.
- Saved Grocery shopping identity, Foods I Enjoy, My Perfect Menu, and another
  clinic-pilot migration before route registration.
- Deferred promotion/invitation, hydration, media, meal-image, nutrition-state,
  bug-report, planner, coaching, grocery-history and refinement migrations.
- Deferred coaching knowledge seeding and deletion of stale image-cache rows.
- Studio video migration followed by initialization of its purge worker.

The read-only critical-column assertion must remain active. Studio purge startup
currently depends on a successful migration; treating a skipped migration as
success would remove that prerequisite. Skipping the entire startup function
would also skip required checks and route initialization.

A partial flag around only the obvious migration timers would therefore not
meet the approved isolation requirements. Safe isolation has not been confirmed,
so no restart was attempted. A complete change requires separating mutation
jobs from startup checks and preserving the Studio worker's schema prerequisite.

## Category implementation

Files changed for the category feature:

- `shared/cravingCategories.ts`
- `client/src/pages/craving-creator.tsx`
- `client/src/components/ui/DietOverrideControl.tsx`
- `client/src/components/ui/DietCuisineControlRow.tsx`
- `server/routes.ts`
- `server/tests/cravingCategory.test.ts`
- `server/tests/craving-creator-exclude-meals.test.ts`

The lower dietary dropdown overlapped the upper selector but also supplied
Dairy-Free and Mediterranean. These are now opt-in additions to Craving's upper
selector; defaults for other Creators are unchanged. Custom restrictions and
the existing diet, cuisine, cooking-method and serving request fields remain.

The client sends optional `cravingCategory` to `/api/meals/craving-creator`.
The updated handler adds allowlisted, soft category guidance only for Craving.
The generator receives clean explicit text for food classification, keeping
category instructions from reclassifying the request. Nutrition and safety
validators and meal-destination arguments were not replaced.

## Checks and limits

Latest focused checks collectively passed 102 of 103 tests. Category contracts
and the existing pipeline test for conflicting sweet-category/chicken context
passed. That pipeline test uses mocked model/profile dependencies; it is not
real signed-in E2E or clinical verification.

The remaining failure is:
`cravingOverriddenAllergens.test.ts` →
`claimed shellfish override: cached shrimp meal is served`.
It expects `success: true` and receives `false`.

The same test was run from an isolated archive of the revision immediately
before the category's introduction, with the same installed dependencies.
It reproduced the identical failure: 1 failed, 3 passed. The tested pipeline,
protocol-envelope module and allergy test also have no changes between that
baseline and the category revision. The failure therefore predates this change.
Its underlying cause is not yet established; this is not proof of a new
customer-facing allergy regression, nor proof that real overrides work.

Live communication with the updated backend, signed-in dropdown interactions,
desktop/mobile rendering, and actual selection behavior remain unverified
because safe restart isolation was not confirmed.
