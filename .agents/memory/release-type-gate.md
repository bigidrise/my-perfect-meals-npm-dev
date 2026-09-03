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

**Why:** Pre-existing TS debt must never allow a new error to be silently absorbed. Any change to the diagnostic set — rising, falling, or just a rewording — fails the gate and requires deliberate baseline refresh after review.

**How to refresh the baseline:** Re-run `node scripts/check-release-type-baseline.mjs` after making a focused debt-reduction change. The script will print the new fingerprint; manually update `scripts/release-typecheck-baseline.json` with the new count and sha256 values after reviewing the diff.

**Safety slice:** Add any new safety-sensitive surface to `tsconfig.safety-check.json` before relying on the release check for that surface.

## AI smoke-test gate (section 7 of release-check.sh)

Sends an unauthenticated POST to `/api/meals/generate`. Correct response is 401 (gate reachable and auth-protected). Accepts 401/400/200 — timing-based checks are wrong here because unauthenticated probes return immediately.

## Locked-day target snapshot rule

`onSaveDay` in builder pages must snapshot the same prescription-derived targets the RemainingMacrosFooter displays — **not** `getMacroTargets()` (localStorage cache). localStorage can be absent or stale. Use `prescription?.caloriesTarget` etc. directly, and guard with `if (!prescription || nutritionStateLoading) return` before the lockDay call.
