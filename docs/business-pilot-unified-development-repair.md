# Unified Business Pilot — Development repair

## Release boundary

This repair is Development-only and has not been approved for release or account correction. The new coordinated provisioning and authority require the existing activation/schema approval switches, `NODE_ENV=development`, and no deployment marker. Ordinary `/auth` never issues a pilot. Do not enable switches, run migrations, create fixture accounts on shared Neon, or publish as part of verification.

## Enrollment and recovery

- Preserve the dedicated invitation through login, registration, and MFA. Activation remains an explicit authenticated action.
- Private invitations retain email binding, token validation, revocation and invitation deadlines. The separately authorized reusable campaign remains reusable across accounts, but each account retains its original grant.
- The claim transaction records the personal window, provisions or reuses one eligible owner organization, creates its owner membership when new, and binds the organization to the activation row. New personal and organization windows are identical.
- Existing paid/authorized organizations keep their commercial and Stripe history. An organization already on a different onboarding pilot requires reconciliation; activation rolls back instead of resetting it.
- Multiple owned organizations require explicit selection. Other people's organizations cannot be selected. Non-owner membership is not authority to fund or adopt that organization.
- Canonical organization/location setup is a separate idempotent operation after commit. The persisted activation-to-business binding is its recovery checkpoint. Failure returns an error without consuming browser invitation context; repeat the claim to finish the same workspace, without another period or business.
- A late retry cannot create a workspace after expiration. A bound expired claim may return its original dates but cannot restore access.
- Studio access uses the existing private professional-access integration only for persisted canonical practitioner roles; verification, training, legal readiness, MFA, consent, tenant boundaries and explicit Studio disconnection remain authoritative.
- Consumer Clinical and Hydration access use server-issued bounded authority. Purchased plan keys are not rewritten. This does not grant affiliate eligibility or unpause features.

## Operational prerequisites

No new schema or migration is introduced. Existing Business Pilot activation tables and the existing organization/location uniqueness constraints must already be present and approved. An approved reusable campaign needs its existing issuer attribution. Deployment activation remains disabled for this repair.

## Proposed account reconciliation — separate approval required

Do not execute this procedure as part of the repair:

1. Re-read the account's immutable identity, active owner membership, organization pilot, and current grants in a read-only transaction. Verify the existing expiration remains **2026-11-11T15:41:27.737Z** (November 11, 2026, 9:41 AM America/Chicago). Stop on any discrepancy.
2. Obtain explicit approval naming the account and organization and authorizing access only for the remaining existing period. Verify professional identity separately; neither a name nor organization ownership establishes physician status.
3. In an explicitly approved transaction with row locks, record a separately identified, auditable reconciliation authorization: approval actor/time, source organization pilot, reason, exact original organization start/end, and correction time. Do not label it as an invitation redemption or invent token/claim history.
4. Use a dedicated reconciliation authority integrated into the same bounded access reader, not a fabricated activation-link row. The current invitation reader requires a genuine 720-hour activation window, so an ad hoc remaining-days row is not a valid substitute. This dedicated reconciliation reader/storage change requires separate implementation approval.
5. Do not change organization dates, original trial dates, paid plan keys, subscriptions, credentials, or affiliate state. Make the correction idempotent for that account/organization/source period.
6. Verify personal access, Hydration, role-appropriate Studio readiness and exact expiration; record a redacted audit receipt. Reversing the correction must revoke only that reconciliation authority.

No account correction, reconciliation storage, token issuance, or live writes were performed during this implementation.

## Verification and limitations

- Focused repair and invitation suites: **118 tests passed across 7 suites**.
- Additional Studio access middleware and organization/affiliate isolation checks: **17 tests passed across 2 suites**.
- Existing manual Studio provisioning, Studio status, organization identity and multi-organization owner suites also passed in the broader verification pass.
- One broader legacy source-text assertion in `procareAccessPolicy.test.ts` fails because it expects `providerHasProCareStudioAccess` directly in `procareInviteService.ts`; the unchanged facade delegates to `acceptStoredCareInvitation`. This mismatch exists in the original source and was not altered to make the test pass.
- Whole-project TypeScript remains blocked: 114 diagnostics versus a recorded 120-diagnostic baseline. The only diagnostics in changed files are the four unchanged legacy checkout-key constants in `client/src/lib/entitlements.ts`. There are no diagnostics in the new files. The release baseline was not refreshed or weakened.
- Development restarted successfully with automatic migrations, seeding, recovery and background maintenance suppressed. The unauthenticated mobile invitation page renders; its missing-token state does not activate a pilot.
- All activation, failure-recovery and concurrency checks used fixtures. Transaction serialization was modeled; no live PostgreSQL concurrency test or real-account end-to-end activation was performed.
- No new schema migration is needed by this repair. Controlled live activation testing and release approval remain prerequisites before promotion.
- Existing paid organizations keep their independent paid access and billing windows; the invitation does not replace those windows.
- Existing differently timed organization pilots require reconciliation, not automatic conversion. Reuse is limited to eligible owned organizations; other membership alone cannot authorize adoption.

## Exact changed-file inventory

Application:

```text
shared/businessPilotAccess.ts
server/services/unifiedBusinessPilotProvisioning.ts
server/services/businessPilotActivationPolicy.ts
server/services/businessPilotActivationService.ts
server/services/businessPartnerPilotService.ts
server/services/effectiveAccess.ts
server/middleware/requireAuth.ts
server/middleware/requireClinicalAccess.ts
server/middleware/requirePurchasedPlanEntitlement.ts
server/routes/businessPilotActivationRoutes.ts
server/routes/businessRoutes.ts
server/routes/hydration.ts
server/routes.ts
client/src/components/business/DevelopmentBusinessPilotActivation.tsx
client/src/components/Router.tsx
client/src/components/dashboard/HydrationDashboardCard.tsx
client/src/pages/my-biometrics.tsx
client/src/contexts/AuthContext.tsx
client/src/lib/auth.ts
client/src/lib/entitlements.ts
client/src/lib/subscriptionCheck.ts
```

Tests:

```text
server/tests/unifiedBusinessPilotProvisioning.test.ts
server/tests/unifiedBusinessPilotEntitlements.test.ts
server/tests/businessPilotActivationWorkflow.test.ts
server/tests/businessPartnerPilotService.test.ts
server/tests/businessPilotRouteAuthorization.test.ts
```

Documentation and durable product-policy memory:

```text
docs/business-pilot-unified-development-repair.md
.agents/memory/reusable-business-partner-pilot.md
```
