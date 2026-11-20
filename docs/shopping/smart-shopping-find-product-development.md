# Smart Shopping: Find a Product integration

## Scope and authorization

Development integration and offline verification only. No Production deployment,
GitHub push/merge, live paid-provider calls, or real-account database writes were
performed. Barcode controls and unrelated product areas were not changed.

## Integration

- Shopping retains its authenticated Pro-gated product-advisor transport.
- Its Development shopping branch calls the existing `analyzeProductByName`
  service with the original ingredient and authenticated account.
- Supported branded recommendations become bounded catalog search leads, never
  ingredient/nutrition evidence. Brand-only and nonmatching identities cannot
  become verified product choices.
- Existing source adapters, subject resolution, conflict checks, product
  eligibility evaluation, and `shoppingSelectionBridge` remain authoritative.
- Eligible choices have priority. Hidden records cannot consume display slots.
  Up to three selectable/review references are displayed; review-only cards
  never expose Choose. No rules are relaxed to reach three.
- Personalized explanations reuse the Find a Product explanation renderer and
  are explicitly separate from sourced product facts.
- Existing `chooseProduct` persistence patches the selected reference on the
  existing source rows. Ingredient, quantity, units, ownership and recipe
  contributions remain unchanged; no item is created.
- New standalone Development Find a Product imports retain historical product
  identity using the existing transfer helper. This does not approve the product
  or backfill legacy rows. Existing branded references change only explicitly.

## Performance

One recommendation generation runs per real picker opening. Existing
StrictMode/stale-response guards prevent abandoned effects from dispatching.
The targeted catalog search seeks three qualified results, not nine, with at
most six search pages and eighteen inspected/evaluated records. Request-local
exact-record reads are deduplicated and run in batches of at most two.

The response and privacy-limited Development log include total, recommendation
and catalog elapsed milliseconds. `stageWorkMs` accumulates profile, search,
exact-record and enrichment work; overlapping exact reads mean accumulated work
may exceed catalog elapsed time. It is not a breakdown of additive wall time.

Controlled offline result with simulated 20 ms exact-record reads:

| Path | Exact reads | Elapsed |
| --- | ---: | ---: |
| Former broad catalog scan | 9 | 187 ms |
| Integrated targeted lookup | 3 | 44 ms |

The recommendation was mocked in this experiment. Live AI/catalog latency and
catalog coverage have not been measured or claimed.

## Verification

- 316 focused tests passed across nine suites.
- Strict safety type gate passed.
- Full release type check found the same existing 109 diagnostics and unchanged
  diagnostic fingerprint; no diagnostics were reported in the changed files.
  The reviewed baseline was not modified.
- One completed isolated browser journey passed 14 checks: generic olive oil,
  personalized explanations, Choose, selection after reload, Change, Clear and
  reload, historical Product Scan identity, review-only results and cancellation.
- Browser persistence was in-memory: four mocked advisor lookups, four
  metadata-only PATCHes, and zero shopping-item POSTs. All API traffic was
  intercepted and external requests were blocked.
- The browser fixture reported two pre-existing Dashboard errors from empty
  mocked GET fallbacks before entering Shopping; no Shopping-path error blocked
  the journey. An existing release-notice overlay partly covers screenshots.
- Development was restarted with automatic maintenance suppressed. The existing
  startup verifier passed its initial 14 policy/guard checks, then stopped on an
  outdated assertion expecting the database keepalive to be unguarded. The actual
  keepalive is SELECT-only and already guarded; that unrelated verifier was not
  changed.

Offline artifacts are in
`generated-artifacts/smart-shopping-catalog-investigation/`.

To repeat the focused regression suite without credentials or network access:

```sh
env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test \
  OPENAI_API_KEY=offline-test SESSION_SECRET=offline-test \
  DATABASE_URL=postgresql://offline:offline@127.0.0.1:1/offline \
  NODE_OPTIONS="--require=$PWD/tests/fixtures/shoppingOfflineNetwork.cjs" \
  node node_modules/jest/bin/jest.js --runInBand \
  --globals='{"ts-jest":{"isolatedModules":true,"diagnostics":false}}' \
  server/tests/shoppingFindProductIntegration.test.ts \
  server/tests/productDiscoveryFoundation.test.ts \
  server/tests/shoppingProductSelection.test.ts \
  client/src/lib/__tests__/smartShoppingProductPicker.test.tsx \
  client/src/lib/__tests__/smartShoppingOriginTransfer.test.tsx \
  client/src/lib/__tests__/shoppingProductChoice.test.ts \
  client/src/lib/__tests__/shoppingMetadataStore.test.ts \
  client/src/lib/__tests__/groceryCoachMealCatalog.test.tsx \
  client/src/lib/__tests__/mealShoppingFlow.test.tsx
```

## Founder testing

Live lookup calls the existing paid recommendation provider. Choose, Change and
Clear save account data. These steps require separate authorization and should
use a designated test account, not unapproved customer records.

After that authorization:

1. Open Development `/shopping-list-v2`.
2. For a generic packaged ingredient such as olive oil, tap **See Product Options**.
3. Check the personalized explanation and sourced product information. Choose
   should appear only for an eligible exact product; fewer than three is valid.
4. Choose an option. Confirm no extra list row appears and the original amount,
   unit and recipe associations remain unchanged. Reload and check the choice.
5. Use **Change** for a different eligible option, then **Clear**. Reload again.
6. Open an existing Product Scan branded row. Opening/cancelling alternatives
   must not replace it. Only an explicit eligible choice changes its reference.
7. Check a profile requiring unavailable verification: read the stated reason;
   no Choose action should appear for a review-only product.

Missing reviewed profile-specific policy or missing exact catalog evidence can
still leave zero eligible choices. Suggestions, Add/Save actions, and marketing
claims do not resolve those gaps.
