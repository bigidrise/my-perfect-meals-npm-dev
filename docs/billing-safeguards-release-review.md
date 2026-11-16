# Billing safeguards — implementation and release review

## Authorization boundary

Development implementation and isolated testing only. Nothing here authorizes a
live Stripe operation, shared-Neon migration, account merge/deletion, source
promotion, publication, or Production-shell change. Both activation flags remain
unset/off in the existing environment.

The new SQL files are intentionally **not** imported by startup. Do not use
`db:push`, Publish, or an application restart to apply them implicitly.

## Implemented behavior

- `server/services/billingSafeguards/subjects.ts`: exact Personal/Family,
  household (when independently authorized), Studio, Organization, and
  client-professional subject identities. Current account-level Family plans
  occupy the same slot as Personal. Never infer another household or professional
  relationship just from an operator's user ID.
- `store.ts` and `checkout.ts`: PostgreSQL partial-unique current-operation
  constraint, durable immutable provider payload, operation-derived idempotency,
  customer/session compare-and-swap binding, same-session retries, and retained
  operation history. A different plan cannot bypass a pending subject slot.
  Only provider-proven expired/unpaid or terminal contracts can release a slot.
  Unbound operations older than the conservative 23-hour retry window require
  review, not a new key or payment.
- `inventory.ts` and `runtime.ts`: fully paginated provider inventory, historical
  customer discovery through subscription identity and retained ownership/event
  evidence, fail-closed ambiguity, and blocking of every nonterminal subscription
  state. Uses only explicitly configured MPM prices. External products, including
  Everfit, are not adopted, changed, cancelled, or refunded.
- All existing subscription-session creation paths are wrapped: consumer/family
  and Organization in `server/routes/stripeCheckout.ts`, Studio in
  `server/routes/studioStripeRoutes.ts`, and relationship billing in
  `server/routes/procareRoutes.ts` / `server/services/stripeProcare.ts`.
  Existing stronger service authorization and reservation checks remain.
- Generic consumer checkout rejects professional/Organization SKUs when enabled.
  The unused legacy ProCare webhook is retired on activation; the canonical
  signed raw-body, event-ledger-backed webhook remains authoritative.
- `monitor.ts` and `server/routes/billingSafeguards.ts`: account-wide read-only
  provider scans, durable review incidents, deduplicated operational log/Sentry
  alerts, scan freshness, administrator+MFA inspection/acknowledgement, and
  hourly/signed-event-triggered scans. They never auto-cancel or refund.
  Alert messages contain controlled codes/fingerprints/counts, not email or
  clinical payloads. Operator Sentry alert routing must be verified separately;
  storing/logging an incident does not prove someone received a notification.
- `planChanges.ts`, the authenticated `/api/stripe/plan-change/preview` and
  `/confirm` routes, and the existing Pricing page support explicit changes to
  one retained Personal/Family subscription, not a replacement subscription.
  **Policy implemented:** immediate plan change, no immediate charge or prorated
  credit, unchanged renewal date, selected recurring price at the next renewal.
  The user sees the price, renewal date and disclosure before confirming.
  Same-currency, positive-price monthly plans only. Conflicting, scheduled,
  delinquent, multi-contract or ambiguous cases require review. Discounts/taxes
  can affect the eventual invoice. Confirmations have stable idempotency, bounded
  consent validity and provider read-back. No new Checkout fallback exists.
- `server/prod.ts` exposes loaded checkout/cancellation implementation identifiers
  in `/api/release` after their actual modules/routes have loaded. This adds a
  future release-verification surface; it does not attest today's unchanged
  Production deployment.

## Account identity audit and changes

The live application has one primary password signup endpoint,
`server/routes/auth.session.ts`. Invitation and recovery flows reuse account
identity; no implemented Google/Apple/OIDC login callback or provider-linking
endpoint was located. Native App Store purchase handling is not OAuth signup.
Legacy generic `/api/users` creation is already retired, and generic user PATCH
does not allow email edits. The unused `server/db/repo.ts` get-or-create/profile
fallbacks are explicitly blocked under the new identity gate.

The old database enforces only exact-string `users.email` uniqueness. Signup
normalizes new values, but a preflight read plus an exact-string index does not
prevent legacy case/whitespace variants from existing or being inserted by other
paths. The old candidate query lowercases without trimming stored whitespace.

`account-normalized-email-uniqueness.sql` provides an immutable normalization
function matching JavaScript trim whitespace and a unique expression index
covering every user insert and email update. Addresses are not dot/plus-alias
collapsed. No existing accounts are silently selected, merged, renamed, deleted,
or marked verified. Signup conflict responses become generic sign-in/recovery
guidance and handle the actual normalized-index race constraint.

`accountEmailUniqueness.ts` defines explicit verified-provider linking
requirements: verified provider email, reauthentication as the exact target
user, and explicit link consent. There is no currently implemented OAuth flow
to attach this policy to; future provider support must use it and unique
issuer/subject ownership, never email-only linking.

Self-service profile updates cannot change login email under the gate. Existing
MFA-protected administrative identity review remains the supported recovery
path. **A new self-service mailbox-verification/email-change workflow was not
introduced, and existing emails were not asserted to be mailbox-verified.**
Administrative reviewers must establish mailbox/account ownership before any
separately authorized change. This limitation must not be presented as a fully
implemented OAuth or automatic mailbox-verification system.

Read-only audit found 202 accounts, one normalized collision involving two
accounts, and two noncanonical stored spellings. The uniqueness migration must
fail until that pair receives an individually authorized ownership review.
The audit does not imply that Tiffany has two accounts; her billing incident
was one app user with four Stripe customers/subscriptions.

## Migration review — no migration has run on shared Neon

1. Review the two SQL files:
   - `server/db/migrations/billing-checkout-safeguards.sql`
   - `server/db/migrations/account-normalized-email-uniqueness.sql`
2. Approve resolution of the existing normalized-email collision separately.
   Establish ownership, paid entitlements, related records and the intended
   account for each person. Do not merge or delete solely on an email match.
3. Confirm the external-Neon target through the existing approved procedure.
   Obtain explicit shared-database migration authorization. Use a bounded,
   operator-controlled transaction, lock/statement timeouts, and fail on any
   unexpected schema or collision. Stop on failure; do not alter records to make
   an index pass. For a large users table, review online index creation separately
   rather than applying this small-environment example unchanged.
4. Check definitions and validity of `billing_checkout_one_current_subject`,
   `billing_one_pending_plan_change`, session uniqueness, state checks, and
   `users_normalized_email_unique`. Check the normalization function body.
5. Confirm no generic Drizzle push proposes dropping these manually managed
   tables/indexes. These SQL-owned objects must remain release-managed.
6. Only after schema verification and source review may a separately approved
   release enable `BILLING_CHECKOUT_SAFEGUARDS_ENABLED=true` and
   `ACCOUNT_EMAIL_UNIQUENESS_ENABLED=true` in the intended runtime.
   Do not enable either flag on an unprovisioned runtime.

## Isolated validation commands

```
node scripts/test-billing-safeguards-isolated.mjs
npm run check:release-types
npx esbuild server/prod.ts --platform=node --packages=external --bundle --format=esm --outfile=/tmp/mpm-billing-prod-validation.mjs
```

The isolated runner creates and destroys its own loopback PostgreSQL cluster and
database, constructs a fresh child environment without inherited database/API
secrets, applies SQL only there, and uses in-process Stripe fixtures with no
network transport. It never accepts the shared `DATABASE_URL` as its target.
Fixtures cover races, retries, lost provider responses, restart recovery,
idempotency time boundaries, pending/completed/expired sessions, historical
customers, pagination, nonterminal contracts, legitimate independent subjects,
Everfit exclusion, scanner state, normalized-email races, unverified provider
link conflicts, and consented upgrade/downgrade of the retained subscription.

Existing focused Jest suites use a nonfunctional loopback database URL and a
nonfunctional Stripe fixture key. Retained-entitlement and stale-cancellation
regressions call the actual subscription service against transaction fixtures;
canonical webhook suites cover signed replay and claim behavior. These are not
live Stripe integration or authenticated Production-browser tests.

The original release type baseline was preserved. The strict fingerprint gate
remains blocked by a 17-line movement of one preexisting ProCare diagnostic.
Mapping that location back reproduced the original fingerprint exactly; all 109
preexisting diagnostic messages/codes remain. No new type error was suppressed
or added to the baseline. A reviewed reconciliation of this location-only gate
change is required before release; it was not silently approved here.

## Exact release steps and hold points

1. Review this implementation, the chosen no-proration plan-change policy,
   fixtures, and SQL. Review the remaining operational limits below.
2. Resolve the identity collision and obtain the separate shared-schema approval
   described above. Verify the schema, without activating it on shared
   Development by accident.
3. Resolve the location-only strict type fingerprint hold without accepting new
   diagnostics. Run the normal full release checks, reviewed server-only/pre-push validation,
   and authorized Stripe-test-account integration. The present work used
   fixtures only, not external Stripe object creation.
4. Obtain approval for normal GitHub promotion. No push/merge was performed by
   this authorization. In the Production workspace, verify the exact reviewed
   source and compiled artifact. Do not discard Production-only work.
5. Obtain explicit publication and activation approval. A Development publish is
   not Production. No publication is authorized by this document.
6. On the actual live domain, retrieve `/api/health` and `/api/release`; compare
   the exact expected build identity. After complete initialization, require:
   - `billingSafety.checkoutEnabled: true`
   - `billingSafety.emailUniquenessEnabled: true`
   - loaded checkout `durable-subject-checkout-v1`
   - loaded cancellation `exact-selected-provider-pair-v1`
   Verify the canonical signed webhook route and deployed exact-pair guard, not
   just the frontend manifest or source branch.
7. Verify schema readiness, monitor freshness, authenticated operator access and
   an actual configured alert destination. Run controlled noncharging/test-mode
   handler integration against the released code. No live checkout submission
   or event replay is authorized here.
8. Repeat the read-only full-account scan and selected-entitlement check.
   Only then ask for authorization of the exact customer remediation.

Production at audit time reported git SHA `57ce6f309`, built
2026-11-14T06:40:46.653Z, with billing enforcement enabled. That revision was
unavailable for backend source comparison in this workspace. The new loaded-
handler identifiers are not deployed there. Thus **Production checkout and
cancellation sign-off remains an explicit unresolved release hold**.

## Customer remediation — preparation only

Use the separately delivered, ignored audit/CSV for the exact original
subscription, three duplicates and nine invoice/payment-intent/charge mappings.
No refund IDs exist until actual refunds are created. Freshly recheck provider
state and authorization immediately before any action.

The preferred reversible protective step, **after deployed-handler verification
and explicit authorization**, is scheduling the three duplicates not to renew.
Leave the original subscription and all app identity/access fields untouched.
Verify the original pair and active Pro entitlements after each action.
Duplicates remain active-but-ending until their December 7 renewal boundary and
must be classified accordingly by the monitor.

Immediate cancellation is a separate irreversible decision and must suppress
proration/immediate invoicing so it cannot double-refund. It cannot be undone by
a Git or database rollback. Refund only the nine individually approved charges,
$29.99 each ($269.91 total), with fresh refund/dispute checks, stable provider
keys and an authorized durable execution record. Store actual refund IDs and
states; pending is not succeeded. Do not recreate subscriptions or recharge
customers to undo an operational mistake.

If release timing threatens the December 7 duplicate renewals, escalate for a
separate protective-action decision rather than silently waiting or acting.

## Remaining limits

- Default-off source is not deployed protection. Schema approval, identity
  resolution, publication, activation, exact handler verification and alert
  delivery verification remain required.
- PostgreSQL and Stripe cannot share one atomic transaction. This implementation
  makes ambiguous outcomes fail closed for recovery; it does not assert zero
  recurrence risk.
- Stripe Dashboard/manual/API activity outside the governed application can
  still create duplicates. Detection/alerts do not automatically reverse them.
- Price allowlists and immutable identity metadata must stay correctly managed.
  Unknown attribution produces review rather than adopting unrelated payments.
- Full-account provider enumeration is bounded at 50,000 subscriptions and
  fails closed if exceeded. Larger installations need a reviewed indexed
  inventory design, without trusting eventually consistent search alone.
- Legacy service-specific unbound reservations may still require manual review
  before reaching the generalized recovery layer. Do not rotate them to bypass
  a block.
- External Stripe test-account integration and real authenticated Production
  behavior have not been exercised. No email delivery or live Sentry alert was
  sent for this work.
- Main Development was not restarted: normal startup can execute shared-schema
  work. Compilation and isolated PostgreSQL lifecycle verification were used
  instead. The unrelated isolated Shopping workflow was not changed.

## Final verification result

- 35 isolated PostgreSQL/provider-fixture cases passed; the runner stopped and
  removed its own temporary cluster.
- 125 regression tests across 12 Jest suites passed, including the actual
  retained-subscription cancellation service and client plan-change consent.
- Production-entrypoint server bundle compiled successfully.
- The root compiler retained all 109 existing diagnostic messages/codes with no
  new diagnostic content. The strict release fingerprint gate remains blocked
  by one moved legacy diagnostic; the original baseline remains unchanged.
- `git diff --check` passed.
- Public Pricing rendered in the existing Development preview. The capture was
  signed out and showed the existing update overlay and unavailable authenticated
  workspace discovery; it does not attest authenticated checkout.
- Final read-only identity audit still found 202 accounts and one two-account
  normalized-email collision. Neither colliding row currently selects a Stripe
  subscription in its user record; that alone does not establish ownership or
  justify merging them.
- Final public Production release read still reported `57ce6f309`, the same
  November 14 build, and no new billing handler manifest. Production remains
  unchanged and unverified for this release.
