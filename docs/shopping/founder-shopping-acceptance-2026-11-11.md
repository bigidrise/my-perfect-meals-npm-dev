# Isolated founder Shopping acceptance

## Readiness

Original isolated acceptance passed. Subsequent fresh-session verification was
not completed after the test browser lost its session; no renewed READY claim
is made here.

Testing URL:

https://379eabec-1527-4de0-99b0-f3d40f5cfdad-00-2g5s7ko8rwtcf.spock.replit.dev:8080/auth

Open in a private browser window and create a separate consumer test account.
Existing customer accounts were not copied. Complete the ordinary onboarding
and macro save before testing creators. This is a Development URL and depends
on the workspace and its isolated app/PostgreSQL workflows remaining running.

**This is not the embedded/main Development preview. Keep `:8080` in the URL.**
The same hostname without that port reaches the main application, where
Shopping transfers intentionally remain disabled. Do not enable that application
to work around opening the wrong URL. Use a private browser window because
cookies are shared across ports on the same hostname.

### Follow-up on the founder's disabled-button report

Fresh authenticated re-verification was not completed. The URL included with the
report omitted `:8080` and therefore addressed the main Development application.
Live process inspection found the main Shopping activation flag unset, while
the isolated process had `PORT=4179` and
`MEAL_SHOPPING_TRANSFERS_ENABLED=true`. Its live socket connected to the verified
local PostgreSQL server. No activation or database changes were made.

The precise disabled-state chain is:
`MealShoppingAction` → `useMealShopping.available` →
`GET /api/shopping-list-v2/selections/capabilities` →
the running process's exact `MEAL_SHOPPING_TRANSFERS_ENABLED === "true"` check
and Shopping-schema readiness. This is a server capability check, not a
frontend build-time flag. The activation message is not a recipe eligibility
failure. Main activation being unset explains its negative capability result.

The founder subsequently clarified that the immediate request was the missing
Create a Dish aggregate footer, rather than activation of the main app's
individual-card Shopping action. That footer was present in source but hidden on
restored cards by a session-only gate. It now follows visible finalized cards,
retains the unverified-option exclusion, uses a contained desktop layout clear
of the sidebar, and keeps the mobile navigation/safe-area offset. Fourteen
focused regression checks passed. A signed-in desktop/mobile visual check was
blocked by the testing browser losing authentication, so no live visual
verification or new transfer acceptance is claimed for that correction.

## Isolation and runtime

- Independent PostgreSQL cluster on loopback port 55432.
- Fixed database `mpm_shopping_founder_isolated`; exact data-directory
  verification occurs before application imports and before Shopping activation.
- The strict pre-import PostgreSQL allowlist remains installed.
- Separate managed workflow: **Founder Shopping isolated app**.
- Its local port 4179 uses the workspace's existing external port 8080 mapping.
- Exact secondary browser origin is configured only in this child process using
  the existing `APP_ORIGIN` setting. A trusted-origin request reached normal
  signup validation; an untrusted origin remained rejected with
  `CSRF_ORIGIN_REJECTED`.
- The main Development workflow and database connection were not switched.
- No shared database connection or migration was used by the isolated setup.
- No customer data was copied, and no billing operations, push, merge, or
  Production publication were performed.

## Existing schema prerequisites

All unconditional safe-Development database startup guards were inventoried
before restarting: Stripe billing schema, safety-audit correlation ID, and all
17 critical columns. They passed together before application startup.

Existing additive statements were applied only to the verified isolated target:

| Required structure | Existing source |
|---|---|
| Avatar primary key and unique user relationship | Previously corrected schema; baseline initialized locally |
| Businesses and Stripe ownership/event storage | Existing businesses base SQL and `runStripeBillingMigration` |
| Child-profile base table | Exact existing boot SQL in `server/index.ts` |
| Subject Nutrition Priorities | `runNutritionPrioritiesMigration` |
| Health protocol sources/events and protective triggers | `scripts/migrate-health-protocols-dev.ts` |
| Clinical directive/review storage and protective triggers | `scripts/migrate-clinical-directives-dev.ts` |
| Daily nutrition prescriptions and activity-event storage | `runPhase3BMigration` |
| Three prescription meal-plan snapshot columns | Existing boot statements in `server/index.ts` |
| Provider clinical intervention storage and indexes | Six original statements in `scripts/migrate-phase1-clinical-studio.ts` |

Standalone scripts that originally import the application DB were not imported
or executed. Their exact static schema statements were extracted and applied
through the verified local client, with transaction/lock/statement bounds.
No clinical backfill, grants, provider records or paid identities were created.
No destructive migration or application guard bypass was used.

Repeatable isolated-only setup helpers are under `scripts/shopping-isolation/`.
They are not mounted in either main application boot path.

## Authenticated acceptance evidence

- Normal synthetic consumer signup succeeded through the real UI.
- Consumer onboarding completed, with no allergies/clinical conditions.
- The ordinary consumer trial was issued through the existing signup flow.
- Macro calculation and saving succeeded after provisioning its existing
  prescription storage.
- Create a Dish generated a real three-serving chicken/rice recipe.
- Standardized Shopping acknowledged the addition.
- The actual Shopping List survived page refresh.
- Read-only local SQL confirmed one real Phase 2 receipt and six contributions,
  not a legacy-only list add.

First recipe's canonical stored quantities:

| Ingredient | Amount | Unit |
|---|---:|---|
| Chicken breast | 54 | oz |
| Dried oregano | 3 | tsp |
| Dried thyme | 3 | tsp |
| Lemon juice | 0.75 | cup |
| Rice | 4.5 | cup |
| Water | 9 | cup |

These matched the rendered recipe totals; Shopping did not multiply them by
three again. The purchase-oriented list displays rounded amounts and does not
show every canonical unit. This evidence verifies transfer fidelity, not
independent nutritional accuracy of AI-generated recipes.

Second-recipe aggregation and new-session persistence also passed:

- A distinct chicken/garlic-rice recipe was added through its real Shopping action.
- The list grew from six to ten distinct ingredients without losing the first
  recipe's unique ingredients.
- Canonical chicken increased from 54 oz to **108 oz**; rice from 4.5 cups to
  **9 cups**. SQL contribution sums exactly matched all stored list quantities.
- A fresh browser context initially had no session. Normal sign-in with the
  same synthetic account restored the combined ten-item list.

The first recipe's Shopping control was not recoverable after the explicit
Create New/reset flow, so no first-recipe UI retry is claimed. Existing native
PostgreSQL duplicate/retry coverage is separate evidence.

Gatherings individual-course/whole-menu acceptance passed:

- Generated a real three-person, three-course Thanksgiving experience:
  Roasted Butternut Squash Soup, Herb-Roasted Turkey Breast, Classic Pumpkin Pie.
- Shopped the appetizer through its standardized card action first.
- Added the whole menu through **Add & View List**.
- The final Shopping List contained **33 items**, including both original
  Create a Dish recipes, and retained them after page refresh.
- Final local SQL showed **5 receipts** (two Creator recipes plus exactly three
  Gathering courses), **44 contributions**, and **one owner**.
- Every stored item quantity exactly equaled the sum of its recorded
  contributions. The appetizer did not get a second receipt or contribution set.
- All five receipt versions remained 1.

The generated whole-menu control was not restored after navigating back, so a
second whole-menu UI retry is not claimed. No template Save/reopen path was used.

## Final database evidence

- Database: `mpm_shopping_founder_isolated`.
- Server: `127.0.0.1:55432`.
- Data directory: `/home/runner/workspace/.local/shopping-isolated/postgres`.
- Public tables: **195**.
- Synthetic accounts: **1** at acceptance completion.
- Shopping receipts/items/contributions: **5 / 33 / 44**.
- All isolated setup runners parsed successfully; `git diff --check` passed.

The source Shopping implementation was not modified by this environment work.
The previous 65 regression, 32 native PostgreSQL and 26 PostgreSQL/WASM checks
were not rerun or represented as a new browser pass.

## First founder hands-on tests

1. Create a three-serving dish, use Shopping and compare its recipe totals
   with the stored list; refresh.
2. Add another recipe with an overlapping ingredient and check aggregation.
3. In Gatherings, select a specific holiday, finalize a small menu, shop one
   course and then the whole menu; check that the first course counts once.

## Scope and known limitations

- This is a personal Shopping test environment, not a copied Production tenant.
- Optional Business/Studio workspace discovery currently displays a warning
  because those unrelated workspace prerequisites are not fully provisioned.
  No business, professional or checkout flow is included in this acceptance.
- The unrelated template Save placeholder remains deferred; template
  save/reopen is not reported as functional.
- Existing meal-card actions, builder Shopping, Add to Plan, Add to Macros and
  application authorization/nutrition guards were not changed.
