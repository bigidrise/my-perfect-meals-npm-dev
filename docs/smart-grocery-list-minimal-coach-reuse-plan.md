# Smart Grocery List — minimal Grocery Coach reuse

## Scope: investigation and implementation plan only

No implementation is approved by this document. No code, database, workflow,
environment, recommendation rule or deployment change was made. No product search,
AI request, authenticated account operation or database query was performed.

The authenticated Neon save/update/refresh verification remains outstanding.
The pairing-test account remains UNVERIFIED for live persistence testing.

## Recommendation

Reuse the **existing Development catalog branch** of Grocery Coach's product-advisor
API. Reuse its lookup/card UI in a small shared picker, opened by an explicit
shopping-row action. Do not reuse the legacy AI brand advisor as product evidence,
build a third recommendation engine, or redesign the shopping list.

The catalog branch is reusable, but copying its current UI/response unchanged
would not meet the full structured-persistence and evidence requirements.

## Reusable components and APIs

| Existing piece | Use |
|---|---|
| `client/src/components/shopping/MealIngredientBrands.tsx` | Closest reusable picker: explicit lookup, loading/error states, up to three cards, source/ingredient/nutrition/review display, choose and clear callbacks |
| `client/src/lib/groceryCoachPackagedIngredients.ts` | Existing packaged-product button eligibility and product label formatting |
| `client/src/components/shopping/GroceryStoreCoachSheet.tsx` | Existing catalog card contract and Grocery Coach integration; not a replacement shopping-list screen |
| `POST /api/grocery-coach/product-advisor` | Reuse with one full ingredient query and `mode: "find_product"`; Development branch only |
| `server/services/productDiscovery/findProductDevelopment.ts` | Existing bounded discovery, exact catalog identity checks, known-conflict screening, current-profile resolution and at-most-three presentation |
| Existing discovery adapters/evaluator | Reuse USDA/Open Food Facts sourcing and evidence evaluation unchanged |
| `client/src/stores/developmentShoppingListStore.ts` | Existing `updateItem`, queued persistence, account partitioning, error state and contribution preservation |
| Existing classic POST and V2 GET/PATCH | Existing Development metadata persistence; no new shopping endpoint or schema migration needed |
| `shared/shoppingIngredientMetadata.ts` | Existing selected-product, provenance, review context and original-contribution contract |

The picker is currently inline and meal-specific, not an existing standalone
product modal. Reuse requires extracting only its lookup/card section and wrapping
it in the application's standard modal conventions. Do not embed the entire
Grocery Coach sheet or launch its meal-generation/Favorites workflow.

The current button classifier already covers sauce, cream cheese and many packaged
foods; broccoli and ordinary eggs remain generic. It does not currently recognize
plain “milk,” although it recognizes several plant milks. A small classifier
extension for plain milk is needed to cover the requested example. This classifier
only controls button visibility; it must never decide medical suitability.

## Why not use the older advisor?

The same API without Development `mode: "find_product"` calls
`ProductAdvisorEngine.buildCartRecommendations()` in `server/services/productAdvisor.ts`.
That path uses AI-generated brand recommendations and contradiction screening.
Its own code distinguishes screening brand text from verifying product ingredients
and can reject protected-profile requests when ingredient evidence is unavailable.

Its brand names/grades/reasons are not an exact package identity, sourced nutrient
measurement, formulation proof or clinical approval. It must not become a fallback
when catalog evidence is insufficient.

## Evidence and integration gaps

### 1. A profile-matched card is not necessarily evidence-cleared

The catalog response has separate `recommendationStatus` and `evidenceStatus`.
A `profile_matched_pick` can still have `needs_verification` evidence and unresolved
policy. The existing meal picker also allows choosing review-needed products for
shopping. Those facts must not be relabeled as medical approval in the new modal.

For the smallest conservative Smart Grocery integration:

- Selectable recommended options require the existing evaluator's eligibility,
  resolved relevant policy and support for all applicable original-ingredient
  requirements.
- A “Profile-Matched Pick” alone is insufficient.
- Review-needed candidates must not be counted as approved choices. Initially,
  omit them from the selectable recommended list and show an explanatory review
  message where useful.
- With no sufficiently supported options, keep the ingredient generic. Do not
  invent replacements or pad the modal to three choices.

This is a display/selection boundary around existing decisions, not a new evaluator
or a change to Grocery Coach's ranking.

### 2. Reviewed clinical product policies are incomplete

The Development catalog registry currently has **no reviewed hard product rules**.
Its policy resolver leaves clinical/hazard authority and missing rule-specific
evidence policies unresolved. Current-profile resolution and known-conflict
screening are useful, but cannot independently establish a clinical nutrient limit.

Consequently, protected cases may have no selectable evidence-cleared products.
No sodium, fat, carbohydrate, allergy-certification or formulation-freshness
threshold should be added in this interface task. Source observation dates also
do not prove the formulation of today's physical package.

If the product requirement is clinically cleared choices for every supported
condition, that is blocked by reviewed-policy availability, not by modal design.
It remains outside this minimal interface plan.

### 3. Original ingredient qualifiers are not yet decision inputs

The existing catalog request accepts a search string, not the shopping metadata's
explicit ingredient/request requirements. Searching for “low-sodium soy sauce”
does not itself prove that a returned product satisfies the original qualifier.

The minimal contract bridge must preserve those requirements and bind selection
to the existing evaluator's reviewed evidence policy. If an applicable qualifier
cannot be assessed by that policy, return a review-required explanation rather
than assert compliance. Do not implement new rules by keyword, AI assertion or
UI-only numeric cutoffs.

### 4. The current catalog response is a display projection

The discovery engine internally has richer candidate identity/facts and evaluation
context. The current `DevelopmentProductMatch` response retains product key,
brand, barcode and source record, but omits fields needed for lossless structured
storage, including exact variant/package details, full per-fact provenance,
numeric measurement/basis and complete evaluation context.

The smallest backend adjustment is an optional structured selection payload on
the **existing Development response**, projected from the already evaluated
candidate and decision into the existing shopping metadata schema. Do not parse
display sentences back into nutrient facts, invent absent source dates, or
convert `profile_matched_pick` into `eligible_at_evaluation`.

The current Grocery Coach add-to-list handler also flattens a picked product into
display text/notes. Reuse its lookup and cards—not that transfer transformation.
Smart Grocery must update the original row's structured metadata directly.

### 5. Existing access and subject boundaries remain authoritative

The Grocery Coach router is mounted behind `requireAuth` and `requireProAccess`.
Shopping access is broader. Preserve that gate: make the new action available to
entitled users or use the existing action-level upgrade prompt without navigating
away. Do not call another endpoint to bypass Pro access.

The current catalog lookup resolves the authenticated account owner. It is not a
delegated client/household product service; implicit active-household context can
be unresolved. The minimal integration must stay account-owner scoped and never
evaluate another person's shopping ingredient against the actor's profile.

### 6. Reusing this endpoint is not necessarily AI-free

The catalog path can call its existing interpretation helper for eligible products.
It is sourced discovery, not just the old AI advisor, but it may still make AI
calls. The interface must initiate none on page load, hydration, row rendering
or opening an unrelated control. One explicit Choose Product action initiates one
existing lookup; do not add an extra model call or automatic retry/search loop.

## Minimum UI and persistence changes, if approved

1. **One small row action.** Add Choose Product only for eligible unchecked packaged
   ingredients. Preserve the list layout, checkboxes, editing, deletion, quantities
   and retailer actions. Selected items use Change/Clear.
2. **One modal.** Show the original ingredient and recipe quantity, local loading/
   error state, and zero to three supported choices using the extracted existing
   cards. Include Keep generic and Cancel. Closing/canceling never changes a choice.
3. **One explicit saved selection.** On Choose, use the existing store update path
   to set only the selected-product metadata. Preserve the original ingredient,
   individual source quantities/units and recipe contributions. Store assessment
   as historical evidence, never permanent suitability.
4. **One secondary label.** Display the chosen brand/product beneath the unchanged
   ingredient, with any saved review qualification. Do not replace the recipe
   amount with a package/retail amount. Keep that label visible for checked rows.
5. **Change and clear.** Change opens a fresh user-initiated lookup. Clear/Keep
   generic explicitly stores `selectedProduct: null` while retaining the ingredient
   and contributions. Cancel preserves the prior selection.
6. **Respect consolidated identities.** A displayed row may represent several
   underlying IDs. Apply the choice to those intended compatible rows, preserving
   each row's own quantity and contributions—not the consolidated amount copied
   into every row. Do not falsely report group success if an underlying save fails.
7. **Reuse existing failure protection.** Respect target-API metadata capability,
   account partitions and persistence error handling. Discard lookup results after
   account/row/profile changes or modal dismissal. No automatic search on refresh.
   Old saved choices remain historical; displaying one is not revalidation.

A short focused verification pass should cover no calls on list open, selective
button visibility, empty/unavailable/blocked lookup outcomes, cancel/generic/
choose/change/clear, qualifier/evidence mapping, account changes and consolidated
row quantities. Use isolated fixtures; keep authenticated Neon verification
explicitly outstanding. Do not reuse the unresolved pairing identity for writes.

## Approval boundary

The narrow implementation would consist of a shared existing-choice picker, a
shopping modal/row connection, a small Development response-contract bridge and
focused regression coverage. No third engine, new clinical-rule system, provider
change, ranking redesign, library auto-save, migration or Production release.

No implementation was performed. Stop for approval.
