# Grocery Coach carbohydrate breakdown — Development review

## Release boundary

Development only. The new repair runs only when `NODE_ENV === "development"`.
New UI/status and board handoff behavior use the existing Development client gate.
No Production release, GitHub push/merge, database migration, historical update,
or unrelated builder change is part of this work.

## Implemented behavior

- Newly generated Grocery Coach recommendations, including the existing clinical
  and protocol retry paths, receive a carbohydrate review.
- A targeted, non-generative repair uses the unchanged owned/shopping ingredients,
  their quantities, exact USDA Foundation/SR Legacy identities, and measured
  composition/portion data. The existing USDA adapter and unit converter are reused.
- Evidence records ingredient identity, original quantity/unit, converted grams,
  source/FDC ID, retrieval timestamp, per-100g carbohydrates, category and contribution.
- Starchy sources, non-starchy vegetables and other carbohydrate sources are
  distinguished. Dietary fiber is not used. Other-source carbohydrate is not
  reassigned by subtraction.
- Full ingredient coverage is required. Missing data never becomes zero.
  A genuine source-backed zero is allowed.
- Source carbohydrate totals must agree with retained total carbs within **one gram
  absolute per recipe** for rounding. Categories must individually and jointly
  fit within total carbs. There is no percentage-based allocation or rescaling.
- Valid supplied estimates are retained when consistent with source estimates
  within the same absolute rounding allowance. Conflicting supplied estimates
  remain visible but unresolved; unrelated macros are never rewritten.
- Missing/invalid categories are repaired from the source sums. If verification
  fails, the recipe remains available with explicit unresolved/incomplete status
  and nulls for missing/invalid categories, not invented numbers.
- The finalizer independently repeats verification; browser-supplied review
  status or evidence cannot certify a new saved card.
- Favorites/Saved Meals keep the review and recipe-total values. The plan transfer
  uses one serving, with the original cooking quantities and recipe yield retained.
  The Development Grocery Coach board path bypasses the legacy guessed-category
  fallback, preserving known zeroes and unknown categories.
- Both board card renderers display the review and do not manufacture a missing
  Grocery Coach category from ingredient keywords.
- Meal-plan summary calculations retain unknown Grocery Coach categories as
  uncertain rather than substituting the legacy keyword estimator.
- Grocery Coach swaps/refinements invalidate the prior review and send the same
  ingredients/quantities through the finalizer's targeted source check. The
  resulting categories and review return to the Coach display. Changed ingredient
  quantities cannot continue displaying verification from the old evidence.

## Existing saved meals and recovery investigation

No existing records were read for repair, recalculated in place, or bulk-updated.
The existing account/signature save remains idempotent: recovering an old Favorite
returns its original ID, not an overwritten or silently replaced recipe. Its
original breakdown may therefore remain unavailable even if the new recommendation
can now be estimated. The recommendation and a recovered historical card must not
be assumed to be the same evidence version.

Options for separate approval:

1. **Explicit preview and confirm:** an authenticated, owner-scoped action reads
   the stored ingredient quantities, runs this same source-only estimator without
   writes, and shows old/new categories, evidence, and unresolved reasons. Apply
   only after confirmation, using a conditional update against the original
   record to avoid overwriting concurrent edits. Preserve every other macro.
2. **Save a reviewed copy:** show a preview and allow an intentional separate
   Favorite with an explicit parent reference, leaving the historical card intact.
   This needs a reviewed identity/idempotency design; do not simply bypass the
   existing signature protection.

Neither recovery UI nor a historical-writing endpoint is implemented or authorized
by the present change. Existing accurate values are retained.

## Honest limitations

- Source identity coverage is intentionally bounded. Unsupported brands, mixed
  sauces, ambiguous ingredient/preparation names, and unconvertible quantities
  stay unresolved; names or densities are not guessed.
- Maximum 24 ingredient rows, four concurrent source lookups, a 25-second source
  deadline, plus the existing adapter's bounded request timeouts/cache.
- Repeated ingredient names are unresolved because the existing finalizer
  deduplicates them; silently double-counting would produce false evidence.
- A disagreement in the original total carbs is not fixed by changing calories,
  protein, total carbs, fat, ingredients, or servings.
- This verifies the carbohydrate source breakdown, not an independently validated
  full nutrient panel or clinical suitability. Existing safety checks remain active.
- No paid generation or live USDA calls were made during regression tests.
  Fixtures are synthetic and never written to the shared application database.
- Authenticated live end-to-end generation still needs founder review. A separate
  no-save live USDA check succeeded for 100 g raw broccoli: FDC 747447, total
  carbohydrates 6.27 g, starchy 0 g, fibrous-source carbohydrates 6.27 g. This
  establishes adapter/quantity/repair connectivity, not broad culinary coverage.
  Automated coverage does not claim the screenshot's original record was
  repaired or that every culinary ingredient has supported source coverage.

## Verification

- Ten focused/consumer-contract Jest suites: **128 passed**, across the final
  focused run and the affected display/summary checks after the gate-import fix.
- Expanded safety TypeScript check: **passed**.
- The additional existing `groceryCoachServingBasis` suite: five tests passed;
  one failed because it still expects consumed-starch budgets to reject food.
  The unchanged current human-food validator explicitly treats daily macro/starch
  goals as tracking guidance. No unrelated enforcement policy was changed to
  satisfy that stale expectation.

Focused suites:

- `server/tests/groceryCoachCarbRepair.test.ts`
- `server/tests/groceryCoachCarbFinalizer.test.ts`
- `server/tests/groceryCoachRecommend.test.ts`
- `server/tests/groceryCoachCardSave.test.ts`
- `server/tests/weeklyBoardAddMeal.auth.route.test.ts`
- `client/src/lib/__tests__/groceryCoachCarbDisplay.test.tsx`
- `client/src/lib/__tests__/groceryCoachSavedPlan.test.tsx`
- `client/src/lib/__tests__/mealMacroContinuity.test.ts`
- `client/src/lib/__tests__/builderMacroCalculation.test.ts`
- `client/src/lib/__tests__/builderMacroDisplays.test.tsx`

## Implementation files

New:
- `shared/groceryCoachCarbReview.ts`
- `server/services/groceryCoachCarbRepair.ts`
- `client/src/lib/groceryCoachPlanHandoff.ts`
- Four new regression files listed above (repair, finalizer, display, saved-plan).

Updated:
- `server/routes/groceryCoach.ts`
- `server/services/mealCardFinalizer.ts`
- `server/routes/weekBoard.ts`
- `client/src/components/shopping/GroceryCoachMacroTiles.tsx`
- `client/src/components/shopping/GroceryStoreCoachSheet.tsx`
- `client/src/components/SavedMealRow.tsx`
- `client/src/components/AddToMealPlanButton.tsx`
- `client/src/components/MealCard.tsx`
- `client/src/components/WeeklyMealCard.tsx`
- `client/src/types/meal.ts`
- `client/src/lib/builderMacroCalculation.ts`
- `server/tests/groceryCoachRecommend.test.ts`
- `server/tests/weeklyBoardAddMeal.auth.route.test.ts`
- `tsconfig.safety-check.json`

Documentation: this review report and the existing carbohydrate-boundary project
memory note were also updated. Development was restarted; the public browser
capture loads the expected sign-in landing screen, not an authenticated meal card.
