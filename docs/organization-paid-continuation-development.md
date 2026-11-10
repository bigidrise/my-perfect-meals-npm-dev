# Organization paid continuation: Development review

## Scope and release boundary

Existing expired onboarding-pilot Organizations may purchase the existing flat
USD $44.99/month `clinical_business_monthly` product, quantity one. Personal
Clinical access, professional Studio subscriptions, and the proposed Business +
ProCare bundle remain separate and unchanged.

`ORGANIZATION_PAID_CONTINUATION_ENABLED` defaults off. No environment setting is
changed by this implementation. Both founder-pilot switches remain independent;
enabling this purchase path must not activate founder invitations or their schema
workflow. Paid-event delivery and reconciliation never depend on the purchase
switch remaining enabled.

## Continuation and payment evidence

- The existing authenticated Organization-owner quote and checkout routes are reused.
- The pilot must have ended at its actual timestamp, with an active Organization record.
- The trusted Stripe price must resolve to USD 4499 cents every one month.
- Explicit matching price/terms consent is required before reserving a new purchase.
- Minimal financial evidence is stored in the existing consent ledger before Stripe
  Checkout is created. No schema migration or bootstrap DDL was introduced.
- Existing reservation, ownership, session reuse and verified reconciliation safeguards
  remain in place. A completed but unresolved checkout must not become another charge.
- Consent-tagged new checkout, invoice and subscription activations verify the same
  ledger. Historical untagged subscription delivery remains compatible.
- Canceled/failed/unconfirmed new purchases do not constitute paid activation.
- The Organization identity and related records are retained.

## Rewardful audit and approved minimum correction

The older Production eligibility policy offered setup after an unpaid pilot ended.
The stricter existing policy was Development-only and coupled to a different campaign
rollout. The founder separately approved the minimum eligibility correction.

With the new continuation switch enabled, new Organization setup/attachment requires
recorded paid Organization activation plus read-only Stripe verification of an active
subscription, the trusted Organization product at quantity one, and a positive paid
latest invoice. Personal/ProCare products and the checkout-return URL cannot qualify.
This does not change campaign selection, campaign terms, commissions, existing
affiliate identities, referral records, or payouts.

Existing linked affiliate management is retained through commercial changes.
An explicit active `authorized_arrangement` remains a separately reason-coded legacy
exception; it is not represented as verified Stripe payment and does not show the paid
success prompt. A temporary/expired pilot or an unrelated personal grant is not this
exception. Existing arrangements are preserved, not created or modified here.
Production with the new switch off retains its existing legacy/contractual behavior.
Any other unlinked contractual exceptions require explicit review before rollout.
Do not delete commission or referral history when commercial access ends.

Webhook/reconciliation handles Organization activation, not external affiliate
creation. Affiliate creation remains an explicit, authorized action through the
existing Organization Partner & Revenue flow and its existing claim safeguards.

The dashboard offers the success prompt only from server-recorded paid activation
with the new rollout enabled and a matching Organization affiliate summary. It is
acknowledged per owner/Organization in browser storage. The primary action opens the
existing Partner & Revenue route; linked accounts receive management instead.
This is browser-local one-time presentation, not cross-device persistent acknowledgement.

Referral attribution remains separate from professional care relationships: the
existing Rewardful referral token is attached to consumer checkout. No client-seat
consumption or professional Studio creation is added to the referral workflow.
Live provider campaign configuration, payout behavior and end-to-end attribution
are not attested by mocked tests.

## Financial consent retention: proposed, not legally approved

The proposed period is **three years after effective subscription termination**,
subject to legal review and applicable preservation obligations.

No automatic deletion, retention worker or schema alteration is implemented.
Before Production activation, the policy owner must approve:

1. The applicable jurisdiction, lawful purpose and exact retention period.
2. The authoritative effective-termination date, including cancellation reversal,
   reactivation and multiple subscription histories.
3. Legal holds, disputes and other preservation obligations.
4. Erasure/minimization rules for direct identity references, with no cascade into
   another person's financial, clinical or invitation records.
5. Whether additional lifecycle/preservation fields are needed in the consent ledger.

## Production prerequisites

No push, merge, publish, main-workflow restart, live data migration, Stripe change,
Rewardful request or account repair is performed as part of this implementation.

Before release: review the diff and strict validation results; promote only approved
source through GitHub; verify the actual Production build; separately approve rollout
configuration. Check the consent ledger schema and financial write permissions
without enabling the founder-pilot switches. Verify the exact live Stripe account,
Organization price, authenticated return URLs, webhook signing and event delivery.
Verify the selected Rewardful campaign/terms and API availability without changing them.

Live sandbox-provider and installed-iOS checkout/return behavior remain release
verification prerequisites. The Organization continuation component uses the existing
web Stripe path, not an asserted native in-app purchase implementation.
Do not promise immediate checkout access until tested and published in Production.

## Current readiness and remaining integration gaps

The initial referral-first Organization has not been charged, repaired or enrolled
as part of this work. Its live subscription/Rewardful readiness is not attested by
this offline implementation. The new path remains unavailable until separately
released and configured; expiry alone does not activate it.

Remaining verification: actual Production source/build identity; consent-ledger
schema and grants; live Stripe product/account and signed delivery configuration;
Rewardful selected campaign/agreements, outbound API access and payout settings;
real consumer referral attribution and native checkout/return.

The existing account API supplies referral link/token and an external management
entry when available. Organization-owned affiliate and partner records hold the
identity; Revenue Center displays existing performance and history. Consumer
checkout uses the Rewardful referral token independently of care/client membership.
Stripe payment makes an Organization eligible; it does not create a Rewardful
affiliate or award a commission by itself. Enrollment remains owner/admin-initiated,
with existing API configuration, claim and linkage checks. No new enrollment
approval process or commission agreement was invented.

Existing source policies differ: the legacy Organization record defaults are
40% for 60 months, while the Development founding campaign specifies 50% for
48 months. These are source configuration values, not a new agreement or
attestation of live Rewardful settings. Campaign selection still uses the existing
Development campaign versus configured Production campaign; the new switch does
not change rates, durations, referral attribution or payout configuration.

Past-due/canceled/failed Organizations lose new paid-only onboarding eligibility.
Existing linked accounts remain manageable, with history and payouts untouched.
Verified reactivation can restore new onboarding eligibility. Any change to ongoing
referral or payout rights must be separately approved against the actual agreement.

## Exact changed files and principal entry points

Implementation:

- `server/services/organizationPaidContinuationPolicy.ts` — independent rollout,
  expired-pilot purchase authority and exact continuation-price validation.
- `server/routes/stripeCheckout.ts` — owner quote and Organization checkout handlers.
- `server/services/organizationCheckoutConsent.ts` — minimal ledger and new tagged
  checkout/subscription evidence verification.
- `server/routes/stripeWebhook.ts` — checkout, invoice and subscription activation.
- `server/services/stripeReconciliationService.ts` — owner-bound checkout reconciliation.
- `server/services/organizationRewardfulPolicy.ts` — independent paid-only eligibility,
  existing explicit-arrangement exception and read-only payment verification.
- `server/services/organizationPartnerRevenueService.ts` — lifecycle derivation/resolution.
- `server/routes/affiliateRoutes.ts` — explicit Organization setup and identity-preserving claims.
- `server/routes/businessRoutes.ts` — server-recorded paid-activation evidence on owner dashboard.
- `client/src/pages/BusinessDashboard.tsx` — matching Organization onboarding integration.
- `client/src/components/business/OrganizationPaidOnboarding.tsx` — scoped acknowledgement and navigation.
- `client/src/components/business/OrganizationPaidSuccessPrompt.tsx` — accessible success dialog.

Verification:

- `server/tests/organizationPaidContinuation.test.ts`
- `server/tests/organizationPaidContinuationRoutes.test.ts`
- `server/tests/organizationPaidRewardfulPolicy.test.ts`
- `server/tests/organizationRewardfulLifecycle.test.ts`
- `server/tests/organizationRewardfulSetup.test.ts`
- `server/tests/stripeAdverseSnapshotWebhook.test.ts`
- `client/src/lib/__tests__/organizationPaidOnboarding.test.tsx`
- `tsconfig.safety-check.json`

Report and durable policy context:

- `docs/organization-paid-continuation-development.md`
- `.agents/memory/pilot-erasure-and-receipt-retention.md`

The existing `OrganizationPaidContinuation.tsx` purchase component is reused unchanged.

## Regression results

**209 tests passed across twelve suites.** Databases/providers are mocked in the
changed purchase, consent, Rewardful and signed-webhook fixtures. No real payments
or affiliate accounts are created. Coverage includes:

- independent default-off purchase policy with both founder switches off;
- exact expiry, current consent, trusted flat price, owner/Organization scope;
- open-session reuse and completed-checkout reconciliation instead of repayment;
- active/expired unpaid pilots, failed/canceled/incorrect products and invoices;
- legitimate paid subscriptions and explicit authorized-arrangement exceptions;
- signed callback retry, consent evidence and duplicate event acknowledgement;
- existing affiliate identity preservation and manager authorization;
- server-confirmed prompt, one-time browser acknowledgement, workspace isolation,
  unverified-return rejection and existing management navigation.

The public Development sign-in page was visually checked. Authenticated live
payment/onboarding was not exercised against shared accounts. The main workflow
was not restarted because startup may perform shared-database maintenance.

| Validation | Result |
| --- | --- |
| Focused regression suites | 209 passed across 12 suites |
| Strict safety types | Passed |
| Production client build | Passed; existing large-chunk warnings |
| Production server build | Passed |
| Strict release-type fingerprint | Blocked: 109 diagnostics differ from the reviewed fingerprint |
| Baseline and validator | Unchanged; no suppression or gate weakening |
| Public Development preview | Sign-in page rendered |

No release-readiness claim is made while the strict release-type gate remains red.

### Release-type blocker investigation

The unchanged validator was also run against a temporary snapshot of the
pre-change tracked HEAD, using the same dependencies and stable build-version
handling. Both snapshots returned **the exact same 109 diagnostic lines**,
including paths, locations, codes, messages and multiplicity: zero additions,
zero removals. This is not a source-line-movement difference from this work.

Both produced fingerprint
`86ce5ce161a64df58b5ca6a635861672941ab3282d1b385e75bf5342fb9e11e9`;
the reviewed baseline expects
`414c8b7ab1a15509a2b756467c98b58942678d780479bb9f98e703a2d7ff6f44`.
Thus the gate mismatch predates this implementation. Its underlying reviewed-
baseline discrepancy still requires separate investigation/approval; matching
counts alone are not grounds to refresh it. No baseline or validator was changed.
