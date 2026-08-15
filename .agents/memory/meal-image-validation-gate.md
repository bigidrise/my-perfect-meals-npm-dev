---
name: Meal image recipe-fidelity gate
description: Cache policy for AI-generated meal images — validation gates both cache writes AND cache reads
---

# Meal image recipe-fidelity gate

Rule: an entry in the meal image cache means "generated for this exact recipe contract and passed (or auditable-skipped) vision validation." Both sides are enforced:
- **Writes:** vision-validate against the full recipe ingredient list before caching; on FAIL, one targeted retry with the named offender excluded; on second FAIL serve the semantic fallback and cache nothing (fail closed, never show the wrong image silently).
- **Reads:** every cache hit (memory and DB) re-checks servability — FAIL rows, legacy unvalidated rows, and rows whose stored recipe signature doesn't match the current request are evicted and regenerated.
- **Cache identity:** must cover the FULL normalized ingredient list, not a truncated prefix — otherwise two recipes sharing a name and leading ingredients can share a validated image without validating the second contract.

**Why:** one hallucinated image cached becomes permanent for every future user of that dish; gating only writes (not reads) or allowing contractless requests leaves the cache trustable in name only.

**How to apply:** any change to what the validator checks, the cache-key recipe coverage, or the servability rule must move in lockstep (and bump the cache version to flush stale entries).
