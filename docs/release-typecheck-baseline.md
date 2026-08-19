# Release Typecheck Baseline

The repository-wide `npm run check` remains strict and is intentionally kept
outside the release build path until its historical contract debt is remediated.
The current reviewed diagnostic set is fingerprinted in
`scripts/release-typecheck-baseline.json`.

`npm run check:release-types` always runs the strict root compiler with the
same modern, non-incremental settings as `npm run check`. It passes only when:

1. the root check is clean; or
2. every root diagnostic exactly matches the committed reviewed baseline.

This means a new error cannot be hidden by the existing debt. A changed
diagnostic set—whether its total rises, falls, or stays the same—fails the
release check until the focused change has been reviewed and the fingerprint
has been deliberately refreshed.

The release check also runs the clean strict safety slice
(`npm run check:safety-types`) and both production build targets. Add a
safety-sensitive surface to `tsconfig.safety-check.json` before relying on it
for release validation.