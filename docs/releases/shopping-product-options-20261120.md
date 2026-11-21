# Shopping Product Options — verified Development release branch

## Scope and authorization

Branch: `release/shopping-product-options-verified-20261120`

Base: GitHub `origin/dev` at `3de75c88a`.

This branch preserves the approved Production-compatible Product Options repair
and the subsequent Shopping List crash correction. The owner subsequently
authorized merging verified work into GitHub Production. Publication,
deployment, live flag activation and changes to the separate Production
workspace are not performed by this source synchronization.

## Preserved changes

| Original commit | Clean-branch commit | Purpose |
| --- | --- | --- |
| `36f081ebe` | `e4e008de4` | Production-compatible Product Options adapter, validated ingredient metadata and account-scoped persistence |
| `811f29e8b` | `409db45c7` | Restore missing Shopping List feature-flag import and add undefined-name regression coverage |

The original release branch remains preserved locally. Checkpoint `79ab69377`
was deliberately not replayed: it added a `.backup` route file and generated
release-manifest changes, which are not part of the requested release.

## Crash root cause

`ShoppingListMasterView` used `shoppingMetadataEnabled` without importing it.
Opening the page therefore threw `ReferenceError: shoppingMetadataEnabled is
not defined` during render. The missing import was restored; the page,
recommendation controls, hydration and account-ownership checks were not disabled.

The binding regression checks the real page with TypeScript for undefined names,
without loading real providers, account state or database connections.

## Production configuration

The client requires both build-time variables:

```text
VITE_SHOPPING_PRODUCT_OPTIONS_ENABLED=true
VITE_GROCERY_CATALOG_PRODUCTION_ENABLED=true
```

The server requires this runtime variable:

```text
SHOPPING_PRODUCT_OPTIONS_ENABLED=true
```

Do **not** enable `VITE_SHOPPING_METADATA_PRODUCTION_ENABLED` just to enable
Product Options. The Production-compatible adapter works with the legacy store.
The verification build explicitly set the broader metadata flag to `false`.

Client build-time flags require a rebuilt client; the server flag is evaluated
at runtime. Approve and configure both sides together before release. No live
Production flag was changed during this verification.

The gates are not unconditional Development-only restrictions: Production
availability is independently configurable. New matrix coverage checks all
client flag combinations, metadata independence, and server Production defaults,
disabled configuration, explicit activation and Development behavior.

## Verification

- Nine focused Jest suites: **170 tests passed**.
- Coverage includes Production product-choice persistence, metadata validation,
  store ownership, shared product cards, guarded catalog guidance, selection
  parsing, the crash binding regression and client/server release gates.
- Tests ran with a sanitized environment and a network boundary permitting only
  test-owned ephemeral loopback servers. Real provider and database calls were
  prohibited.
- Production client build: **passed**, with Product Options and catalog flags
  enabled and the broader metadata flag disabled.
- Production server bundle: **passed**.
- Build outputs and test logs stayed under ignored
  `generated-artifacts/shopping-release-verification/`; no version-generation
  command or generated manifest update was used.
- Existing client bundle-size warnings remain; they are not build failures.

The existing release type-baseline check is recorded in the synchronization
report. A successful bundle is not a substitute for that check.

## Git audit and exclusions

The workspace initially had a clean working tree and three current-branch commits
ahead of `origin/dev`. GitHub branches were fetched before reconciliation.
No current-branch merge conflict was found. The clean branch was created from
the fetched base rather than resetting or rewriting the original branch.

An all-local-branch audit also found historical local-only checkpoints,
preservation branches, duplicate release patches, older Shopping iterations,
an Ask Chef candidate and the separately approved Development-only entry-screen
readability work. Commit reachability alone does not establish that these are
new, independently verified Production features. They were preserved and not
indiscriminately pushed or activated. The readability work's requested full
responsive browser matrix was not completed; this release does not claim that
verification or promote it.

No Production workspace, historical backup branch, remote history or branch
protection was overwritten. This branch changes only its listed release files,
tests, release documentation and the owner's release-policy note.

## Remaining release boundaries

No authenticated Production end-to-end save/reload journey was run. The
Production adapter and API contracts were exercised with synthetic fixtures.
Production account behavior, provider availability and deployed flag alignment
remain deployment-time checks, not claims made by an offline build.

Before going live: resolve any release-type-check blocker, approve the
Production configuration, and deploy/publish explicitly. The GitHub merge
authorization does not claim that the separately running Production app has
already been updated.
