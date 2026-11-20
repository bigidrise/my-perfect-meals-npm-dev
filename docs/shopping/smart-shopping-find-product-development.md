# Smart Shopping: Find a Product integration

## Current permission: unverified shopping references

The founder approved a separate Development-only shopping-reference workflow.
A reference records the customer's intended exact product, **not** medical,
dietary or restricted-diet clearance. The older view-only descriptions below
document the verified-selection phase; they do not prohibit the new distinct
reference action.

- Eligible products retain **Choose for My List** and the unchanged verified
  parser. Review-needed exact products may instead offer **Use as shopping
  reference**, followed by explicit confirmation and every unresolved warning.
- A reference requires independently bound exact recommendation/catalog
  identity, trusted current source identity and matching account/ingredient.
  Unconfirmed variants, stale identity and known conflicts remain excluded from
  the reference action. Missing avoidance verification stays unresolved.
- References persist with `selectionKind: unverified_shopping_reference` and
  `assessment.status: review_required`; they cannot pass the verified parser.
  Source snapshots and unresolved warnings remain attached. The saved row says
  **Shopping reference — Unverified**, with Change/Clear and its review warnings.
- Both actions use the existing row's metadata PATCH path. No new row, quantity,
  recipe contribution, library save, migration or lookup is created by choosing.
  Grocery Coach's existing Add/Save actions remain unchanged. Its shared heading
  retains its default badge; Shopping uses the neutral **Shopping options**.
- The Production recommendation entry point remains disabled and the Production
  PATCH route explicitly rejects the new reference payload.

Offline verification passed **395 regression tests across 11 suites**, plus the
new Production rejection test using the actual route handler with synthetic
storage. Tests compose the real unresolved-profile service response, both
parsers, metadata projection and list store; preserve identity/warnings through
save, reload, Change and Clear; and reject conflicts, variant/account/ingredient
substitution, warning removal and attempted eligibility upgrades.

No live paid-provider calls or real-account writes were authorized or performed.
An offline fixture does not prove any particular real recommendation has an
exact source identity; missing identities remain nonselectable by design.

The final isolated browser attempt recorded **34 passed / 4 failed assertions**.
It confirmed the actual parent/store flow with the server-composed unresolved
response: three reference actions, explicit confirm/cancel, unchanged saved source
payload, reload, Change, Clear, exactly three metadata PATCHes to the same row,
unchanged quantities/contributions and zero Shopping creation POSTs.
The four failures count advisor lookup POSTs as writes or require below-fold
recommendation actions to be in the viewport alongside the active confirmation.
Confirm/Cancel were 44px and hit-testable at 320/1440px; the narrow screenshot
shows both visible after scrolling. This is **not a fully green browser suite**;
raw failures and their post-run classification are preserved. Two earlier
fixture-only attempts stopped on mismatched synthetic identity; no account
guards were relaxed and the service payload was not rewritten.

The main preview was restarted and its served picker/parent modules independently
confirmed to contain the reference action and save callback. Strict safety types
passed, including the new shared contracts. The release type gate remains blocked
by the same pre-existing 109-diagnostic fingerprint; no baseline was changed.

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
- Shopping now renders the actual exported `BetterAlternativesSection` used by
  Grocery Coach's `IngredientIntelligenceSheet`, not a similarly styled copy.
  The original recommendation objects, ordering, explanations and educational
  context survive the response. Known-conflict recommendations are excluded
  before presentation, including when their catalog records were rejected.
- A narrow `renderAction` slot replaces both default Add and Save actions in
  Shopping. Grocery Coach retains its default actions unchanged. Shopping does
  not mount `RecommendedProductActions` or invoke its saved-grocery operations.
- Each visible recommendation has a separate verification result linked to an
  exact catalog `productKey`. A separate `catalogProductKey` allows reviewing
  sourced identity and label facts without granting selection permission.
  The client independently checks its matching
  recommendation lead, evidence status, display status, structured selection,
  product key, verified recommendation variant and original ingredient signature
  before exposing **Choose for My List**. Exact binding preserves all named
  brand/product/variant/package terms, apart from punctuation, case and spacing.
- Missing exact records or incomplete checks produce Review only, with no
  selection capability. A catalog outage preserves the personalized cards as
  review-only instead of hiding the successful recommendation result.
  Known conflicts stay excluded. No rules are relaxed to reach three choices.
- Catalog-backed ingredients, nutrition and allergen details remain explicitly
  separate from the AI's personalized recommendation explanations.
- Existing `chooseProduct` persistence patches the selected reference on the
  existing source rows. Ingredient, quantity, units, ownership and recipe
  contributions remain unchanged; no item is created.
- New standalone Development Find a Product imports retain historical product
  identity using the existing transfer helper. This does not approve the product
  or backfill legacy rows. Existing branded references change only explicitly.

## Direct row-to-service verification

The existing direct connection is retained. This shared-component integration
changes the presentation and response adapter, not the recommendation engine.

1. `ShoppingListMasterView.openProductPicker` captures the selected row's original
   ingredient, source-row IDs, quantity label, existing choice and account/profile
   session identity.
2. `ShoppingProductPicker` makes one explicit
   `POST /api/grocery-coach/product-advisor` with `mode: "find_product"`,
   `ingredients: [originalName]`, and the original structured
   `shoppingIngredient`. It has no search textbox or Add/Save action.
3. The authenticated, Pro-gated router selects
   `findShoppingProductRecommendationsDevelopment`, whose default path invokes
   the existing `analyzeProductByName(originalName, authenticatedUserId)`.
4. Grocery Coach's existing Find a Product instead enters through
   `POST /api/biometrics/ingredient-scan-by-name`; that endpoint calls the same
   `analyzeProductByName` service. Its saved-profile loading and recommendation
   prompts are reused unchanged.
5. Existing evidence adapters and `shoppingSelectionBridge` verify exact
   products independently. The response includes the original `recommendations`,
   separate `recommendationChecks`, and `recommendationContext`.
   `ShoppingProductPicker` renders `BetterAlternativesSection` with its Shopping
   action adapter. `ProductCatalogChoices` remains only a backward-compatible
   renderer for older responses that lack the recommendations field entirely.
6. Choose uses `commitProductChoice` and the existing store `chooseProduct`
   update, never Grocery Coach Add/Save. No new endpoint was introduced.

Regressions cover both olive oil and an existing branded row being forwarded
without reentry, the service's default delegation with the authenticated subject,
complete recommendation-object preservation, default Coach Add/Save presentation,
and fail-closed Shopping actions for mismatched or missing evidence. The existing
list-row responsive corrections and persistence handlers are unchanged.

Synthetic recommendation outcomes:

| Fixture | Visible options | Selectable |
| --- | ---: | ---: |
| Resolved profile and complete matching evidence for Synthetic Alpha/Beta/Gamma Olive Oil | 3 | 3 |
| Same sourced products, required profile-specific checks unresolved | 3 review-only | 0 |
| Known explicit ingredient conflict | 0 | 0 |
| Required exact-record ingredient facts missing | 3 review-only recommendations; no catalog-backed choices | 0 |
| Catalog unavailable after recommendation generation | 3 review-only recommendations | 0 |

Review-only recommendations retain personalized explanations but no Choose.
Unverified AI recommendations are clearly review-only, not catalog-backed choices. These
fixtures are not live customer recommendations.

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
| Integrated targeted lookup | 3 | 43 ms |

The recommendation was mocked in this experiment. Live AI/catalog latency and
catalog coverage have not been measured or claimed.

## Verification

- 385 focused tests passed across eleven suites for the shared-card integration
  and evidence-first corrections.
  This includes complete objects, the shared card's default Coach actions,
  eligible/review-only Shopping states, mismatched identity/ingredient rejection,
  known-conflict exclusion and catalog outages.
- Strict safety type gate passed.
- Full release typechecking returned 109 diagnostics with fingerprint
  `e49b8f2b61d299d3c277e6b1f426af4624c1f957d46556e94673400f8ed96fe3`,
  exactly matching the older `integration-types.log` captured before this
  integration. It still FAILS the reviewed baseline fingerprint
  `9baf1a0a477bef598b2c7b9afaba2624c41cae19a7705ee30f43ceeeab873ef3`.
  The baseline was not refreshed. This is not a clean release type gate.
- The initial shared-card mobile browser report recorded 72 passing checks and seven
  failed assertions. Several failures are fixture assertion mistakes, and an
  explanation visibility check was unresolved. Do not describe it as a clean
  acceptance pass. Synthetic Choose, reload, Change and Clear produced three
  metadata-only PATCHes, zero shopping-item POSTs and no duplicate olive row.
  All API traffic was intercepted; external traffic and unknown writes were
  blocked. No real-profile eligibility was established.
- The targeted evidence-correction follow-up recorded 53 passing checks and two
  overlap-heuristic failures caused by counting content inside closed native
  details panels. The corrected test was not rerun. Visual inspection of the
  320px and 375px captures confirms readable, non-overlapping collapsed cards.
  Do not report this as a fully green browser suite. Functional checks passed for
  **Choose for My List**, reload, Change, Clear, original quantities/contributions,
  no duplicate rows, inspectable quinoa-unresolved evidence, and a nonselectable
  mismatched variant. Only the designated synthetic row received three metadata
  PATCHes; there were zero shopping POSTs or real backend writes.
- The tester inadvertently ran imported older responsive tests before narrowing
  its filter, overwriting `smart-shopping-responsive/before/` generated captures
  and the generated isolation-probe output with current-source captures.
  Those files must no longer be treated as the original BEFORE baseline.
  Application source, original protected-source hashes and baseline source
  copies were not changed by this mistake.
- Development was restarted with automatic database maintenance suppressed.
  The real preview boots and serves the updated picker module. The unauthenticated
  screenshot correctly reaches sign-in, not a verified live Shopping session.

Offline artifacts are in
`generated-artifacts/smart-shopping-shared-cards/`; historical integration
artifacts remain in `generated-artifacts/smart-shopping-catalog-investigation/`.

## Real-profile Review only investigation

The founder reported marinara cards blocked by an unresolved quinoa avoidance.
Code tracing establishes that the Development catalog policy has no reviewed
hard-product rules installed. Explicit avoided foods become hard requirements,
and the default product-specific assessor cannot supply a verified pass.
`shoppingSelectionBridge` correctly rejects the unresolved decision. This is
a missing verification capability, not proof that quinoa is present, and not
evidence that the Choose renderer suppressed an eligible Rao's product.
Successful empty-hard-rule synthetic fixtures do not establish real-profile
eligibility.

The two confirmed adapter gaps are corrected: review-only checks now retain a
separate non-selectable catalog reference and expose native expandable source
identity/label details; selection now requires exact recommendation identity and
variant binding in addition to all existing product/profile checks. Broad token
containment remains retrieval relevance only. A different size or variant is
review-only, never silently selected as the named recommendation.

There is no installed trusted product-avoidance assessor or reviewed current-label
ingestion path to wire into the current policy. That missing capability was NOT
replaced with a guessed policy. The actual Rao's source record/variant was not
independently fetched. The quinoa hold remains unresolved: a catalog ingredient
list not mentioning quinoa does not supply the missing reviewed verification.
Offline tests cover absent mention, positive ingredient conflict, exact eligible
variants, ambiguous variants and inspectable review-only source records.
Near variants are downgraded before the eligible-result budget is counted, so
they cannot exhaust the three-result target and conceal exact variants later in
the same bounded search.

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
   client/src/lib/__tests__/mealShoppingFlow.test.tsx \
   client/src/lib/__tests__/smartShoppingRejectionExplanation.test.tsx \
   client/src/lib/__tests__/savedGroceriesSelection.test.tsx
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
