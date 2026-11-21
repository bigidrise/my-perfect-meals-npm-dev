# Shopping Save and Choose — Development scope and evidence

## Approved customer-facing correction

The founder rejected the initial acceptance because actual recommendation cards
still hid Choose when the suggested name did not bind exactly to a catalog
package/variant, and the availability line remained too dark.

The correction is limited to:

- Expose the explicit **Choose Product** action in the recommendation renderer.
  Existing verified choices keep the same persistence. Existing permitted
  unverified choices keep confirmation and all warnings.
- If a suggestion does not exactly match a source listing, do **not** relax the
  recommendation-identity matcher or claim that the suggestion is verified.
  In Development, the unchanged reference bridge may instead authorize an
  explicit review of the independently identified **actual catalog product**.
  The confirmation states that this is not a confirmed match for the suggested
  name and shows the actual product/variant/package that would be chosen.
  Known conflicts, invalid source identity and unavailable subject authority
  still cannot create a reference. Production retains its prior behavior.
- Without any authorized choice/reference, keep Choose visibly unavailable,
  show the reason and point to the existing generic/Find new options paths.
- Display the stored chosen identity as the primary Shopping row label in
  Development, including checked rows, without rewriting the original
  ingredient, edit values, amounts, recipe contributions or macro data.
- Apply `#FACC15`, medium weight and a slightly larger matching location pin
  only to Shopping recommendation availability. Keep the words, green
  explanations, other card content and non-Shopping presentation unchanged.

Correction verification uses the existing isolated app and synthetic account.
The avocado fixture now deliberately omits variant/package in its suggestion,
so it exercises the real previously missed review-only branch rather than
manufacturing a perfect recommendation/catalog match. No new test runtime,
customer-data access, paid provider or safety-status upgrade is authorized.

### Correction evidence

- **302 focused tests passed across nine suites**, including the actual
  review-only renderer, cancelled/confirmed catalog review, missing/forged
  identities, known conflicts, Production negatives, unchanged Save behavior,
  default non-Shopping presentation, gold styling and retailer handoff.
- A single isolated browser pass verified desktop 1365×900 and mobile 390×844:
  both actions were visible on the actual rendered cards; Choose opened the
  explicit not-a-confirmed-match review; cancellation did not write; confirmation
  changed the primary row to `Chosen Foods 100% Pure Avocado Oil Original`;
  reload retained it with all unverified warnings and `Needed: 2 tbsp`.
- Desktop computed style measured the availability line and 14px pin at
  `rgb(250, 204, 21)`; text weight was 500. The green explanation remained
  `rgb(110, 231, 183)`. Mobile confirmed visual legibility and no horizontal overflow.
- Actual Walmart, Instacart, Amazon Fresh and Kroger hrefs retained
  `Chosen Foods 100% Pure Avocado Oil Original`, without retailer navigation.
- A direct owner-filtered comparison of the verified isolated database against
  the original fixture snapshot found every original name, quantity, unit and
  recipe contribution unchanged after removing only `selectedProduct`.
  The chosen avocado product remained `unverified_shopping_reference` /
  `review_required`; the library retained exactly its one earlier bookmark.
- Browser evidence: desktop picker `j1jqtt`, review `39wcwj`, restored row
  `f0vzxg`; mobile picker `hkalox`, review `sck0rz`, restored row `340wbj`.
  Browser network JSON was not inspected; server contract tests independently
  assert the unconfirmed recommendation does not inherit a reference or
  eligibility, while the actual source product is reviewed separately.
- The main Development application was restarted with the correction and
  returned HTTP 200. An unauthenticated preview capture reached its normal
  sign-in screen; no customer account was used to inspect personalized results.
- The final release type gate passed against the unchanged reviewed baseline
  of 109 diagnostics. The sole added test-fixture typing error was corrected;
  no baseline or gate was weakened.

## Approved scope

Add independent product bookmarking and originating-ingredient selection to existing Shopping product cards. Keep recommendation generation, card presentation, shimmer/retry, quantities, recipe calculations, clinical governance and unrelated Product Scan/Coach flows unchanged. Preserve chosen brand, product name and variant through existing retailer searches. No GitHub push/merge, Production synchronization or publishing is authorized.

The approval and pre-implementation regression checklist are recorded in `.local/tasks/shopping-save-choose-regression-protection.md`.

## Affected contracts

| Surface | Existing contract reused | Additive adapter |
| --- | --- | --- |
| Normal recommendation cards | Current recommendation checks and strict selection/reference parsers | Independent existing bookmark action, with exact catalog identity only when the recommendation/catalog binding is verified |
| Catalog fallback cards | `shoppingDisplay`, existing `shoppingSelection`, server-issued `shoppingReference` | Bookmark action and explicit confirmed-reference control; never construct a reference from a product name |
| Saved Groceries | Existing authenticated `/api/saved-groceries`, UPC/name keys, owner-partitioned cache and refresh | Optional Shopping context retains source facts, supplied variant/package and unresolved warnings; bookmark remains unverified |
| Current shopping row | Existing selection/reference callbacks, store persistence and source-row targeting | No new write endpoint, metadata schema or amount calculation |
| Retailer handoff | Existing retailers and encoded search URLs | Only explicitly chosen products bypass generic ingredient cleanup and carry their stored identity; generic queries are unchanged |
| Release boundary | Development compile-time gate | New Shopping additions are off in compiled Production; existing Product Scan/Coach callers keep their default behavior |

## Implementation boundaries

- Save does not call the shopping-row selection callback.
- Choose does not call Saved Groceries or require a saved bookmark.
- Existing catalog eligible-choice buttons are retained, rather than replaced.
- Review-only catalog cards gain a choice only when the existing server-issued reference passes the existing strict parser, product identity and original-ingredient checks. Confirmation, cancellation and every unresolved warning remain explicit.
- Products without an authorized reference remain review-only. Hidden/rejected products, stale/wrong identities and unresolved authority are not promoted to verified selections.
- No live source claim, price, availability or retailer product URL is invented.
- Account/profile changes invalidate pending Shopping bookmark UI state. Existing failed-write and duplicate-save protections remain in place.

## Verification infrastructure

The existing separate founder Shopping instance can be launched with `--offline-product-fixtures`. The default launcher remains unchanged when the option is absent.

This option installs a test-only loader that replaces only the paid recommendation/catalog **provider inputs** with clearly synthetic records. Real authentication, subject/context resolution, product validators, recommendation-to-catalog matching, Saved Groceries routes and Shopping persistence still execute against the verified local PostgreSQL database.

Before app imports, the existing PostgreSQL guard refuses other database targets; the offline guard permits only fixed loopback PostgreSQL and self HTTP sockets and refuses external fetch. A negative check verified provider fetch was rejected locally. No shared database or customer account is used.

The isolated fixture seed uses the already-reviewed grocery-memory DDL only inside the fixed local database, plus one synthetic account and four recipe-linked ingredient rows. It does not change application storage contracts or the shared database.

## Evidence

- Focused UI verification: 128 tests passed, including the two independent actions, exact bookmark UPC/variant, unchanged Product Scan save behavior, fallback confirmation, rejected/mismatched references, all existing retailer builders, generic-query parity and Development-only behavior.
- Focused selection, safety, memory and persistence verification: 73 tests passed across six suites. Includes wrong account/ingredient rejection, warning-removal/status-upgrade rejection, known conflicts, unavailable authority, recipe-contribution preservation, reload and isolated SQL transactions/account erasure.
- Release type gate passed against the unchanged reviewed baseline.
- Product discovery and evidence-contract regression verification: 102 tests passed, including allergy conflicts, stale/wrong-variant evidence, clinical authority, unavailable sources and restriction precedence. Total: **303 focused tests passed**.
- The single isolated browser journey passed at desktop 1365×900 and mobile 390×844. Its initial onboarding blocker was resolved only through the ordinary **Explore on My Own** choice for the synthetic account; no authorization bypass or workspace/schema changes were made.
- Saved the second olive-oil product (Kirkland), reloaded and found exactly that bookmark in the existing Saved Groceries drawer. Chose the first (Synthetic Alpha) without saving it; reloaded and verified the independent list choice.
- Exercised the avocado-oil catalog fallback, chose its Kirkland product without a bookmark and verified restoration.
- Cancelled an unverified low-sodium reference without changing the row; then confirmed it and verified its unverified status and unresolved warnings after reload and in Shop Online. The library still contained exactly one bookmark.
- Inspected actual DOM hrefs for Walmart, Instacart, Amazon Fresh and Kroger: olive-oil searches retained `Synthetic Alpha Olive Oil Extra Virgin 500ml`; avocado searches retained `Kirkland Signature Avocado Oil Extra Virgin 500ml`. The generic onion still searched for `onion`.
- A direct, owner-filtered query against the verified isolated PostgreSQL database compared the complete before/after row payloads, excluding only `selectedProduct`. All original names, quantities, units and recipe contributions were deeply equal. There were three choices (one explicitly unverified reference) and exactly one independent, unverified bookmark.
- Reviewed desktop and mobile browser captures. Mobile had no horizontal overflow; controls, confirmation and warning content were accessible. Existing card markup/styles were retained; this is not a claim of a separately rendered baseline pixel-diff comparison.
- Provider fixtures are not live catalog/provider verification, and retailer URL inspection is not a purchase or stock guarantee. No external retailer navigation occurred.

## Remaining observations and release limits

- The isolated instance displays the existing workspace-discovery failure in its sidebar. Normal consumer navigation worked after ordinary onboarding. No workspace authorization or unrelated schema was changed to suppress it.
- Existing verified-choice row labels omit the variant, although the stored choice and every retailer href retain it. Existing mobile retailer cards truncate long display names, while their hrefs retain full identity. Neither presentation was redesigned.
- The project-wide incremental localization check did not pass against its adopted baseline, reporting interface/clinical review findings across 364 changed files. No comparison baseline, approval registry or exceptions were changed to manufacture a pass. New ordinary Save/Choose/Confirm labels have Spanish entries; existing clinical disclaimer wording was preserved rather than newly translated without approval.
- The release type gate passed with the unchanged reviewed baseline of 109 diagnostics; this does not claim the whole codebase is free of historical type debt.
- No GitHub push, merge, Production synchronization, publication, paid-provider call or customer-data test was performed.
