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
The exact historical Hanukkah latke and Christmas soup/cake ingredient lists are
not present in the attachments or retained Development logs. The latke fixture
is explicitly synthetic; it proves unknown frying oil cannot produce fabricated
numeric nutrition. Do NOT label invented soup/cake recipes as the user's fixtures.
Actual ingredient-list regression fixtures remain pending the user's source data.

## Stage 3 finding only — internal prompt exposure
The universal generator's missing-description fallback embeds the complete course
prompt in the returned description. Its missing-name fallback can also display
the first response line, including refusal prose. A refusal without the expected
format can therefore expose generation directives in a normal card. This is a
confirmed code path, not proof of the exact Christmas ham response (not retained).
Stage 1 does not redesign or fix prompt/refusal handling.

## Rollback
Revert this focused integration; never promote unverified numeric caches to the
new calculation version. Prefer explicit unavailable nutrition over restoring
trusted-looking AI/default values. Keep other generators and profile workflows
unchanged; release/publishing requires separate authorization.
