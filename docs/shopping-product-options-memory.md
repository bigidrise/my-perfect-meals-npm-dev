# Shopping options reliability and remembered choices

## Development behavior

- Shopping options have structured shimmer placeholders, a loading heading and status text, and a reduced-motion alternative.
- Failures have an in-modal retry button. Finding new options is a separate explicit action in Shopping and Find a Product; it does not save, clear or replace the current shopping selection.
- Closing the picker or changing its account/profile/ingredient identity invalidates pending responses. A new identity cannot silently launch another lookup while the previous modal closes.
- The by-name provider request now receives its abort signal and has one bounded 20-second attempt. Errors are classified as provider unavailable, invalid response or unsupported medical claim without logging request/response contents.
- Shopping falls back from failed or empty personalized explanations to the existing governed catalog discovery, not to invented products or relaxed validation. Remembered names can seed this search; catalog identity, current subject authority and existing selection/reference checks still apply.
- Shopping catalog fallback uses the same recommendation-card renderer as Product Scan. It does not expose raw ingredient/nutrient/source/serving records. Existing explanations retain the shared green pills; missing explanations do not generate invented benefits or store availability. Label-review reasons remain visible and review-only cards remain non-selectable.

## Persistence and preference authority

The founder separately approved the additive storage change. The explicit Development migration created `user_grocery_choice_memory` and its account/ingredient uniqueness index on the established shared external database. It did not rewrite existing customer records, and it is not a startup migration.

The table stores bounded product names, an optional explicitly preferred name and timestamps. It does **not** store a cached medical approval or label evidence.

- Mere viewing records suggested names, not a preference and not a Saved Groceries bookmark.
- Explicit Shopping selections/references and qualifying Grocery Coach bookmarks remember the chosen name transactionally with the original save.
- Find a Product's explicit Add action can remember a previously offered name through an authenticated, Development-only endpoint. An unrecognized name is rejected. If this separate remember operation fails, the interface reports that the item was added but the usual choice was not remembered.
- Existing human Saved Groceries can supply a usual choice when their category exactly matches the original search. Companion records are excluded. This read does not create additional bookmarks.
- Shopping, Find a Product and Make a Meal product advice use the same remembered-intent boundary. Queries retain their original ingredient qualifiers; olive oil and avocado oil are not merged.
- Every request still resolves current context. Remembered names are passed into current assessment and only currently returned candidates are ranked; omitted candidates are never restored as if approved.
- An explicit alternatives request preserves the preferred name. No automatic selected-product replacement or live price inference is introduced.
- Memory use and preference writes are Development-only. The existing Shopping options release gate is otherwise unchanged.

## Verification

Focused offline client/server checks cover retry without closing, shimmer structure, explicit new-options requests, stale-response invalidation, account-bound names, usual-choice ordering, profile changes, unsupported medical claims, actual provider abort, catalog fallback and known-conflict negative controls.

An isolated in-memory PostgreSQL-compatible fixture executes the same additive DDL and the actual memory-store queries. It checks save/reopen, shown-versus-chosen distinction, existing Saved Groceries, companion exclusion, empty-result preservation, account isolation, rollback and foreign-key account erasure. No test connects to the shared application database or a paid provider.

The original screenshot failures are known to have returned the by-name fallback before catalog discovery. Their exact upstream cause was not retained by the old catch block and cannot be reconstructed from those logs. New failure classification and bounded request handling address that diagnostic gap; offline checks do not claim live-provider success.

The Development service was restarted under its verified safe bootstrap with automatic maintenance suppressed. An unauthenticated mobile screenshot reached the normal sign-in landing page; it does not establish signed-in visual or live-account save verification.
