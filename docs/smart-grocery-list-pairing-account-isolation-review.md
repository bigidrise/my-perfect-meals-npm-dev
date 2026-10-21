# Smart Grocery List — existing pairing-test account isolation review

## Decision: UNVERIFIED — no login or persistence writes authorized

The existing pairing-test account exists and is marked as an internal QA/demo
account. Its shopping-list rows have account ownership boundaries, but exclusive
Development use and freedom from Production/other-user dependencies could not be
established. It must not yet be treated as a safely isolated live-write identity.

This is **not** a finding that the account is compromised or that its linked
accounts necessarily belong to real customers. It is a finding that the required
isolation assurances are incomplete, with concrete shared-use risk indicators.

## Scope and method

This review used the application's existing external Neon connection, not a
different Replit-managed database. The application DB module was not imported.
Standalone PostgreSQL clients used verified TLS, explicit `READ ONLY` transactions,
bounded statement timeouts, and connection closure. All three investigation
transactions ended with `ROLLBACK`; the first two also used repeatable-read
snapshots.

The configured pairing-test email was used only as a bound lookup parameter.
Exactly one normalized-email match was found. Account identifiers remained private
inside the investigation process. No password/hash value, bearer value, session
identifier, CSRF value, cookie value, account email or connection string was
displayed or written into this report.

Queries returned account/access booleans, aggregate counts and database catalog
metadata. They did not retrieve shopping ingredient contents, clinical contents,
invitation tokens or raw session payloads. The account's password was not tested.

The review also inspected current authentication, access-tier, shopping API,
session-store and invitation-acceptance code. It did not execute an authentication
or account-maintenance helper.

## 1. Does the account exist and have a Development testing designation?

**Existence: confirmed. Internal QA/demo designation: confirmed.
Exclusive Development designation: unverified.**

- Exactly one matching account exists.
- Its `is_sandbox` flag is true. The schema describes that flag as internal
  QA/demo access.
- It is not an administrator or a beta-tester-flag account.
- Nothing inspected makes this identity Development-only. The same identity and
  sandbox access flag exist in the shared database used by deployed applications.
- A billing customer reference exists, although no subscription reference was
  present. This does not establish live billing activity, but the account cannot
  be assumed to have no connections outside the narrow shopping test.

## 2. Is its shopping-list data isolated from other accounts?

**Account-level ownership: supported by current evidence.
Environment-level isolation: absent.**

At inspection:

- 15 shopping-list rows belonged to the candidate.
- None contained ingredient metadata or a selected-product key.
- The candidate had no shopping-source rows.
- No shopping-source row belonging to another owner referenced the candidate's
  shopping items.
- The inspected classic/V2 routes derive ownership from the authenticated actor.
  Development insertion fixes `user_id` to that actor; reads and protected updates
  constrain the target owner.
- Shopping tables do not enable row-level security. Their access separation
  therefore relies on application ownership predicates and database privileges,
  not an independent tenant-specific database policy.

These findings do not establish that all 15 rows are synthetic or unused. They
were deliberately left unchanged. A fixture written under this same identity
would also exist for that identity in Production; V2 hydration reads all of its
shopping items, so a unique test scope would not make the fixture universally
invisible.

## 3. Do other users, Production sessions or Production automation depend on it?

**Cannot confirm the required absence of dependencies.**

Read-only evidence:

| Indicator | Finding |
|---|---|
| Organization memberships | 2 active |
| Location memberships | 2 active |
| Other active organization members | 1 distinct other account, not marked sandbox |
| Care-team relationships | 5 active relationship rows, each linked to an existing non-sandbox counterpart account |
| Business offer links created by candidate | 3 active |
| Other recipients of those offer links | None found at inspection |
| Persisted sessions | 10 unexpired, all matching the current authentication security version and carrying secure-cookie settings |
| Shared bearer credential | Present and within the application's 30-day freshness window; value not retrieved |
| Immediately auto-acceptable care/Studio invitations | None matched the current login auto-accept criteria |
| Pending unexpired business/coaching email invitations | None found in the inspected tables |

The five care-team rows are **relationship rows**, not a claim of five distinct
people. Non-sandbox status does not by itself prove real-customer status.

The current Production-mode entrypoint uses the shared PostgreSQL session table;
the undeployed Development entrypoint uses in-memory sessions. The persisted
sessions are consequently a deployed/shared-session risk indicator, but their
contents have no source-environment field. This review cannot distinguish
Production-workspace sessions from other deployed environments or establish that
all unexpired sessions remain within idle-timeout limits.

Account-related audit records also lacked explicit source-environment markers.
They do not establish exclusive Development usage.

A literal-reference scan of tracked application/scripts/docs found the candidate
referenced by `scripts/verify_clinical_context.ts`. The helper appears to read the
database; it was not run. No reference scheduling that helper was found in the
inspected workflow/package/runtime sources. This is **not** proof that no external
or separately deployed automation invokes it or uses the account.

Checking 128 declared account foreign-key references was supplemented by targeted
checks of care-team links, invitations and sessions, where account relationships
are not fully represented by those foreign keys. This does not inventory every
possible external service, unstructured reference or independently deployed job.

Normal login rotates the shared bearer credential, records authentication
activity, and can accept pending invitations. A new sign-in could therefore affect
another client using this account's bearer credential. Token rotation does not,
by itself, prove that all existing browser cookie sessions would be revoked.

## 4. Can synthetic records be uniquely identified and safely removed?

**A narrowly bounded cleanup design is feasible from the inspected storage
structure; execution safety is not yet fully established.**

Confirmed:

- Shopping items and sources have UUID primary keys.
- The only declared inbound foreign key to shopping items is the shopping-source
  item reference, with `ON DELETE CASCADE`.
- No non-internal triggers or rewrite rules were present on either shopping table.

If a live test is approved after isolation is established, cleanup should retain
the exact server-returned item IDs, use a random test-specific scope and synthetic
product identities, and constrain deletion by **owner + exact created IDs + exact
scope**. Before deleting, verify that dependent sources, current row ownership and
the expected fixture state are still consistent with that manifest. Abort on any
unexpected dependent owner or unrelated record.

Do not clear the account, delete the account, replace a pre-existing scope, or
delete by ingredient name alone. Current shared account usage remains a reason
not to execute that design yet. No fixture IDs were allocated and no cleanup
query was run in this review.

## 5. Can it exercise the authenticated Development shopping-list API?

**Access eligibility is supported by code and stored flags.
Actual authenticated API execution remains unverified.**

- The account has a stored password hash and internal sandbox access.
- The current access resolver gives sandbox accounts `PAID_FULL`, which satisfies
  the enhanced shopping POST's Essential-access gate.
- Classic and V2 shopping routes require normal authentication. Development
  metadata behavior remains gated by the server's Development environment.
- The earlier non-mutating runtime checks established that the Development
  metadata-aware handler was loaded.

No login, credential comparison, existing-bearer reuse, authenticated GET or
write request was attempted. An actual authenticated response, current credential
acceptance, session/MFA behavior and browser CSRF continuity are therefore not
certified by this review.

## 6. Shared-Neon risks

1. **Shared records:** Development fixtures would be the same physical rows visible
   to Production under the same account.
2. **Shared authentication:** sign-in changes the common bearer credential and may
   affect other clients. Persisted sessions lack reliable environment provenance.
3. **Existing relationships:** active organization/location and care-team links
   mean this is not proven to be a standalone disposable identity.
4. **Production metadata loss:** the older Production `replace_scope` behavior can
   delete/recreate rows without their structured metadata.
5. **Concurrent activity:** a unique fixture scope and precise IDs reduce accidental
   cleanup risk but do not exclude concurrent clients, broad account operations,
   retention jobs or unknown external workflows.
6. **Application-level ownership:** there is no shopping-table RLS or separate
   environment-specific database namespace enforcing the desired isolation.

## Actions, changes and stop boundary

- No login, account creation, database DML, shopping-list change or cleanup occurred.
- No restart, migration, schema synchronization, environment/workflow change,
  Production modification, publication or GitHub push occurred.
- Application source was not changed. This report and the prior verification-status
  document were updated; project memory was clarified about the read-only approval
  boundary.
- No medical recommendations or product-selection interface were activated.

**The pairing-test identity is UNVERIFIED for the proposed live persistence test.
Stop for approval before any sign-in or writes.** Further approval should first
resolve whether the existing deployed sessions and linked non-sandbox accounts
are controlled QA dependencies, and establish an exclusion window for all users
and automation using this identity—or authorize investigation of another existing
dedicated identity. This report does not authorize either action.
