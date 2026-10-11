# Business Pilot — controlled shared-Neon installation

## Result

**COMMITTED AND VERIFIED.** The unchanged approved migration executed once.
Activation remains disabled in both Development and Production.

Read-only verification completed at **2026-10-11T02:23:52.353Z**.

Migration: `migrations/20261011_business_pilot_activation.sql`

Approved and executed SHA-256:

```text
01294e9fb6b036e2a4a0c7b7b3011ba38c69ad59f7a47137dfc9dce741dfa119
```

## Preflight and execution

The dedicated connection confirmed the configured shared Neon database,
`neondb_owner` creator, absence of the proposed tables/indexes, disabled flags,
and unchanged reviewed parent metadata. The corrected permission check found
zero event triggers and zero applicable creating-role defaults in database-wide
or public-schema scope. Both cloud_admin administrative defaults were preserved.

Only the approved file ran, using its BEGIN/COMMIT transaction, two-second lock
timeout and fifteen-second statement timeout. The server confirmed:

```text
BEGIN → SET → SET → CREATE TABLE → CREATE INDEX → CREATE TABLE → COMMIT
```

No application bootstrap, general migration runner, account writes, cleanup,
enrollment or unrelated migration was executed.

## Read-only verification

| Installed item | Verified count |
|---|---:|
| Companion tables | 2 |
| Columns, with reviewed types, nullability and defaults | 20 |
| Validated, non-deferrable constraints | 16 |
| Foreign keys | 5 |
| Check constraints | 7 |
| Primary/unique keys | 4 |
| Indexes, including supporting key indexes | 5 |
| Activation records | 0 |
| Consent records | 0 |

Tables: `public.business_pilot_activation_links` and
`public.organization_checkout_consents`.

The activation CHECK matches the reviewed wholly-pending or finite,
non-null, exactly-720-hour window. The finite invitation deadline and
Organization-consumption CHECKs also match. All seven CHECK definitions
were inspected. Index names, key columns and definitions match.

| Foreign key | Parent | Delete action |
|---|---|---|
| Activation authorization | business_pilot_authorizations.id | RESTRICT |
| Activation account | users.id | CASCADE |
| Activation Business | businesses.id | SET NULL |
| Consent actor | users.id | SET NULL |
| Consent Business | businesses.id | SET NULL |

Both tables have owner-only explicit ACLs, with no PUBLIC or additional explicit
role grants. Existing administrative privileges/defaults were not altered.

After COMMIT, the first verification helper encountered a driver-decoding issue:
catalog name[] values arrived as strings rather than JavaScript arrays. This
was not a database or migration failure. Casting names to text[] in subsequent
read-only queries completed verification. The migration was not rerun and no
installed object was corrected or modified.

## Existing application compatibility

The 28 reviewed parent columns, 146 existing constraints, 21 indexes and all
277 original parent triggers remain unchanged. The only added parent triggers
are ten expected internal foreign-key triggers. The two new tables have ten
internal FK triggers and no custom triggers.

The existing account-erasure trigger remains intact. No existing-table ALTER,
DROP, backfill, permission change or role switch ran. Existing SELECT-star
projections remain unchanged because the new columns are in companion tables.

Both activation flags were checked again after installation and remain unset/
disabled in Development and Production configuration. No Production code,
environment, restart, publication or GitHub push was performed.

This establishes additive schema-level compatibility. It does not claim
authenticated Production or workflow end-to-end testing, which remains
unauthorized. No Stripe operations or real physician invitations occurred.

## Remaining approval boundaries

**No schema-installation blocker remains.**

Separate approval is still required for Development activation, any controlled
restart, and the physician-link, Organization-creation and independent patient
invitation end-to-end tests. Do not send a real physician invitation yet.

Financial-consent retention duration remains a policy-owner decision before
live paid continuation or automatic purging. No duration was invented here.
The existing 176 isolated tests were not rerun because no implementation
changed; this step verified the actual installed schema.
