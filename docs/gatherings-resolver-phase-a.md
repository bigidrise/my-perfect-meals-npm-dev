# Gatherings bounded USDA resolver — Phase A

## Decision

**Do not integrate.** Fully quantified coverage remains **14/31 occurrences**;
complete-recipe coverage remains **0/3**. The explicit Phase B prerequisite of
meaningful complete-recipe improvement has not been demonstrated.

The prototype is not imported by an application route or other generator and
refuses to run outside undeployed Development. This is an isolated validation
result, not a release or nutrition-completeness claim.

## Design

- Preserve original ingredient text, amount, unit, and preparation.
- Separate food identity, cutting form, and material descriptors. Cutting words
  may be removed from a search, never from the original ingredient evidence.
- Retain state, cultivar, hydration, peel, roasting, and formulation qualifiers.
- Require token-equivalent source descriptions for newly discovered candidates,
  without fuzzy ranking or arbitrary selection between multiple matching IDs.
- Reuse the existing USDA adapter's exact detail verification, composition parser,
  positive/negative cache and backoff; reuse actual observed search responses
  rather than issuing a duplicate exact-description search.
- Reuse existing Gatherings budgets and the Dessert gram converter. Explicit
  cutting/ground forms require matching portions. Unqualified volume is allowed
  only when the composition record itself establishes that form.
- Verify required nutrients/provenance; preserve `needs_review` / `unavailable`.
- Complete-recipe checks still use the existing estimator, including frying,
  incorporated-fat, full-coverage, yield, and energy-consistency guards.

No active matcher, mappings, generator, profile, medical, allergy, religious,
or dietary rules changed. No AI calls, paid services, app restarts, database
operations, migrations, publishing, or GitHub operations were performed.

## Live comparison

Two separate cold-process, sequential probes used the same three actual supplied
Christmas lists, their stated yield of six, and no invented instructions.
Observed 2026-10-27, 04:01 UTC. Every observed HTTP response was 200.

| Recipe | Before | After | Complete nutrition |
|---|---:|---:|---|
| Japanese Salmon Sashimi with Wakame Salad | 2/11 | 2/11 | No |
| Honey Glazed Ham with Miso and Ginger | 4/9 | 4/9 | No |
| Japanese Sweet Potato Pie (Satsumaimo Pie) | 8/11 | 8/11 | No |
| **Total** | **14/31** | **14/31** | **0/3** |

The two fresh-ginger occurrences now identify USDA **169231, Ginger root, raw**.
They still cannot be quantified: that record does not establish compatible
chopped/grated tablespoon weights. Identity coverage is not numeric coverage.

| Measurement | Baseline | Phase A |
|---|---:|---:|
| Actual network requests | 39 | 37 |
| Actual network/body time | 15.658 s | 14.266 s |
| Whole probe elapsed | 15.682 s | 14.306 s |
| Existing-context lookup attempts | 28 | 28 |
| Reused actual search responses | — | 3 |

The Phase A underlying lookup context counts 40 transport invocations, including
three reused responses; **37**, not 40, reached USDA. These are observations, not
latency guarantees or evidence that network variability has been eliminated.
All configured request/time/lookup limits remained in place.

## All 17 remaining occurrences

| Ingredient | Occurrences | Reason |
|---|---:|---|
| Sashimi-grade salmon | 1 | Species identity unspecified; grade is not composition evidence. |
| Rehydrated wakame | 1 | Hydrated composition/yield not verified. |
| Thinly sliced cucumber | 1 | No candidate passed identity/state verification; no peel/state inference. |
| Thinly sliced red onion | 1 | No candidate passed identity/state verification. |
| Rice vinegar | 2 | No candidate passed the bounded identity/state checks. |
| Soy sauce | 2 | No candidate passed identity/formulation checks; no shoyu/tamari substitution. |
| Mirin | 1 | No candidate passed identity/formulation checks. |
| Toasted sesame seeds | 1 | No candidate passed identity/preparation checks. |
| Finely chopped fresh ginger | 1 | Identified source; compatible chopped volume weight missing. |
| Bone-in ham | 1 | Gross bone-in mass is not established edible mass. |
| Grated fresh ginger | 1 | Identified source; compatible grated volume weight missing. |
| Plain sesame seeds | 1 | No candidate passed the exact food/form checks. |
| Japanese sweet potatoes, peeled and cubed | 1 | Cultivar/edible form not source-verified; no generic sweet-potato substitution. |
| Coconut milk | 1 | Formulation unspecified. |
| Toasted chopped walnuts | 1 | No candidate passed identity/preparation checks. |

These are failures of the bounded verification procedure, **not claims that USDA
has no records for these foods**. Testing more generous equivalence policies or
collecting clarification requires another decision, not silent relaxation.

## Verification

- 159 unique tests passed across seven relevant suites, including 38 isolated
  Phase A cases. HTTP tests use captured public source records and simulated
  transport; their timings and coverage are not presented as live measurements.
- Negative tests cover raw/cooked, peel, cultivar, sauce formulation,
  raw/toasted, physical form, missing nutrients, changed detail IDs,
  ambiguous candidate IDs, incompatible portions, HTTP 403/429/503, ignored
  cancellation, lookup limits, and Development/deployment isolation.
- No false-positive or unsafe identity match observed in the live accepted
  results or tested negative cases. This is not a universal correctness claim.
- Isolated source/script/test typecheck: zero diagnostics.
- Root release type gate remains blocked by 114 existing diagnostics versus its
  stored 120-diagnostic baseline; no baseline was refreshed.
- No browser journey or paid meal generation was needed: the app route is unchanged.

### Reproduce the read-only probes

```sh
NODE_ENV=development node_modules/.bin/tsx scripts/probe-gatherings-resolver-phase-a.ts baseline
NODE_ENV=development node_modules/.bin/tsx scripts/probe-gatherings-resolver-phase-a.ts normalized
```

Run in separate processes to avoid sharing the adapter's process-memory caches.
Each emits JSON containing per-occurrence outcomes, source provenance, conversion,
request counts, and timing. Redirect to `/tmp` or the already-ignored
`generated-artifacts/` directory, not Git-tracked source.

## Exact changed files

1. `server/services/gatheringsIngredientNormalization.ts` — new isolated normalizer.
2. `server/services/gatheringsIngredientResolverPhaseA.ts` — new isolated verifier.
3. `server/tests/gatheringsIngredientResolverPhaseA.test.ts` — regression coverage.
4. `scripts/probe-gatherings-resolver-phase-a.ts` — read-only comparison tool.
5. `docs/gatherings-resolver-phase-a.md` — this report.
6. `.agents/memory/gatherings-nutrition-scope.md` — preserve the separate-approval boundary.

**Stopped after Phase A. No integration is recommended from these results.**
