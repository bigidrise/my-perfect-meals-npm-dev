# Business Pilot — Development Stripe isolation

## Status

Source correction and isolated verification complete. **Not activated or loaded
into the running Development application.** A separately approved controlled
restart is still required. Both Business Pilot activation flags remain unset/
disabled in Development and Production configuration.

No credentials, environment settings, database records or Production application
were changed. No restart, invitation, account change, Organization creation,
publishing, GitHub push or Stripe API request was performed.

## Isolation coverage

### SDK boundary

All ten runtime server Stripe imports use the shared guarded SDK. In Development
the SDK's per-instance sender is intercepted before any HTTP transport, covering
ordinary resources, nested checkout/portal APIs, raw requests, v2 APIs,
background users and indirectly injected clients. Instance and static webhook
verification are blocked too.

The runtime decision is immutable after import. A billing-owner override cannot
reopen a Development process. Production and credential-free unit-test runtimes
retain the genuine SDK. Unspecified runtimes fail closed.

The interception is deliberately locked to the currently installed SDK version.
A dependency change stops Development startup until the interception is reviewed,
rather than silently removing protection.

### HTTP boundary

Development Stripe/promotions and billing-resource requests return a no-store
503 with `DEVELOPMENT_STRIPE_ISOLATION` before webhook or API handlers execute.
This includes reads, checkout, portals, reconciliation and renewal. The free
invitation, claim, Organization-creation, workspace-selection and authentication
paths remain available.

### Database backstop

The application pool and checked-out transaction clients reject financial-table
mutations, user paid-plan/Stripe fields, Studio/personal subscription fields,
Business Stripe fields and paid commercial transitions before submitting SQL.
Parent deletion, DDL and opaque procedural commands are conservatively blocked
to prevent financial FK/cascade or dynamic-SQL changes.

Both promise and callback queries are covered. Unknown named/prepared query text
fails closed. Free Organization inserts may contain inert DEFAULT/NULL billing
columns, but cannot explicitly supply a Stripe subscription/customer reference.
Free activation and permitted Organization clocks remain writable once their
separate approval is granted. Production query handling is not replaced.

## Verification

**163 tests passed across seven suites.** The three new suites contain 76 cases;
87 existing billing/startup-repair/free-pilot regression cases also passed.

Tests used synthetic keys, prices, tokens and accounts, mocked HTTP/SQL transports,
and a child environment stripped of real database, Stripe, AWS and email-provider
credentials. No application bootstrap or database connection was launched.

Coverage includes:

- Thirteen SDK operation families with zero calls to an injected HTTP transport.
- Static webhook blocking and immutable runtime decisions.
- Early HTTP rejection before handlers can authenticate or write.
- Pool/transaction-client SQL, callbacks, named queries and CTE mutations.
- Actual Drizzle-generated rejected paid writes and accepted free Organization
  inserts using the existing Business schema.
- Rejection of Stripe-backed inserts even with a free-mode label.
- Accepted nonfinancial canonical-workspace upserts and rejected parent upserts
  that hide Stripe assignments outside their INSERT column list.
- Production sender/webhook/query pass-through.
- An AST audit preventing unguarded runtime Stripe imports.
- Pre-import safe-start initialization, occupied-port refusal and Production/
  ambiguous-mode refusal.

One existing webhook fixture now mocks its unused database import explicitly,
so it cannot construct a real pool. Regression tests use synthetic price IDs,
not workspace payment configuration.

`npm run check:release-types` passed with the exact reviewed **121-diagnostic**
baseline. The baseline file was not changed. `git diff --check` passed.

## Safe-restart audit

The configured command remains:

```text
DEVELOPMENT_SAFE_RESTART=true SKIP_DEVELOPMENT_ACCOUNT_MAINTENANCE=true npm run dev
```

`npm run dev` explicitly selects Development and enters the dependency-free
bootstrap. The bootstrap initializes immutable maintenance suppression and checks
port availability before importing the application. It refuses Production/
deployed or ambiguous safe-start settings. Client Production branding cannot
override that decision.

Existing guarded launch sites suppress:

- Deferred migration blocks and awaited boot migrations.
- Clinic/release schema mutation, Organization seeding and account maintenance.
- SMS/reminder/check-in/retention/trial jobs.
- Business Pilot delivery polling.
- Voice recovery and Studio video purge workers.
- Storage diagnostics and other deferred maintenance blocks.

The route-import voice worker also checks the same suppression policy. Remaining
database keepalive and health warmup are read-only; in-memory query-cache expiry
does not mutate Neon. Request authorization and read-only readiness checks remain
active. Suppression is not a general bypass of request security.

These conclusions are source-audit and isolated-policy results, not evidence
from a new real application boot. No restart was authorized or attempted.

## Files changed

New runtime files:

- `server/services/developmentStripeIsolation.ts`
- `server/services/isolatedStripeClient.ts`
- `server/services/developmentBillingWriteGuard.ts`
- `server/middleware/developmentStripeIsolation.ts`

Wiring: `server/db.ts`, `server/index.ts`.

SDK imports: `server/routes/admin.ts`, `businessRoutes.ts`, `coaching.ts`,
`organizationWorkspaceRoutes.ts`, `promotionRoutes.ts`, `stripe.ts`,
`stripeCheckout.ts`, `stripeWebhook.ts`, `studioStripeRoutes.ts`, and
`server/services/stripeProcare.ts`.

Tests: `server/tests/developmentStripeIsolation.test.ts`,
`developmentBillingWriteGuard.test.ts`, `developmentStripeSafeStartup.test.ts`,
and the isolated-fixture correction in `stripeAdverseSnapshotWebhook.test.ts`.

## Remaining risks / approval boundary

1. The currently running application has not loaded this correction. Do not
   treat its billing routes as newly isolated yet.
2. A controlled, separately approved restart must confirm safe-mode logs,
   readiness and runtime isolation before any invitation or activation.
3. The guard is intentionally conservative: Development paid-plan edits, parent
   deletion and DDL are unavailable. Future SDK upgrades or additional billing
   schemas require review. TEST-mode payment testing is also blocked until a
   separate source/configuration approval changes this policy.
4. This is an application-process boundary, not a Neon permission change. It
   does not block other workspaces or separately executed external tools.
5. Existing-account eligibility, MFA/readiness, personalized link generation,
   activation and Organization creation have not been exercised against real
   accounts. They still require explicit account-specific approval.

Production remains untouched. No Production deployment is authorized.
