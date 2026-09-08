# U7 Data Deletion and Lifecycle Closure Report

**Review date:** 2026-09-08  
**Disposition:** **CLOSED PARTIAL**  
**Repository remediation performed:** None; destructive behavior remains blocked pending approved retention and disposition policy.

## 1. Official scope

U7 is **Deletion/lifecycle verification and bounded repair**, also described as
**Data deletion and lifecycle**.

The authoritative UTHSC review scope requires evidence for:

1. Account deletion functionality
2. User-data deletion
3. Professional relationship termination
4. Organization termination
5. Database deletion behavior
6. Uploaded-file deletion
7. Backups after deletion, if known
8. Retention periods, if known
9. Audit-log retention
10. Deletion propagation to third parties, if implemented
11. Explicit identification of controls that are not technically verifiable

U7 does not cover infrastructure evidence reconciliation or final institutional
regression review. Those remain U8 and U9 respectively.

## 2. Control results

| Requirement | Status | Result |
|---|---|---|
| Account deletion functionality | **FAIL** | The authenticated route deletes only the `users` row. Development has 43 `NO ACTION` and 2 `RESTRICT` foreign keys referencing `users`, so deletion is not a complete or reliable lifecycle operation. |
| User-data deletion | **FAIL** | No transactional, idempotent deletion service inventories and removes all user-owned records and stored objects. |
| Professional relationship termination | **PARTIAL** | Explicit ProCare revoke/archive and subscription-cancellation paths deactivate relationships, but account deletion does not invoke a shared termination workflow. |
| Organization termination | **FAIL** | No controlled Organization termination workflow coordinates membership, invitations, professional relationships, billing, retained records, and audit evidence. |
| Database deletion behavior | **PARTIAL** | Some user references cascade and some become null, but the behavior is inconsistent and is not governed by one approved disposition policy. |
| Uploaded-file deletion | **PARTIAL** | Studio private-video deletion has a strong retryable lifecycle. Other legacy/private uploads and public media do not have equivalent ownership and deletion evidence. |
| Backups after deletion | **NEEDS EXTERNAL/UTHSC CONFIRMATION** | Production backup retention, delete propagation, restore windows, and expired-backup disposal are not technically verifiable from repository evidence. |
| Retention periods | **PARTIAL** | Studio video media has a documented 24-hour post-watch lifecycle. No complete retention schedule covers all user, health, relationship, organization, and uploaded-file classes. |
| Audit-log retention | **PARTIAL** | A six-year minimum is documented and automatic purge is absent, but durable write enforcement, archival implementation, and restore/query evidence are incomplete. |
| Third-party deletion propagation | **PARTIAL / EXTERNAL** | Stripe cancellation handling and some storage deletion paths exist. Complete deletion propagation and provider-side retention for all processors are not proven. |

## 3. Findings and evidence

### U7-1 — Account deletion is not a complete deletion workflow

**Status:** FAIL

`DELETE /api/auth/delete-account` is authenticated, emits an audit call, and
executes only:

```ts
await db.delete(users).where(eq(users.id, userId));
```

Evidence:

- `server/routes/auth.session.ts:527-549`
- `client/src/pages/DeleteAccount.tsx`
- `client/src/components/ProfileSheet.tsx`

The Development database contains 98 foreign-key constraints referencing
`users.id`:

| Delete rule | Count |
|---|---:|
| CASCADE | 39 |
| NO ACTION | 43 |
| RESTRICT | 2 |
| SET NULL | 14 |

The route is not transactional across dependent data, object storage,
professional relationships, authentication/session revocation, or third-party
processors. Its implementation therefore does not substantiate its claim that
the account and all associated data are permanently deleted.

**Risk:** A deletion request can fail or leave related data and active
relationships behind.

**Smallest safe remediation:** Define an approved data-disposition matrix first,
then implement one idempotent account-lifecycle service that applies
delete/anonymize/retain decisions transactionally, revokes credentials and
relationships, schedules object deletion, records durable evidence, and exposes
retry/failure state.

**Why no automatic repair was made:** Converting every reference to cascade
would risk deleting clinical directives, audit evidence, organizational records,
invitations, and professional records that may require retention or
de-identification instead.

### U7-2 — User-data deletion is not centrally governed

**Status:** FAIL

User-owned nutrition, biometrics, meal, hydration, mental-health, subscription,
and professional records span many tables with mixed foreign-key behavior.
There is no repository-level deletion inventory or postcondition check proving
that all deletable records and objects are gone.

**Risk:** Incomplete erasure, orphaned records, inconsistent behavior between
data domains, and inability to demonstrate deletion completion.

**Required decision:** Approve, by data class, whether records are deleted,
anonymized, retained, or transferred when an account closes.

### U7-3 — Professional relationship termination exists but is fragmented

**Status:** PARTIAL

Evidence:

- `server/services/procareActivation.ts`
- `server/routes/careTeamRoutes.ts`
- `server/routes/procareClientRoutes.ts`
- `server/routes/studioRoutes.ts`
- `server/routes/stripeWebhook.ts:82-123`

Explicit revoke/archive and subscription-cancellation paths call
`deactivateProCareClient`. The account deletion route does not call a shared
relationship-termination service, and webhook termination handles per-link
failures without making the whole lifecycle atomic.

**Risk:** Account closure or partial provider failure can leave active or
orphaned professional links.

### U7-4 — Organization termination is not implemented

**Status:** FAIL

Organizations have lifecycle/status data, but no controlled termination service
or route was found. Current Organization workspace routes cover discovery,
selection, and access—not termination.

Evidence:

- `server/db/schema/organizations.ts`
- `server/routes/organizationWorkspaceRoutes.ts`
- `server/tests/organizationWorkspaceStage1.test.ts`
- `server/tests/organizationWorkspaceStage2.test.ts`

**Risk:** The platform cannot demonstrate coordinated closure of memberships,
invitations, Location access, professional relationships, billing, retained
records, and audit evidence.

### U7-5 — Studio media deletion is the strongest verified lifecycle

**Status:** PASS for the bounded Studio private-video media lifecycle; PARTIAL
for uploaded files generally.

Evidence:

- `server/db/schema/studio.ts`
- `server/services/voiceJobWorker.ts`
- `server/services/studioVideoMessageService.ts`
- `server/tests/studioVideoPurgeWorker.test.ts`
- `server/tests/studioVideoManualDeletion.test.ts`
- `docs/studio-video-retention-impact.md`

The Studio worker:

- waits for the applicable expiry condition;
- uses a renewable deletion lease;
- deletes original and derivative objects;
- clears object references only after storage success;
- records retryable deletion failure;
- preserves the retained transcript/message boundary;
- supports idempotent retry.

The documented media period is 24 hours after verified watch completion. This
evidence does not establish equivalent lifecycle behavior for every legacy,
profile, campaign, public, or meal-image object.

### U7-6 — Audit retention is documented but not fully enforced

**Status:** PARTIAL

Evidence:

- `server/db/schema/auditLog.ts`
- `server/lib/auditLog.ts`
- `docs/security-runbook.md:154-205`

The runbook documents a six-year minimum and no automatic purge. The archive
strategy remains TBD. Application audit writes are fire-and-forget, and
repository evidence does not prove DB-level append-only enforcement, durable
delivery for critical lifecycle events, archival execution, or archive
restore/queryability.

**Risk:** A deletion event or lifecycle failure may not produce durable,
institutionally reviewable evidence.

### U7-7 — Backup and provider deletion behavior is external

**Status:** NEEDS EXTERNAL/UTHSC CONFIRMATION

Repository evidence does not prove:

- production database backup frequency and retention;
- point-in-time recovery windows after deletion;
- object-store versioning or delete-marker lifecycle;
- backup expiration and disposal;
- processor-specific deletion/retention for OpenAI, ElevenLabs, Stripe, Resend,
  Google services, Sentry, or AWS/Replit-hosted storage;
- contractual or BAA obligations.

These items must be answered with current provider documentation and executed
agreements. They are not safe to infer from environment variables or SDK usage.

## 4. Remediation performed

No application, schema, configuration, data, or deletion behavior was changed.

The audit identified real repository deficiencies, but the smallest safe
implementation depends on an approved disposition matrix for clinical,
professional, organizational, audit, billing, invitation, and media records.
Implementing cascade deletion without that policy would create a greater
security and evidence-retention risk.

## 5. Verification

- Authoritative U7 scope recovered from the UTHSC audit and remediation records.
- U4, U5, and U6 closure evidence reviewed without reopening accepted findings.
- Development foreign-key behavior inspected read-only through
  `information_schema`.
- Account, relationship, Organization, database, storage, Studio, audit, backup,
  and third-party lifecycle paths reviewed.
- Focused lifecycle verification: **65/65 tests passed** across:
  - `server/tests/studioVideoPurgeWorker.test.ts`
  - `server/tests/studioVideoManualDeletion.test.ts`
  - `server/tests/mediaAssetLifecycle.test.ts`
- Jest reported its existing forced-exit/open-handle advisory after all focused
  tests passed; no test failed or timed out.
- No Production database or Production environment was accessed or changed.
- No browser/UI automation was run.
- No client or server build was required because U7 changed documentation only.

## 6. Accepted baseline preserved

U7 does not relabel or suppress the accepted U6 baseline:

- OSV HIGH: **47 → 35**
- HoundDog total: **61 → 8**
- HoundDog critical: **4 → 0**
- TypeScript diagnostics fingerprint:
  `ba24598f9ed9604727eb348bec92afe0f2d8dddb9191aca9712040fbe45a2cb7`
- Route-parity warning: exactly **61 routes**

U4 and U5 controls were not reopened or weakened.

## 7. Residual risks and blockers

1. Account deletion is not reliable or complete.
2. No approved cross-domain disposition matrix exists.
3. Organization termination is absent.
4. Professional termination is fragmented.
5. Non-Studio upload deletion lacks complete lifecycle evidence.
6. Audit retention is documented but archival and durable-delivery controls are incomplete.
7. Backup and processor deletion behavior requires external evidence.

## 8. U8/U9 boundary

- **U8:** Infrastructure evidence reconciliation, including provider-supported
  backup, retention, encryption, hosting, region, recovery, and contractual
  evidence where documented by the established sequence.
- **U9:** Final institutional-readiness regression audit.

No requirements beyond those documented boundaries are inferred.

## 9. Closure

U7 is **CLOSED PARTIAL**.

The lifecycle inventory and evidence review are complete. Repository remediation
is blocked by required retention/disposition decisions and external provider
evidence. No destructive or speculative changes were made.

## 10. Final checkpoint evidence

The platform checkpoint containing this U7 report is:

```text
9e605cbdd2c05fc4d2ffde81520dcd108157df47
```

That checkpoint changed only:

```text
docs/security/uthsc/U7_DATA_DELETION_LIFECYCLE_CLOSURE_REPORT.md
```

Immediately before this evidence-only report amendment, the working tree was
clean:

```text
## dev...origin/dev [ahead 5]
```

After this evidence-only amendment, the expected working-tree change is limited
to this report.