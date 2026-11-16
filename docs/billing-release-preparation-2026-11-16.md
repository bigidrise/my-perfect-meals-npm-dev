# Duplicate-billing release preparation — 2026-11-16

## Scope and authority

This review authorizes no shared-Neon DDL, account mutation, GitHub promotion,
Production synchronization/publication, live Stripe mutation, refund or direct
payment. No such operation was performed. Both activation flags remain off in
this Development environment. Development and Production share external Neon
but are separate workspaces; publishing Development is not a Production release.

Account-specific identifiers, the collision email, current refund IDs and
charge mappings are confined to the separately delivered private review and
status CSV, not repeated in this collaborator-visible runbook.

## Decisions and findings

1. **Prioritize the three duplicate renewal stops independently of refunds.**
   Prepare three period-end renewal updates, preserving the original August 30
   subscription. Execute only after separate approval and the preflight below.
2. **Do not authorize more money movement from the earlier refund proposal.**
   Four pending Stripe refunds were found, including one on the retained original
   subscription. The possible direct payment remains unconfirmed. The earlier
   proposed-refund CSV is historical and must not be executed.
3. **The strict type fingerprint hold is resolved.** No diagnostic content was
   accepted or suppressed. The server-only type check exposed a separate new SDK
   union-narrowing issue, now fixed with explicit property guards and a deleted-
   customer regression case.
4. **The email unique index remains blocked by a real legacy collision.**
   Account ownership must be established before any correction. No account was
   modified.
5. **The broader no-start pre-push check remains blocked by navigation.**
   Its source scanner found 72 invalid references and 366 unresolved expressions.
   Some are legacy/conditional; this is not proof that every reference is a
   reachable broken customer journey. No checker was weakened.
6. **Production backend attestation remains open.** The live release still
   reports `57ce6f309`, built 2026-11-14T06:40:46.653Z, without the new billing
   handler manifest. The Production source artifact must be verified there.

## Type gate evidence

The read-only historical comparison rebuilt the source at the reviewed
baseline revision and reproduced its exact 109-diagnostic fingerprint:

```
before: 28071d5435443b552aa67e30f900f4ea098077a89671a7aab5f0433fe8ed89b3
after:  23386276a3c69dcf737e7a0b96d41142a7d66e5ce6aaae8e2d790cbd9e244af9
```

The complete raw output differed only here:

```
server/routes/procareRoutes.ts(1504,49) -> (1521,49)
TS7053: Element implicitly has an 'any' type because expression of type '0'
can't be used to index type 'QueryResult<Record<string, unknown>>'.
```

Mapping each current location back through unchanged source lines reproduced
the old fingerprint exactly. Diagnostic messages, codes, columns and
multiplicities were identical: added 0, removed 0, mapping failures 0.
Only the reviewed fingerprint was changed; its count, command and strict
comparison logic were preserved.

The focused safety configuration now explicitly includes the new billing
services, account uniqueness policy and operator router. Root baseline,
focused safety and server-only type checks pass. This is not a claim that the
project's 109 preexisting strict-root diagnostics have been eliminated.

## Account collision review

Two case-only email variants were created approximately 37 seconds apart.
Both have password credentials and tester flags; neither fact establishes
current ownership or makes either account disposable.

The earlier row has disabled subscription status and no matches in the reviewed
declared-reference and soft-reference checks. The later row is onboarded, has an
active contributor classification, saved data, an active clinic Studio with
pending verification, an inactive professional/client link and a revoked care
team relationship. Neither row selects a Stripe customer/subscription or has a
Stripe ownership-registry claim. No matching customer was found by either
stored email spelling in the audited Stripe account.

Review covered all discovered foreign-key references, 195 selected user/email
columns, accepted invitation matches, relevant identity-review records and
session user-ID references. Historical accepted invitations support continuity,
not present mailbox verification. No health measurements, message content,
password hashes, session tokens, invitation tokens or credential numbers were
retrieved.

There is no existing mailbox-verification/provider-identity evidence sufficient
to silently merge these identities. The later row is the stronger preservation
candidate, not an automatically adjudicated owner.

Safe options requiring separate decisions:

- Leave both unchanged and keep the email index/gate off while ownership is
  reviewed. This does **not** need to block independently approved billing
  protection.
- If the mailbox owner confirms that the earlier row is an abandoned duplicate,
  separately approve audited retirement/removal or reassignment to another
  genuinely verified address through the reviewed identity process. Preserve the
  later UUID, existing Studio, saved records and historical relationships.
- If the owner asserts distinct legitimate users, require distinct verified
  addresses and an explicit relationship-preserving plan.

Do not merely lowercase both rows, invent a disposable/plus-alias address, mark
an account archived and assume the unconditional index will then pass, or delete
the less-populated row based on record counts. Embedded JSON and unmodeled
references can require additional review before a destructive operation.

## SQL migration compatibility — read-only review

Observed shared Neon: PostgreSQL 17.11, `C.UTF-8` locale, non-null `users.email`
of type `text`, existing exact email/username uniqueness and partial Stripe
identity uniqueness. The role owns `users` and can create in `public`; users'
total relation size is approximately 848 kB. Proposed billing tables/indexes
and the normalization function/index are absent. Catalog checks and all account
queries ran in explicit read-only transactions.

### Billing operations migration

`server/db/migrations/billing-checkout-safeguards.sql` is additive and has no
conflicting existing object names. PostgreSQL 17 supports its UUID/text/JSONB,
timestamps, checks, partial unique indexes and advisory-hash dependencies.
No new foreign-key assumption about existing business/Studio/client schema is
required. Account, mode and exact subject partition both checkout and plan-
change reservations. The SQL was not applied to Neon.

### Email index migration

`server/db/migrations/account-normalized-email-uniqueness.sql` is compatible with
the existing `text NOT NULL` column and does not replace the current exact-string
indexes or rewrite rows. Its normalization handles the JavaScript trim whitespace
set. A matching read-only expression preflight found the one two-row collision:
**the unique-index statement will correctly fail today**.

Apply neither file implicitly through startup, `db:push` or Publish.
For a separately approved controlled migration:

1. Verify the exact external-Neon target and object definitions; obtain explicit
   approval for the specific file and shared-schema consequence.
2. Use one bounded transaction per approved file, `ON_ERROR_STOP`, a 5-second lock
   timeout, a 60-second statement timeout and an explicit trusted `public` search
   path. A failed index must roll back its preceding function creation rather
   than leave a partially applied file.
3. Verify object definitions, partial-index predicates and `indisvalid`, not just
   names or `IF NOT EXISTS`. Never modify accounts to make the index pass.
4. Keep these SQL-owned objects out of generic schema-push reconciliation.
   Future changes to the immutable normalization function require explicit
   index-consistency/reindex review.

**The billing migration and activation may be approved independently of the
email migration.** Keep `ACCOUNT_EMAIL_UNIQUENESS_ENABLED` off until ownership
resolution and index readiness; no flag depends on automatically enabling the
other.

## Checks performed

- Root strict baseline check: passed after exact location-only review.
- Focused safety type check: passed with the new billing scope included.
- Server-only type check: passed after correcting SDK customer-union narrowing.
- Hydration schema contract type check: passed.
- Isolated PostgreSQL/provider fixtures: 36 passed, including deleted-customer
  rejection without creation of a payable session.
- Billing, identity/access, Studio/Organization/Academy and protected Fridge
  contracts: 180 assertions verified across 19 Jest suites. Two suites initially
  lacked the synthetic Studio price in the sanitized environment; all 39
  assertions in those suites passed after adding that fixture configuration.
  No live price or credential was used.
- Client and server production bundles: passed in a temporary source snapshot,
  without rewriting the workspace's build metadata or starting an app.
- Production-support artifact markers and 76 support contract tests: passed.
- Offline Feature Intelligence integrity: passed; 59 tool tests passed.
- Navigation checker unit tests: 18 passed.
- Full `validate --no-start`: **failed** on the broader navigation source check,
  before its later stages. The individual safe type/access stages above were
  then run separately; this does not convert the full gate to a pass.
- No application restart, live authenticated checkout, external Stripe test
  object creation, webhook replay, shared migration or live alert was performed.
- Normal chunk-size warnings remain; successful compilation is not runtime
  Production attestation.

## Development → GitHub → Production

1. **Development review:** review the small type/configuration/customer-guard
   diff and its test; preserve all existing feature and clinical release holds.
   Complete the navigation triage without weakening the route checker.
2. **Validate:** run the normal no-start validator, focused safety and reviewed
   root type checks, isolated billing tests and production builds/support
   contracts. Real provider behavior still needs a separately authorized
   isolated Stripe-test-account integration and verified account/mode identity.
3. **GitHub dev:** review and commit intended changes on clean `dev`; recheck
   ancestry. After promotion approval, use `npm run push` rather than force-push
   or bypassing hooks. No GitHub write was performed here.
4. **Reviewed Production PR:** compare GitHub `dev` against `production`,
   preserve unrelated release holds, and approve/merge only the reviewed scope.
   Fresh read-only remote refs matched the cached dev and production identities;
   neither proves the separately running Production artifact.
5. **Production workspace:** verify cleanliness, preserve unique local work,
   fetch and synchronize reviewed source without `reset --hard`, forced
   replacement or discarding publication history. Record the exact source SHA.
6. **Initial approved publication, gates off:** verify the compiled artifact and
   normal controlled startup policy in the Production workspace; publish there
   only after explicit approval. Confirm `/api/health` initialized and
   `/api/release` exact build identity plus non-null loaded handler identifiers.
   A Development publish is never a substitute.
7. **Separately approved shared schema:** apply and verify only the authorized
   billing SQL under the bounded procedure above. Apply the email SQL only after
   its separate ownership/index decision.
8. **Separately approved activation:** set Production-only
   `BILLING_CHECKOUT_SAFEGUARDS_ENABLED=true` and republish/restart through the
   approved Production process. Leave the email flag off for billing-first
   release. Enable it later only with its valid index.
9. **Verify after activation:** exact expected release/build; initialized health;
   billing enforcement; `billingSafety.checkoutEnabled=true`; intended email
   flag; loaded `durable-subject-checkout-v1` and
   `exact-selected-provider-pair-v1`; valid indexes; fresh account scan;
   administrator+MFA operator access; configured notification delivery; original
   selected subscription and Pro access unchanged. Do not create a live payment
   merely to test the gate.

The actual live domain was independently re-established from the enabled
canonical live Stripe webhook, not this Development workspace's deployment URL.
The webhook remains enabled for the expected checkout/subscription/invoice events.

## Separate renewal-stop approval

Do not wait for account-email cleanup to **request** the bounded protective
decision. No-renewal scheduling does not require the new database tables, and
refund settlement is not a prerequisite.

Before executing any approved live change, verify the current Production exact-
pair entitlement handler from its actual artifact, the live Stripe account/mode,
the original selected app/registry pair, all four subscription owners/prices and
the three duplicates' current period ends. Existing ledger evidence shows
duplicate updates rejected with identity conflicts while original updates were
processed; that is supporting evidence, not full artifact attestation.

The proposed action is only:

```
POST /v1/subscriptions/{one_exact_approved_duplicate_id}
cancel_at_period_end=true
proration_behavior=none
Idempotency-Key: mpm-no-renewal:{same_subscription_id}:2026-12-07:v1
```

Perform one at a time, read back the provider flags and unchanged paid-through
date, inspect the resulting webhook/ledger outcome, and verify the original
app/registry pair and active Pro access before proceeding. Stop and escalate on
any identity, access, owner, price, mode or state mismatch. If an outcome is
unknown, verify it before retrying; do not mint another key to bypass uncertainty.

Do not touch the original subscription, immediately cancel, refund, create a
customer/subscription/invoice, change plan/quantity/anchor, or update app accounts.
Period-end scheduling is reversible only before the end and reversal needs its
own approval. Git/database rollback cannot reverse a Stripe operation.

The exact three IDs, customer IDs, Chicago deadlines and proposed keys are in the
private review. The earliest duplicate renewal is **December 7 at 7:39:15 AM CST**.
The original August 30 subscription remains active, with November 30 renewal.

If current Production artifact verification cannot be completed promptly, the
founder must separately decide whether to authorize a tightly supervised
emergency renewal-stop action despite that specific verification gap. This
document neither accepts the gap nor executes the action.

## Refund/direct-payment hold

At the final read, four $29.99 refunds were `pending`, each with
`pending_reason=insufficient_funds`: $89.97 on the three duplicates plus $29.99 on
the retained original, totaling $119.96. Pending is not succeeded, even where
Stripe charge-level refunded amounts/flags are already populated.

The possible $179.94 outside-Stripe payment is **unconfirmed**. If all four
pending refunds succeed and that direct payment also occurs, total compensation
would be $299.90. That is $29.99 above the original duplicate-only $269.91 target.
Confirm whether the original-subscription refund is intentional goodwill or an
error before approving any additional payment. Do not assume it can be cancelled,
that the direct payment happened, or that pending refunds have settled.

No additional refund or payment is authorized. Reconcile the four real refund
IDs, final settlement states, the intended compensation total and any verified
direct-payment receipt separately from renewal protection.

## Approvals required

1. Three exact duplicate no-renewal updates only, after the specified preflight.
2. Explicit disposition of the fourth pending refund and intended compensation
   total; confirmation of any direct payment with minimal receipt evidence.
3. Mailbox-owner review and the precise identity correction, if any. No silent
   canonical-account selection or cleanup.
4. Navigation release-blocker work and isolated Stripe-test integration.
5. Reviewed GitHub promotion, Production source synchronization/publication,
   each shared migration, and each activation stage separately.
