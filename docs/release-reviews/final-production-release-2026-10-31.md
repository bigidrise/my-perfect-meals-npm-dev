# Final Production release — pre-publication handoff

## Authorization and provenance

The owner authorized the final normal Production integration, GitHub push and Reserved VM publication. This review does not authorize a new feature-development cycle.

- Integration: `integration/all-approved-development-20261031`, initially clean at `6bcfe782f`.
- Preserved Production: `67a964474f6ab5effd915fc9bc9ffa027d8e3aa9`.
- Approved Development input: `e4e0bad16f5f9bc8564dc4ff7345310be0ceb661`.
- Both inputs are ancestors of the completed integration. The original integration review records the deliberate retention of Production fixes and exclusion of unapproved experimental replacements.
- After fetching GitHub, `origin/production` still matched preserved Production.
- Local and remote annotated tag `production-rollback-ask-chef-20261031` both resolve to the preserved Production commit above.

## Final verification

- **66 suites, 1,629 tests passed; no failures or skipped tests.** The selection combines the earlier reviewed regression groups with every added or changed test suite.
- The expanded selection found two stale button-label expectations in the standalone action-component test. Only those expectations were aligned with the already approved Grocery Store Coach label. Navigation, ownership, permission and no-generation assertions remain intact; no runtime behavior changed during final preparation.
- **Full release gate: exit 0; 13 passed, 0 warnings, 0 failed.** Production client/server builds, strict safety types, authentication gates, read-only storage readiness and HTTP smoke checks passed.
- **Root strict TypeScript:** matches the unchanged reviewed 118-diagnostic baseline. No baseline refresh or suppression.
- Ask Chef is enabled in Production without a Development visibility override and opens the released conversation rather than assessment.
- Grocery actions display **Open Grocery Store Coach**, preserve the explanatory function name and continue through the validated `/shopping-list-v2` destination.
- My Perfect Menu Essential+ and Ask Chef Pro+/Clinical permissions passed their access matrices. Destination-specific Clinical/hydration restrictions and ordinary authentication, subscription and CSRF checks passed.
- Restaurant Guide, Find Meals Near Me, My Perfect Getaway, Grocery Coach, Product Scan and Saved Groceries are covered by the selected navigation, reliability and ownership regression suites.

Evidence is retained in `final-production-release-2026-10-31/`.

## Preserved Production boundaries

Byte comparisons with preserved Production show no changes to the native projects, root Capacitor configuration, tracked reminder implementations/tests, native origin resolver, or these pinned image-pipeline files:

- `server/services/mealImageGenerator.ts`
- `server/services/universalMealGenerator.ts`
- `server/utils/openaiSafe.ts`

The pinned image model remains `gpt-image-2.5-flare-2026-09-08`. The independently verified native API origin remains `https://app.myperfectmeals.ai`; the primary web domain remains `https://app.myperfectmeals.com`. No native rebuild, Stripe product/price/secret change, forced push, Production reset, model-generation request, or verification-initiated persistence write was performed.

Existing Production deployment commands are unchanged: `npm run build`, then `npm run start`. Deployment metadata confirms this is the public Production **Reserved VM** workspace.

## Publication and verification boundary

At pre-publication verification, both official domains returned HTTP 200, healthy initialized status and the same previous live release `a8d9ad59f`. This is evidence that the existing site is available, **not** evidence that the new integration is published.

This document records pre-publication readiness. The final handoff must separately identify the pushed Production commit and actual publication status. Publishing requires the workspace Publish action; a GitHub push alone does not prove deployment.

After publication, compare both domains' `/api/release` identities with the pushed release commit before declaring the release live. Verify public health and unauthenticated protection against the published application, not just the workspace.

Signed-in member sessions, paid-model generation, new storage uploads and physical-device reminder execution were **not** performed. Automated real-component/router fixtures and source preservation checks do not substitute for those live checks.
