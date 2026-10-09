---
name: Release typecheck gate
description: Policy for the release-check type-validation layers — safety slice, fingerprinted baseline, and build targets.
---

## Rule

`npm run release-check` enforces four validation layers before any server smoke test:

1. Client production build (`npm run build:client`) — must exit 0.
2. Server production build (`npm run build:server`) — must exit 0.
3. Strict safety typecheck (`npm run check:safety-types`) against `tsconfig.safety-check.json` — must exit 0.
4. Root diagnostic fingerprint (`npm run check:release-types`) — passes when the root `tsc` check is either clean or produces a set that **exactly** matches the reviewed baseline in `scripts/release-typecheck-baseline.json`.

**Why:** Pre-existing TS debt must never allow a new error to be silently absorbed. Any change to the diagnostic set — rising, falling, or just a rewording — fails the gate and requires deliberate baseline refresh after review. The fingerprint also includes source line and column positions, so inserting unrelated UI lines can fail the gate despite unchanged error types and messages.

**How to refresh the baseline:** Re-run `node scripts/check-release-type-baseline.mjs` after making a focused debt-reduction change. The script will print the new fingerprint; manually update `scripts/release-typecheck-baseline.json` with the new count and sha256 values after reviewing the diff. For location-only changes, first map current diagnostic locations through the source diff to their former positions and confirm the reconstructed set exactly hashes to the prior reviewed fingerprint; only then update the baseline. Never infer equivalence from an unchanged diagnostic count alone.

**Safety slice:** Add any new safety-sensitive surface to `tsconfig.safety-check.json` before relying on the release check for that surface.

## AI smoke-test gate (section 7 of release-check.sh)

## Interrupted-check lock boundary

An interrupted release-type check can leave a temporary lock after its compiler process has ended.

**Why:** The lock prevented a later check even though no owning check or compiler was running.

**How to apply:** Verify the owning processes are absent before removing only the stale temporary lock. Never clear a running check's lock or change the reviewed diagnostic baseline merely to get past a failed gate.

### Full-root compiler memory

Use a 4 GB Node heap for full-root historical diagnostic comparisons in this workspace, rather than the smaller heap used for isolated policy checks.

**Why:** A 1.5 GB heap exhausted memory before returning diagnostics; a 4 GB heap reproduced the reviewed fingerprint from a temporary historical source snapshot.

**How to apply:** Run snapshot comparisons sequentially outside the workspace with identical dependencies and stable build-version exports. Treat heap exhaustion as a failed investigation, never as zero TypeScript errors.

### Temporary evidence lifetime

Temporary compiler-comparison files may disappear when the execution environment is recreated between tool calls, even when earlier background completion notices remain available.

**Why:** Separate capture/read attempts lost the reviewed diagnostic evidence during an environment continuation.

**How to apply:** Capture both compiler outputs, verify the reviewed fingerprint, and compare full messages and multiplicities within one command. Return the comparison before proceeding; do not approve a baseline from a truncated failure preview.

Sends an unauthenticated POST to `/api/meals/generate`. Correct response is 401 (gate reachable and auth-protected). Accepts 401/400/200 — timing-based checks are wrong here because unauthenticated probes return immediately.

## Locked-day target snapshot rule

`onSaveDay` in builder pages must snapshot the same prescription-derived targets the RemainingMacrosFooter displays — **not** `getMacroTargets()` (localStorage cache). localStorage can be absent or stale. Use `prescription?.caloriesTarget` etc. directly, and guard with `if (!prescription || nutritionStateLoading) return` before the lockDay call.
