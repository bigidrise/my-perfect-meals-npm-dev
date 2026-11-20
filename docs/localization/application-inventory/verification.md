# Inventory verification record

## Scope

Documentation and offline evidence only. This is not a translation implementation, new application enforcement gate or live/browser-journey verification.

## Passed checks

- Parsed 1,300 bounded client source files; source-hashes.json was compared back to all 1,300 files after report assembly. No mismatch.
- Every one of the 54 reviewed records resolves to an existing source owner, exact source line and matching SHA-256. There are 53 distinct reviewed owners.
- Route-register and route-state-matrix each contain 248 rows; feature-state-review contains 36; reviewed-findings contains 54.
- The text-owner register has 1,294 non-i18n source-owner rows. Every candidate, translation-connection and transient-surface owner joins to that register. The large raw text-candidates.csv appendix is generated under generated-artifacts/application-localization-inventory and excluded from Git/deployment; reviewed evidence remains in this documentation bundle.
- Candidate records: 14,741. Recognized translation calls: 3,200. Transient JSX occurrences: 734. These counts reconcile to the evidence files and are not defect or runtime-state counts.
- Translation-call statuses reconcile exactly: 2,986 direct EN/ES resource connections, 4 plural connections, 20 missing/fallback candidates, 111 dynamic unresolved calls, 79 namespace-review calls.
- The 20-row triage excludes the four recognized plural calls. In particular, brandsSummary and iosScheduleConfirmed are not reported as missing base-key defects.
- JoinStudio's anotherAddress is correctly recorded as Spanish present / English absent, not a missing Spanish translation.
- Every reviewed record has ownership, role/state, route relationship, dictionary availability, visibility evidence and uncertainty fields. Shared owner relationships are normalized instead of multiplying fixes by page.
- Current approved consumer resources match all 32 retained founder-approved English/Spanish comparison pairs exactly.
- Legacy EN/ES key presence reconciles at 3,423 English leaves with Spanish values; additive consumer EN/ES reconciles at 453 keys each with no missing or empty Spanish value. These are resource-presence facts, not application coverage.
- `git diff --exit-code -- client/src server shared docs/localization/clinical-registry.json docs/localization/clinical-review docs/localization/hardcoded-baseline.json docs/localization/hardcoded-baseline-perfile.json` returned clean. No tracked application/resource/clinical-manifest/baseline change was made.
- Self-contained HTML parsed/assembled with no script or iframe content. The static report has no remote assets or application/API connection.
- A desktop screenshot at 1440 × 1000 confirmed the report header, navigation and decision text render legibly. Only the documentation directory was served on temporary port 8099; no application startup was imported. The report-only server was stopped.

The screenshot is a generated presentation artifact at generated-artifacts/localization-inventory/report-desktop.jpg, excluded from Git/deployment. The static server logged one missing-resource 404 during capture, consistent with its lack of an application favicon; no report-content failure was observed.

## Deliberately not run

- No new application browser pass, account login/creation, preference or consent save, invitation, message, notification permission, scanner/provider request, paid generation, database query/mutation, email delivery, checkout, release, merge or deployment.
- No main workflow restart. Documentation changes do not require booting a runtime that may reach shared external Neon.
- No application build, strict-localization rerun, release-type rerun, registry repair or baseline update. Existing failing gate observations remain explicitly historical and unchanged.
- Existing Phase 2/approved-consent browser evidence was reused with its fixture, viewport, audio and persistence limits. No new inaccessible state was given a completion denominator.

## Changed deliverables

Only the new docs/localization/application-inventory report bundle and a small audit-method clarification in localization project memory belong to this task. The pre-existing generated mockup modification was left untouched.

## Next boundary

Founder review of the inventory and a separately selected wording/implementation scope. No additional translation is authorized by this report.
