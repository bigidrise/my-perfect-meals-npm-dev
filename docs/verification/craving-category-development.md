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
and desktop/mobile rendering remain unverified because Development was not
restarted. Saved-code request mapping has now been verified in isolation below.

## Subsequent isolated verification — no startup changes

Added `server/tests/cravingCategory.handler.test.ts` and
`server/tests/helpers/isolatedCravingHandler.ts`. The harness parses the saved
TypeScript source, executes the original handler expression and its actual
`app.post("/api/meals/craving-creator", cravingCreatorHandler)` registration,
and dispatches synthetic requests through that registration.

It does not import the route module, app entrypoint, database, or AI SDK.
Dynamic imports are restricted to an explicit fixture-module allowlist; unknown
imports fail the test. The handler's database dependency is an in-memory fixture.
No listener is started, real environment credentials are not passed to the
handler sandbox, and the generator is a function returning synthetic data.

The isolated handler and category contract suites pass **56/56 tests**:

- All 15 categories travel from the actual client JSON expression into the
  registered handler and its generator prompt. Explicit text stays the clean
  classification input.
- Diet override and cuisine reach the request-context resolver and generation
  arguments. Snack destination normalization remains intact.
- Dairy-Free and Mediterranean are retained in Craving's upper selector and
  reach generation; custom restriction text is still forwarded to the resolver.
  This verifies mapping, not real resolver acceptance of arbitrary free text.
- Omitted, empty and unsupported categories produce identical generation
  arguments without category guidance.
- The actual serving formatter receives the selected count, applies its
  existing 1–10 clamp, sets the serving label and calls nutrition formatting
  with that count. Nutrition calculations and quantity-scaling dependencies
  are fixtures, not independent proof of real generated recipe quantities.
- Missing actor identity, a reported allergy block, unresolved clinical context,
  and active GLP-1 without resolved targets stop generation.
- Diet replacement leaves the fixture's allergy list and saved diet unchanged.
  Existing final protocol, allergen and clinical validation calls remain in the
  untouched handler source.

A separate in-process comparison executed the pre-category handler from the
previously archived revision with the same fixtures and omitted-category body.
It produced exactly the same generation arguments as the saved current handler.

### Confirmed cooking-method mapping gap

The client sends the selected value as `cookMethod`, but this handler does not
consume it, put it in request context, or forward it to generation. The isolated
test confirms `air-fryer` reaches the JSON body but not generation arguments.
The pre-category handler comparison used that same body and also ignored the
field: this gap predates the category change. No generation code was modified
to repair it during this verification-only request.

### Remaining live verification

The harness intentionally stops normal generation at an empty fixture result
and tests serving formatting separately. It does not prove model compliance,
real allergy/PIN or clinical policy decisions, final returned-meal validation,
image generation, persistence, or the full application's middleware.

An approved restart is still needed to activate the saved backend and check
actual authenticated browser/network behavior and dropdown rendering. Real
generation would additionally require approval for AI calls. No startup change,
migration-skip flag, restart, database connection, migration, AI request,
Production modification, push, merge, or publish was performed.
