# Ask Chef approved Production release — paused

Follow-up: `ask-chef-release-blocker-review-2026-10-31.md` records the complete diagnostic comparison, identifies the original aggregate timeout, and documents the completed validator's separate server type failure. The release remains paused; no Production activation or publication occurred.

## Owner scope

The owner approved shipping completed Ask Chef, Restaurant Guide, Find Meals Near Me, Getaway, serving-portion, branding and mobile work. No further feature expansion, permission changes, history overwrite, or unapproved native work is authorized. Stop when critical verification fails.

## Git state verified against GitHub

- Current locally committed Development tip: `c0996f9fec3ace5b4ac21cfca2d88c5c7da5f8bf`.
- GitHub `dev`: `4796e64380e8cebbb9b2873f8d100ec3c53143df`.
- Development has 23 local commits not yet pushed to GitHub.
- GitHub `production`: `67a964474f6ab5effd915fc9bc9ffa027d8e3aa9`.
- Production and Development diverge: 39 commits unique to Production, 103 unique to Development.
- Production's current SHA is the identified rollback point. No new backup tag or branch was created because release preparation stopped at validation.
- The source working tree was clean before validation. Completed feature work was already committed; no empty or replacement source commit was created.
- No push, merge, force-push, branch replacement, or Production workspace update was performed.

Do not use a blanket Development merge without reviewing the approved feature set and dependencies. The Development delta also contains a generated mockup index, a screenshot and an unrelated Academy test adjustment; these require exclusion/review in the Production candidate.

## Critical blockers

### Strict release type gate failed

`npm run check:release-types` exited 1.

- Reviewed baseline: 120 diagnostics, fingerprint `5f299b7c760be174dff591bac35d450823051e0b19ae12b81c3c0980f06649b9`.
- Actual result: 118 diagnostics, fingerprint `186533e21953cfa70b9c0dfa04d41ffb0bb48f95c300f2a7f28958a7e63a7a9c`.

Fewer diagnostics do not prove that the difference is safe. The changed diagnostic set needs review; the baseline was not refreshed or bypassed. Reported locations include existing recipe-editor contracts, diabetic data imports and other client/legacy code. This run alone does not establish which differences are inherited, relocated, removed or new.

Full execution output in this session: `/tmp/ask-chef-approved-release-types.log`.

### Pre-push validation did not finish

`npm run validate -- --report` exceeded the execution tool's five-minute limit. It reached the isolated mocked auth-validator tests but did not produce a final PASS.

The isolated safe-startup test succeeded: HTTP 200 on its separate port and no critical startup error patterns. Startup maintenance/migrations were suppressed. The regular Development workflow was not restarted or replaced.

Live login/session checks were explicitly not run by that validator because shared-database account creation is disabled.

Full execution output in this session: `/tmp/ask-chef-approved-prepush.log`.

Do not claim validation passed or use `--no-verify` to push.

## Production availability controls identified, not changed

- `client/src/features/coachCornerFlag.ts`: `VITE_COACHES_CORNER_ENABLED` must equal `"true"`; its default is hidden.
- `client/src/lib/chefCornerExperience.ts`: the new conversation interface returns `import.meta.env.DEV`, so a normal Production build does not activate it.
- `server/routes/coachingEngine.ts` and `server/routes/coachingNavigation.ts`: non-Development branches restrict the new conversation/navigation behavior.

These controls must be reviewed together with existing dashboard/routing visibility and subscription authorization. Removing a visibility restriction must never bypass authentication, billing, clinical safeguards or two-stage navigation authorization. No flag, environment setting or account entitlement was changed in this attempt.

## Publication and account verification

- Production was **not published**.
- The deployment metadata accessible here belongs to this Development project's separate published app. It is not proof of the customer-facing Production deployment or URL.
- The customer-facing Production URL was not verified in this attempt.
- Amber and Dr. E were not checked against their live account entitlements after the release gate failed. Their permissions were not modified.
- Public discovery, real authorized member access and post-publication smoke tests are not verified for a new Production release.

## iOS

No native dependency was introduced or investigated further after the failed gate. No Capacitor sync, native file edits, build, submission, reminder changes or notification changes were performed. The prior installed-version delivery and physical-device limitations remain unresolved.

## Next action requiring focused review

Review the strict diagnostic-set difference without blindly resetting its baseline, and obtain a complete pre-push validation PASS. Only then resume the approved, Production-based integration and release process. This report is not release approval or a claim that the feature was activated.
