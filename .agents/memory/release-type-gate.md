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

## Committed candidate verification

When confirming that an approved correction is included in an isolated release branch, distinguish its committed source from uncommitted worktree edits. Identify the actual tested commit and verify that the release checkout is clean.

**Why:** A Saved Groceries correction passed local checks while remaining uncommitted in the isolated checkout; the branch's committed schema still contained the old declaration. The user explicitly required the correction in the release branch, not merely in Development.

**How to apply:** Inspect the candidate's committed files as well as its working tree. Commit only the approved correction files locally before final candidate verification, preserve unrelated Development work, and keep pushing subject to separate authorization. Do not infer the cause of an external validation failure from local success alone.

## Isolated release diagnostic context

Do not import unrelated Development fixes merely to make an isolated release's TypeScript count match Development.

**Why:** Production can retain existing diagnostic causes that unfinished Development work incidentally suppresses. An isolated candidate may therefore expose inherited Production errors even when every approved Development diagnostic is unchanged.

**How to apply:** Compare the complete diagnostic sets, not just counts. Verify inherited differences against the actual Production source under the same compiler and dependencies, report the isolated candidate's actual count, and keep unrelated files and reviewed baseline gates unchanged.

## Fresh-worktree build inputs

Preflight ignored, generated build inputs before starting expensive isolated-worktree validation. A Development checkout can build successfully because it already contains generated inputs that a clean release worktree does not have.

**Why:** Isolated Saved Groceries validation reached an unresolved generated build-version import only after expensive module transformation. After generation, a successful instrumented build still slightly exceeded the earlier four-minute cutoff; active compilation had been mistaken for an inconclusive stall.

**How to apply:** Use the existing canonical build-input generator rather than inventing version exports. Preserve the customer release identity and exclude incidental tracked manifest updates from a feature-only release. Run one supervised build with resource/progress diagnostics and sufficient timeout margin instead of overlapping or repeatedly restarting short builds. Never treat a timed-out build as verified.

## Interrupted checks

A tool timeout does not guarantee validator cleanup. Confirm the compiler and
validator have exited and inspect temporary validation state before retrying;
never treat a timeout as a completed typecheck or unlock a live validator.

**Why:** An interrupted combined check left the release validator's workspace
lock behind, causing the next invocation to report another check running even
though the earlier processes had exited.

**How to apply:** Keep expensive root validation separate from earlier checks
when their combined duration risks the tool limit. Clear only confirmed orphaned
temporary state; keep the reviewed diagnostic baseline unchanged unless its
delta has actually been reconciled.

## Diagnostic display-order drift

Literal-union ordering inside a compiler error message can change even when the diagnosed source and semantic error are unchanged.

**Why:** A reviewed-source snapshot reconstructed the reviewed diagnostic fingerprint, while the current output differed in the ordering of two literal union members in an unchanged legacy fixture, separately from a genuine additional type error.

**How to apply:** Compare complete diagnostic output and source history when attributing a fingerprint delta. Distinguish the real additional error from message-format drift, but keep the raw gate and baseline intact. Do not edit unrelated legacy behavior merely to force a particular diagnostic display order.

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
