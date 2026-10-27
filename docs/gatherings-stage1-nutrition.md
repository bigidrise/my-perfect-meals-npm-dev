# Gatherings Stage 1 — Development nutrition pilot

## Scope
Undeployed Development only. No migrations or saved-meal backfills. Profile
personalization remains unchanged. Event-specific diet/cuisine selectors have
been removed from the roadmap at the user's direction; do not introduce them.
Stages 2–4 need separate approval.

## Calculation and limitations
Reuse the existing USDA ingredient adapter and Dessert quantity/gram helpers.
All four core nutrients must be known for every ingredient. Recipe totals remain
unrounded; display/logging divides by the saved recipe yield exactly once.
Unknown starch/fibrous categories stay absent, not zero.

Use compatible USDA portions for volume/count; never generic cup-to-gram weights.
Unknown ingredient identity, preparation form, or quantity needs review. Missing
composition/source failures are unavailable. There is no AI/default macro fallback.

## Completion audit and saved recipes
The Development route clears upstream nutrition before merging the ingredient
estimate. An unresolved estimate cannot accidentally preserve an AI vector.
Successful calculations now emit the v2 contract: complete ingredient-source
coverage and a consistency signature binding ingredients, quantities, recipe
name/instructions, saved yield and recipe macro totals. This is cache integrity,
not cryptographic authentication or clinical clearance. Older v1/legacy caches
must regenerate; no saved rows are migrated or backfilled.

Gatherings cards, restored cache cards, Favorites rows and the Favorites picker
apply the same scoped validity predicate. Unverified identifiable Gatherings
remain readable/removable in Favorites, but numeric displays/actions are withheld.
Favorites macro/plan/share values use one portion; stored/cooking values retain
recipe totals and yield. Non-Gatherings records and published runtimes keep their
existing paths.

Historical saves without any remaining Gatherings origin/course metadata cannot
reliably be distinguished from other creators. Do not guess their origin or
claim they were audited/backfilled. Full historical repair needs separate approval.
Corrected Christmas calorie totals require complete identity/portion evidence.

Frying retention has no approved measured input contract or validated retention
table in this pilot. Fried foods, including latkes, therefore need review. Neither
100% pan oil nor zero oil is assumed. Quantified incorporated fats are counted
fully with a disclosed no-loss assumption; greasing/discarded/divided fat remains
unresolved. There is no unsupported absorption coefficient.

Energy disagreement beyond max(20 kcal per serving, 10% of source energy) requires
review. This is an engineering diagnostic, not a clinical threshold. USDA energy
is not overwritten with 4/4/9. Fiber/food-specific energy factors may explain a
difference but are not invented when the source evidence is absent.

## USDA budget and measured probe
One context per gathering: max 32 distinct lookups, 64 HTTP requests, 30 seconds
aggregate HTTP/body time, 6 seconds per HTTP/body operation, max 40 ingredients
per recipe. Existing adapter timeouts, positive/negative cache and source backoff
also apply. Budget excludes unrelated AI/image time; it is not a whole-generation
deadline. Cancellation covers source fetches; a defensive race bounds ignored
signals. No database cache or paid AI calls were added.

Development read-only probe: potatoes, large eggs and all-purpose flour matched;
generic apples did not. Four lookups, seven HTTP requests, 2539 ms aggregate source
time. This is a small cold-process observation, not a latency guarantee. Missing
generic apple evidence stays unresolved; the shared adapter was not loosened.

## Regression evidence boundaries
Completion verification: 16 relevant suites / 313 unique tests were exercised.
After correcting the new Favorites-picker test mock and rerunning its affected
flow, 311 tests pass. Two unchanged serving-contract expectations still fail:
they expect daily starch allowances to block release, while the current validator
explicitly treats daily starch overages as planning/tracking guidance. Neither
the policy nor those tests were changed for Stage 1.

The frontend build passes. The release type gate still fails on the same
114-diagnostic fingerprint observed before this completion pass, against a
120-diagnostic stored baseline. No new diagnostic fingerprint or baseline refresh
was introduced. Development was restarted once and its public welcome page
rendered. Saved recipe interaction verification used actual React components with
mocked account/feed/network dependencies, not an authenticated live browser save
or paid recipe generation. These checks do not establish Production readiness.

The user supplied the actual Christmas soup/cake ingredient lists and a yield of
six. These are preserved verbatim in the Christmas regression fixtures. Cooking
instructions were not supplied. Soup ambiguities include shell-on versus edible
clam weight, dashi composition, wakame hydration state, and unsized green onions.
Cake evidence must distinguish coconut milk formulation and compatible flour/
milk portion weights. Tests prove unresolved food/portions cannot fall back to
the old 20/35-calorie vectors or silently omit ingredients; synthetic source stubs
isolate failure paths only, not corrected nutrition. No complete source-backed
recalculation of these historical recipes is claimed.

The exact historical Hanukkah latke ingredients remain missing. Its existing
fixture is explicitly synthetic and proves unknown frying oil cannot produce
fabricated numeric nutrition.

## Stage 3 finding only — internal prompt exposure
The universal generator's missing-description fallback embeds the complete course
prompt in the returned description. Its missing-name fallback can also display
the first response line, including refusal prose. A refusal without the expected
format can therefore expose generation directives in a normal card. This is a
confirmed code path. The user's subsequently supplied Christmas ham display also
confirms a refusal was rendered as the meal name with internal course instructions
in its description. The shown 67 kcal / 4g protein / 5g carbs / 3g fat matches the
generator's default 400/25/30/15 vector divided by six and rounded, not a calculated
ham recipe. Do not persist the accompanying private profile/protocol text in test
fixtures or repeat its medical details. Stage 1 does not redesign or fix prompt/
refusal handling.

## Rollback
Revert this focused integration; never promote unverified numeric caches to the
new calculation version. Prefer explicit unavailable nutrition over restoring
trusted-looking AI/default values. Keep other generators and profile workflows
unchanged; release/publishing requires separate authorization.
