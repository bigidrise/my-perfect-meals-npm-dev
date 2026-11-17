# Founder-directed billing preflight — November 16, 2026

## Authority and result

Preparation and read-only investigation only. **No live Stripe operation,
account change, shared migration, GitHub promotion, publication or activation is
authorized.** Execution requires the founder to review the results and give a
new, explicit execution approval.

The three duplicate renewal-stop targets are prepared but **not execution-ready**:
their exact Stripe objects and retained app identity are confirmed, while the
currently executing Production entitlement/cancellation handler has not been
attested. This is independent of the broader permanent-protection rollout.
Navigation and email cleanup must not become prerequisites for requesting the
bounded protective decision.

Exact account/customer/subscription/refund identifiers are in the delivered
private preflight and ledger, not duplicated in this shared-source document.

## Fresh Production/account/ownership preflight

Completed November 16 at **21:36:28 UTC / 3:36:28 PM CST**.

| Check | Result |
| --- | --- |
| Live Stripe account | Matches the previously audited account |
| Four exact subscription/customer pairs | Match the original and three approved duplicate identities; all live, active and renewing |
| Price/quantity | Same retained historical MPM price, USD 29.99 monthly, quantity 1, licensed usage |
| Scheduling ambiguity | No subscription schedules, pending updates or pending invoice-item interval |
| Latest invoices | Paid, with zero amount remaining; this does not establish refund settlement |
| Subscription ownership metadata | All four subscriptions identify the same exact app user |
| Customer metadata | `metadata.userId` absent; not contradictory ownership and not permission to backfill |
| App selection and ownership registry | Only the original customer/subscription pair is selected and claimed; no other user selects these identities |
| Pro state | Stored Personal plan `mpm_premium`, active, webhook-derived, not a tester bypass; original provider subscription active |
| Actual signed-in Production Pro journey | Not exercised; stored/provider evidence is not a new authenticated browser-access attestation |
| Canonical live webhook | Enabled, live, expected subscription/checkout/invoice events, canonical Production domain |
| Production health | HTTP 200, initialized, `ok=true`, billing enforcement true |
| Production release | HTTP 200; `57ce6f309`, built November 14 at 06:40:46.653 UTC; no billing-handler manifest |
| Exact loaded Production backend | **Not attested** |
| Live action authorization | **Not given** |

The live release's backend revision is not available locally. The repository
API lookup returned HTTP 401, so it supplied no source evidence. Read-only Git
transport still successfully returned the remote branch heads; do not describe
this as a proven Git-push authentication failure.

Historical ledger evidence shows two failed subscription-update events with
identity conflicts for each duplicate and three processed updates for the
original. This supports the intended identity boundary but does **not** attest
the currently running cancellation handler or its behavior at period end.

### Required evidence from the actual Production workspace

Use this read-only instruction there; do not restart, import the server, run
migrations, replay a webhook or publish:

> Identify the currently deployed backend entrypoint from the actual deployment
> run configuration. Return its published revision/build identity and artifact
> SHA-256, and review the corresponding compiled handler bindings for
> `customer.subscription.updated` and `customer.subscription.deleted`. Establish
> that only an exact match to the selected Stripe customer **and** selected
> subscription can change the retained user's Personal entitlement, and that a
> duplicate subscription cannot clear or replace it through a metadata-only
> fallback. Correlate the artifact with the currently serving release. Return
> only the bounded relevant code/manifest evidence, without credentials,
> customer data or entire minified bundles. Merely finding a version string in
> source, a GitHub branch or an unused module is insufficient.

If that evidence cannot be obtained, report the gap. This instruction does not
waive it or authorize an emergency live action.

## Bounded renewal-stop plan — preparation only

The private report contains the three exact target IDs, customer IDs and stable
per-subscription idempotency keys. The original August 30 subscription is
explicitly excluded.

For each approved duplicate, the proposed update is only:

```text
cancel_at_period_end=true
proration_behavior=none
```

Installed Stripe SDK 19.3.0 supports both update parameters; read requests used
API version `2025-08-27.basil`. An actual update was not tested against a live
subscription. Do not add `invoice_now`: it is not a subscription-update
parameter. Do not invoke immediate cancellation, invoice creation/finalization,
price/quantity changes, billing-anchor changes, refunds or metadata repairs.

The December 7 renewal times in Chicago are 7:39:15, 7:41:25 and 7:42:57 AM CST.
The original retains its November 30 renewal.

After exact Production-handler evidence and a separate execution approval:

1. Refresh the exact account/mode, all four object identities, original
   selection/claims and active Pro state immediately before starting.
2. Reject foreign ownership, changed price/customer, schedules, pending updates,
   changed period boundaries or unexpected nonterminal state. If a duplicate is
   already correctly scheduled, verify it rather than writing again.
3. Update one approved duplicate with the fixed two-field payload and its
   original stable key. Do not rotate the key to escape an unknown result.
4. Read the object back: same customer/price/quantity/anchor/period end, active
   with period-end cancellation scheduled; no new immediate invoice.
5. Observe the resulting webhook/ledger outcome and verify the **original**
   selected customer/subscription, ownership claims, active Personal Pro
   entitlement and actual authorized Pro access before another update.
6. Stop on an unknown result, unexpected pending/retrying event, ownership/access
   change or invoice. Preserve request IDs/readbacks; no automatic refund,
   account correction, immediate cancellation or reversal is authorized.
7. After all three, repeat the aggregate selected-entitlement check and verify
   the next-day monitoring plan, including the eventual period-end events.

An existing identity-conflict failure on a duplicate must not be mistaken for
successful webhook processing; inspect its meaning and do not replay it merely
to clear a ledger status.

## Navigation findings: one new regression, preexisting debt remains

The same current source-only analyzer was run against:

- Pre-billing GitHub dev source: `a4efd18e37de32202fe23e3fb4ad914bc08ad9a2`.
- Current reviewed source: `38295b9b24e8e06acafced3d820e863d3338d45f`.

Comparison matched the multiset of file, reference kind and expression/value,
not line numbers; billing-related line shifts do not create false "new" issues.
The route authority and navigation-checker source did not change between these
revisions. Both register 247 routes.

| Finding | Before billing work | Current | New |
| --- | ---: | ---: | ---: |
| Invalid literal destinations | 71 | 72 | **1** |
| Unresolved expressions | 366 | 366 | **0** |
| Unresolved route registrations | 0 | 0 | 0 |
| Unsupported route registrations | 0 | 0 | 0 |

The actual current navigation command exits 1: 1,388 scanned files, 247 routes,
1,141 matching references, 72 invalid literal destinations.

The one new invalid reference is:

```text
client/src/pages/PricingPage.tsx:536
setLocation("/settings")
```

It is in the successful existing-subscription plan-change path. `/settings`
is not a registered route. The smallest correction is one line:

```diff
- setLocation("/settings");
+ setLocation("/dashboard");
```

`/dashboard` is registered and already used by this page's authenticated Back
action. This is a proposal only: the founder requested identification of the
smallest correction, so no app-source fix was applied in this preflight.
The older dynamic fallback to `/settings` in the same page is unchanged and is
part of the unresolved-expression review, not a second new literal finding.

The 71 preexisting literals comprise:

- 34 registry/configuration entries: 22 Chef feature entries, 7 macro-source
  entries and 5 coaching capability entries. Metadata is not automatically dead
  or safe; consumers and route intent require review.
- 7 references in explicitly legacy source folders.
- 30 other UI/Router references, including old food redirects, creator returns,
  meal hubs, voice destinations and a physician profile link.

All 366 unresolved expressions are preexisting. They include dynamic/imported/
relative values and custom callbacks; they are **not** 366 proven broken links.
The checker requires review but does not fail solely on these destination
expressions. It would fail on unresolved route registrations; there are none.

The one-line correction would leave **71** literal failures. Do not claim it
makes the release green. Resolve the remaining findings by demonstrated
callsite intent, with explicit review of conditional/legacy reachability and
clinical gates. Do not suppress failures, manufacture route aliases, expand
frozen features, change role access or mark unresolved destinations verified.

A complete per-reference provenance CSV accompanies the private report.

## Refund ledger

Fresh review found the same four actual refund objects, each USD 29.99,
`pending`, reason `insufficient_funds`: three duplicate payments (USD 89.97) and
one original-subscription payment (USD 29.99), totaling USD 119.96.
No further refund was found on the twelve previously audited charges.
No additional refund/payment was initiated.

The possible USD 179.94 direct payment remains **unconfirmed**.

These are reconciliation scenarios, not payout instructions:

- If the three duplicate refunds settle and no direct payment occurred:
  USD 179.94 of duplicate-only compensation remains unreimbursed.
- If all four settle, no direct payment occurred, and the original refund is
  intentionally counted toward the same USD 269.91 target: USD 149.95 remains.
- If all four settle and USD 179.94 was also paid directly: total compensation
  is USD 299.90, USD 29.99 above that original target.

Do not call a pending amount settled, treat charge-level refunded flags as
proof of receipt, automatically net an original-payment refund against duplicate
liability, or infer whether the extra original refund was intentional goodwill.
Those decisions require founder confirmation. Do not reverse a refund or ask
the customer to repay anything under this preparation.

## Email ownership and schema independence

The two reviewed collision rows remain unchanged. The earlier account is
disabled; the later account remains onboarded with contributor access and
relationships previously reviewed. Neither selects a Stripe identity.
No fresh mailbox-ownership proof was established. No merge, deletion, rename,
verification assertion or migration was performed.

The billing operations and plan-change tables remain absent; the normalized
email index remains absent. Shared-Neon DDL still needs separate explicit
approval. The collision blocks only the normalized-email migration/activation,
not an independently authorized billing schema/activation or bounded renewal
stop. Keep the email gate off for a billing-first rollout.

## Safe promotion sequence — not executed

1. Review the proposed Pricing correction and resolve the remaining navigation
   failures without weakening the checker. Complete the normal no-start release
   gate and separately authorized isolated provider integration/alert delivery.
   Existing fixture/type/build results stay valid for unchanged source; they do
   not turn the failing aggregate gate green.
2. Review/commit only the intended Development scope. Recheck remote ancestry
   and the full `production..dev` scope; preserve unrelated release holds and
   unique Production work.
3. After separate GitHub approval, use the normal guarded dev push and a
   founder-reviewed Production PR. Do not force-push, skip hooks or blindly
   replace the Production branch/workspace.
4. In the actual Production workspace, synchronize reviewed source and verify
   the actual compiled backend artifact, run configuration and default-off
   gates. No automatic startup is authorized here.
5. Obtain separate Production publication approval; publish there with new gates
   off. Confirm health, exact reviewed build and loaded handler manifest.
6. Obtain separate shared-Neon approval for the billing SQL only. Use bounded
   transactions/timeouts and verify table/index definitions and validity. No
   startup migration or generic schema push.
7. Obtain separate activation approval, enable only the billing safeguard flag
   in Production and publish/restart through the approved process. Keep
   `ACCOUNT_EMAIL_UNIQUENESS_ENABLED` off until its separate ownership/index
   review and approval.
8. Verify manifest flags/loaded handlers, schema readiness, account/mode,
   operator MFA, scanner freshness, actual alert routing, webhook behavior and
   the retained active Pro entitlement.

Fresh remote reads still show dev `a4efd18e37de32202fe23e3fb4ad914bc08ad9a2`
and production `22986b88fb2d113264fcd2dd2a50d94b67913aaf`.
These are repository refs, not proof of the serving Production artifact.

The bounded renewal-stop approval path is separate from this sequence. It must
not silently wait for navigation or email cleanup, and must not silently waive
the founder's exact Production-handler preflight requirement.
