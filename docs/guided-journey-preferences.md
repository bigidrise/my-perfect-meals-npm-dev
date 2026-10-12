# Change 3 — Development guidance preferences

This change adds a preference library only. No application screen imports it,
no automatic explanations are enabled, and no Dashboard card or modal is added.
It uses local storage, not new database tables, HTTP writes, or progress records.

## API and scope

Source: `client/src/lib/guidedJourney/preferences.ts`.

Create a store from the immutable signed-in account ID. The key includes the
Development environment, preference schema, personal/self context, account ID
(encoded), and journey version. Only presentation state is stored:

* `mode`: not started, active, or paused.
* `automaticExplanationsEnabled`.
* `replayRequested`.

The stored envelope also identifies the account and schema/journey versions.
It contains no targets, recipes, clinical details, access decisions, or task
completion. Other accounts, versions, and anonymous/guest contexts cannot fall
through into this record.

```ts
const store = createGuidancePreferenceStore({ accountId: authenticatedUser.id });
const preferences = store.read();
store.apply("pause");
store.apply("disable_automatic");
store.apply("restart_explanations");
store.dispose(); // on logout/account change
```

This example is not wired into authentication or UI yet; those connections
belong to the separately approved next change. Do not pass email addresses,
tokens, selected household IDs, or organization IDs as personal account IDs.

## Behavior

| Command | Meaning |
| --- | --- |
| start | Explicitly activate guidance; clear an old replay request |
| pause | Stop automatic continuation; retain replay intent |
| resume | Activate guidance; preserve automatic-enabled/disabled choice |
| disable_automatic | Disable automatic explanations and pause |
| enable_automatic | Enable them without silently resuming |
| restart_explanations | Request replay; preserve automatic-disabled choice |
| finish_replay | Clear replay request without claiming task completion |

Fresh/missing preferences are not started. Reading never writes, repairs,
deletes, or activates anything. Replay cannot reset profile, targets, assignments,
or saved plans. Manual replay remains possible while automatic guidance is off;
future UI must distinguish manual explanation requests from automatic offers.

`canOfferAutomaticGuidance()` checks preference eligibility only. It is not
permission to show a modal: the future UI must also verify account/subject scope,
current server progress, destination readiness, and modal priority.

## Lifecycle and failures

* Normal logout does not erase local preferences. A newly created store reloads
  that account's record.
* Dispose old stores on logout/scope changes. Disposed instances cannot write
  through stale callbacks or expose retained in-memory choices.
* A new journey version has an isolated key and remains not started until an
  explicit choice; do not add implicit cross-version activation.
* Invalid/foreign records yield inactive defaults, with an explicit issue.
  An explicit current-version command may replace a corrupt record.
* Unknown schema versions remain untouched; choices are memory-only.
* SecurityError, unavailable browser storage, and quota failures do not escape
  into normal application work. Results report memory-only/not-stored status.
* Memory-only choices survive within that store instance, not a reload/logout.
  No durability claim is made. Explicit subsequent commands can retry storage.
* Same-account instances reread/rebase readable settings before applying commands.
  This is local-device storage, not cross-device synchronization.

## Safeguard review before this change

The self-only progress endpoint rejects query overrides, ignores untrusted
identity/cache headers, and uses actor + exact namespace SQL predicates.
Unsupported household context now returns only the actor's self scope, without
the household identifier or nutrition information. Target values and private
recipe content are never included in the progress response.

Partial/ambiguous saved targets remain unknown. Valid zero-carbohydrate targets
are recognized. Client caches/Favorites/drafts do not establish server completion.
Database read errors cannot become an empty/incomplete plan.

The three backend fixture suites passed 71 checks before preference work began.
These are contract/SQL-isolation checks, not a claim that a real authenticated
household session was exercised in a browser.

## Focused checks

```sh
npx jest client/src/lib/__tests__/guidedJourneyPreferences.test.ts --runInBand \
  --globals='{"ts-jest":{"isolatedModules":true}}'
```

The project-wide release type baseline remains a separate pre-Production review.
This change does not repair unrelated diagnostics or refresh that baseline.

Verification result: 35 preference checks passed after the 71 backend safeguard
checks. A strict focused TypeScript check of the preference library and core
engine passed. The preference library remains unimported by live application UI.
