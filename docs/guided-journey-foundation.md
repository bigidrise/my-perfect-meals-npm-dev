# Guided Journey foundation — Development inspection only

## Approved boundary

The foundation implements the engine and completion detection. There are no new
modals, automatic navigation, onboarding
changes, nutrition changes, entitlement changes, database writes, or migrations.
Professional and organization journey types are reserved, not implemented.
Change 3 subsequently added a separate local preference library; see
`docs/guided-journey-preferences.md`. Preferences never change completion evidence.
The subsequently approved Dashboard card now reads these contracts and local
preferences in Development only; see `docs/guided-journey-dashboard-card.md`.

## Inspection

`GET /api/guided-journey/progress` uses existing authentication and inspects only
the authenticated personal actor. It rejects query overrides and has no mutation
methods. It is mounted only in `server/index.ts`, and its own runtime gate also
requires `NODE_ENV=development` and no `REPLIT_DEPLOYMENT` marker. Production
entrypoints do not mount it. Client branding is not runtime authority.

The response includes step evidence, the next existing activity as a **suggestion**,
and an optional saved-plan reference. No navigation is executed. Raw target
numbers, recipes, and account profile fields are not returned. `Cache-Control:
no-store` prevents browser reuse across accounts.

Example first-account result:

```json
{
  "version": 1,
  "journeyType": "personal",
  "status": "in_progress",
  "nextStep": "get_to_know_you",
  "nextAction": { "kind": "open_existing_activity", "route": "/onboarding" }
}
```

The real response additionally contains scope, per-step evidence, Builder,
completion goal, and saved-plan reference.

## Completion contracts

* Onboarding: persisted `onboardingCompletedAt`, not visits or measurements.
* Targets: raw saved columns. All four must be finite, nonnegative numbers, with
  positive saved calories. Zero carbohydrate, protein, or fat is not itself an
  error. All-null means incomplete; partial/ambiguous values mean unknown. This
  is recognition of setup evidence, not a new nutrition or clinical validator.
* Meal planning: existing authenticated `PAID_FULL` access decision, plus an
  explicit `activeBoard ?? selectedMealBuilder` assignment. No default Builder,
  assignment write, or cross-feature Performance normalization.
* Only General Nutrition's `generalNutrition` namespace has a board adapter.
  Other assignments remain intact and become blocked at the plan step.
* A real named meal with an ID in a schema-valid persisted board proves a saved
  plan. Modern calendar days own completion; legacy lists are supported only
  when calendar days are absent. Generated meals, Favorites, client drafts, and
  cached responses are never read.
* At most the latest 100 scoped boards are inspected. An older saved plan within
  that history counts. Overflow without proof is unknown, not proof that no
  historical plan exists. Malformed records are likewise unresolved.
* Free/expired access omits meal planning; completion means personal setup.
* Guests, reviewer/demo/sandbox accounts, professional identities, and active
  household-subject contexts do not run this personal V1 adapter.
  Unsupported household responses expose only actor self scope, not the
  selected household identifier or that member's data.

## Failure and lifecycle

Every inspection reads current records; there is no persisted journey state or
process-wide progress cache. Account and board errors remain unknown. The pure
ordered evaluator stops at an unknown prerequisite even if later evidence is
complete. A missing Builder suggests the existing selection screen; it does not
select General Nutrition or authorize a Builder switch.

The endpoint is explicitly personal. A future UI must suspend/replace it when
workspace or subject changes and reject stale responses using the returned scope.
The foundation itself does not poll or initiate navigation. The separately
approved Dashboard card reads on mount and rechecks before manual continuation.

## Verification

Run the three focused suites with isolated transpilation:

```sh
npx jest server/tests/guidedJourney.test.ts server/tests/guidedJourney.route.test.ts \
  server/tests/guidedJourney.repository.test.ts --runInBand \
  --globals='{"ts-jest":{"isolatedModules":true}}'
```

They cover progression, raw target ambiguity, zero-carb recognition, failed
reads/saves as unchanged records, scoped SQL, historical plans, unsupported
Builders/subjects, changing access, concurrent actor inspections, authentication,
runtime gating, and absence of mutation routes. Fixtures are not evidence of a
live authenticated user's database state.

Modal coordination and explanatory walkthroughs still require separate approval.
The Development Dashboard entry now uses local presentation preferences.
Other Builder adapters require
their own authority and board contracts; do not simply reuse General's namespace.
