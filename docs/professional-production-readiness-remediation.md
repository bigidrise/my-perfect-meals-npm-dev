# Three-blocker Production-readiness remediation

## Result

**PRODUCTION PROMOTION READY: NO.**

Implementation was confined to Development. The explicitly installed lifecycle
schema safeguards are on shared Neon; they change future account-erasure handling,
not existing accounts or billing records. No Dr. Test transition or demo grant,
professional identity change, role expansion, GitHub push, or Production
publish/restart was performed by this work.

## 1. Professional lifecycle erasure — implemented

- The authenticated account-delete route runs through one database transaction
  and fails closed if the erasure trigger is absent.
- A narrowly scoped users BEFORE DELETE trigger removes subject applications,
  credential answers, grants and events. Minimal administrative decision evidence
  retains only event type, outcome, time and whitelisted non-identifying facts.
- Reviewer/approver deletion preserves other subjects' credentials and outcomes,
  but removes reviewer identifiers, decision notes, waiver explanations and
  identifying event metadata. No anonymous-actor lookup map is retained.
- Erased-account links in synthetic invitation JSON are removed without deleting
  shared synthetic workspaces or patient records.
- Ordinary history mutation remains prohibited. A session setting alone cannot
  authorize erasure; nested trigger scope and exact row/field checks are required.
- The request-owner foreign key prevents a stale writer from recreating an
  application after its owner has been deleted.
- No professional-record retention duration was established. The general
  audit_log six-year policy was not applied to these records.

The explicit bounded, repeatable installer is
`NODE_ENV=development tsx scripts/install-professional-erasure.ts`.
Run it after the Stage 1–3 schema migrations, never as ordinary startup/backfill.
It uses a dedicated connection pool rather than the server singleton's keepalive
timer. Installation completed and exited successfully; the owner FK is validated.

All real PostgreSQL tests use fictional records in temporary schemas inside
rollback-only transactions. No public account, grant or billing fixtures are
created. Checks found zero surviving fixture schemas and zero rows in the
professional request/event, demo grant/event and new erasure-audit tables.

## 2. Six type defects — fixed; reviewed baseline deliberately unchanged

- Complete validated Care Team attribution uses `Bp1Attribution`, not nullable
  `ProCareAttribution` and not a cast.
- The Oncology selection request contract describes its actual JSON-string body,
  allowing the two existing dashboard callers to use their authenticated helper.
- Unknown or nonfinite Low Carb starch estimates remain `evidence_unavailable`.

The reviewed snapshot was reproduced independently using the current dependency
installation. Comparison removes only diagnostic line/column coordinates:
the files, diagnostic codes, messages and multiplicities are identical.

| | Count | SHA-256 |
|---|---:|---|
| Reviewed | 133 | `efe55ca6841f188d71bb745429058deee5d3bf1f0238171925ce743a2fd59d01` |
| Corrected current | 133 | `f34e53772f7f77f0f4c5e4e47d3d6111aa13ee8137eef58c88f57c408b0c416c` |

Exactly eight diagnostics moved: one in JoinStudio, four in craving-creator,
and three in EditProfilePage. No remaining diagnostic was added or removed.
The baseline file was not updated. A deliberate, separately approved
location-only baseline update is still required for the release gate to pass.

## 3. Stripe ownership — unresolved, no correction executed

Read-only evidence:

- One customer/subscription pair remains referenced in personal and Business
  scopes, although both scopes have the same owner.
- The local ownership registry is Business-scoped; the personal plan key is
  `clinical_business_monthly`. These local values are not sufficient proof.
- The configured live Stripe SDK key was used only for read operations. Stripe
  rejected subscription retrieval with `resource_missing`, explicitly stating
  that a similar object exists in test mode but the request used a live key.
- Consequently subscription/customer metadata and Stripe invoice history for
  this pair could not be obtained with that credential.
- The existing Stripe connector yielded no usable SDK credential. It was not
  reinstalled, reconfigured, or used to request any billing mutation.
- No matching local stripe_billing_events history was found for the subscription.

**Classification: ambiguous.** Authoritative test-mode subscription/customer
metadata and billing history are still needed to establish the billing subject.
No shared billing correction SQL is proposed because the required organization
ownership proof has not been obtained. No subscription/customer was created,
changed, cancelled or transferred; no obsolete personal references were cleared.
The same-owner match is not treated as authorization to transfer scope.

Rollback-only PostgreSQL regressions cover same-owner cross-scope rejection,
preservation of the Business record, rejection of a personal claim on Business
identities, repeat reconciliation, and known versus unexpected startup failure.
Existing verified billing-status tests confirm organization billing remains
distinct from personal/Studio entitlement.

## Individually reported verification

| Verification | Result |
|---|---|
| Account-erasure entry-point tests | PASS — 4 tests |
| Real PostgreSQL lifecycle erasure/failure tests | PASS — 13 tests |
| Stage 1 professional onboarding service/storage/routes | PASS |
| Stage 2 identity decisions/guards/client contracts | PASS |
| Stage 3 demo boundaries/routes | PASS |
| Stage 4 canonical invitation security regressions | PASS |
| Older Care Team identity regression suite | PASS — 44 tests after fixture alignment with the existing Stage 4 callback/receipt contract |
| Professional legal/role security regressions | PASS |
| Stripe rollback-only ownership/reconciliation regressions | PASS — 4 tests |
| Existing Stripe startup/entitlement/verified billing regressions | PASS |
| Oncology clinician handoff and Low Carb regressions | PASS |
| ProCare invitation expiry regressions | PASS |
| Root strict TypeScript | FAIL — 133 reviewed legacy diagnostics; six targeted defects resolved |
| Release type gate | FAIL — location-only fingerprint difference; baseline unchanged |
| Strict safety typecheck, including new erasure service/migration | PASS |
| Client Production build | PASS |
| Server Production build | PASS |
| Full release-check command | BLOCKED at the release type gate; later checks intentionally do not run past that failure |
| Development startup | PASS — serving on port 5000; known Stripe ownership review warning remains |
| Development health/auth boundary | PASS — health OK; unauthenticated account deletion denied with 403 |

The signed-out screenshot showed a boot spinner, not an authenticated UI
verification. No unrelated UI investigation or browser invitation testing was
performed.

Earlier regression runs exposed stale pre-Stage-4 fixtures and a missing
timestamp column in the new Stripe fixture. These were corrected with focused
reruns; no product invitation or billing behavior was changed to satisfy tests.

## Remaining concrete blockers only

1. Separately approve the reviewed location-only TypeScript baseline update.
2. Obtain authoritative test-mode Stripe ownership evidence, then separately
   approve any proven-necessary shared billing correction. The conflict remains.

Stop here. No promotion, account activation or shared billing correction is
authorized by this report.
