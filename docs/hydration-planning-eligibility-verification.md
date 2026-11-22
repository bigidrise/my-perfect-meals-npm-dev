# Hydration Planning Eligibility Verification

## Scope and existing authority

Reused the existing pure eligibility evaluator, typed three-outcome contract,
registry validation, canonical snapshot builder, and deterministic modifier
resolver. No second resolver or intake ledger was introduced.

The gate returns `PLAN_ELIGIBLE`, `PLAN_WITHHELD`, or `NEEDS_REVIEW` for validly
structured evaluation requests. Malformed contracts or invalid source evidence
fail explicitly with `HydrationPlanningEligibilityError`; they never default to
eligible. Eligibility always keeps numeric planning permission disabled.

The existing server caller assembles the snapshot from canonical legacy event
projection and passes server-owned access evidence. This assignment did not
change that caller, routes, authorization policy, UI, feature activation, existing
numeric policy, water logging, or the intake bridge.

## Corrections

- Validate canonical event identity, source, payload fingerprint, timestamps,
  source timezone, and calendar date before fingerprinting.
- Match occurrence instants to the requested local day, allowing a legacy UTC
  date to differ while rejecting unrelated-day events and invalid timezones.
- Deduplicate identical event replays; reject conflicting event IDs or duplicate
  source identities. No event is written, corrected, or voided by this gate.
- Review otherwise valid expired or withheld registry claims rather than treating
  discarded context as safely absent. Preserve their IDs and source references.
- Keep malformed claim IDs from breaking structured review results.
- Sort and deduplicate reason records so invalid-claim ordering cannot change
  the response.
- Allow a source reference prefix plus its already-permitted 200-character ID
  without truncating provenance or failing output validation.
- Retain per-claim and aggregate review reasons at the full 500-claim boundary.

## Verified behavior

Eight offline suites passed initially: **121 tests**. They cover all three outcomes,
unauthorized and delegated access, resolver/POTS/organ-safety conflicts, unknown
and stale claims, incomplete intake, corrected fingerprints, removal of effective
events, replay identity, local-day membership, malformed evidence, deterministic
review reasons, full source references, and numeric-field absence.

Suites include eligibility, modifier resolution, clinical registry, numeric
policy, canonical intake service, legacy bridge, foundation schema, and the
existing summary consumer. Fixtures never create or modify live water records.

- Strict Hydration contract TypeScript: passed.
- Full server TypeScript: passed.
- Whitespace/diff validation: passed.
- Explicit Development standard validation: failed at the pre-existing
  repository-wide navigation audit; no gate was bypassed or changed. This is
  not a clean overall release result.

## Release and rollback boundary

No migration, schema execution, new route, integration, notification, wearable,
weather source, LLM behavior, or Production action occurred. Existing feature
gates remain unchanged. Numeric planning permission stays disabled even for
`PLAN_ELIGIBLE`; that outcome never authorizes a formula or customer guidance.

Rollback is source-only. There are no data changes to undo. Broader navigation
release blockers and any future Hydration activation require separate work.

## Final boundary confirmation

The additional 500-invalid-claim case passed with the full eligibility suite:
**29 eligibility tests** passed. The strict contract check and diff validation
also passed after that output-bound correction. Development restarted
successfully; health returned `ok: true` in Development and the public sign-in
page rendered normally. No authenticated Hydration UI testing was claimed.
