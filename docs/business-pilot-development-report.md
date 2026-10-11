# Business Pilot — Development implementation report

## Status and boundaries

Development source implementation and isolated automated testing are complete. This is not approval for live activation, Production, or real physicians.

**Subsequent safety corrections:** See `docs/business-pilot-source-safety-corrections.md`.
The review SQL now requires finite, non-null 720-hour activation dates and uses
account-owned capability deletion, nullable receipt identity references, and a
preserved Organization-consumption marker. The shared migration was subsequently
installed under separate approval; see `docs/business-pilot-controlled-schema-installation-report.md`.

During the original source-only phase, no migrations, shared-Neon writes, live Stripe subscriptions/charges/payment records, application restarts, publication, or GitHub pushes were performed by the Agent. Tests ran with database and Stripe credentials removed from the child process and database operations mocked. No real invitation was issued.

The running backend was not restarted and therefore must not be assumed to have loaded the new routes. New activation and billing-review functionality requires both `BUSINESS_PILOT_ACTIVATION_ENABLED=true` and `BUSINESS_PILOT_ACTIVATION_SCHEMA_APPROVED=true`. Neither switch was changed.

## Implemented behavior

- Founder-issued invitations use existing Business Pilot authorizations, recipient email binding, a random 256-bit token, a stored SHA-256 hash, and a 14-day redemption deadline.
- Tokens travel in a URL fragment, are removed from the address bar, and remain in same-tab session storage through authentication. Inspection does not expose the authorized email.
- Successful authenticated activation starts one fixed 30-day personal Clinical window. Replays preserve the original dates.
- A newly created Organization through the existing More flow inherits that original expiration. Its binding is reserved transactionally, preventing the same invitation from funding another Organization.
- Signup prebinding without token activation cannot silently start the founder Organization clock. Legacy association/extension controls cannot turn this workflow into a fresh or indefinite pilot.
- Existing paid Organizations are not reset. Revocation closes the unpaid linked Organization window, including the gap before canonical workspace attachment.
- Patient authentication and invitation acceptance select personal onboarding or the personal dashboard, not the Organization dashboard. Pilot invitation responses use the same client/team classification expected by the UI.
- Active independent clinic entitlements now consistently reach both consumer entitlement calculations and request access gates. Their 7/14/30-day dates are not clipped to the physician/Organization cutoff.
- Consumer Clinical access never creates practitioner credentials, Studio sponsorship, a paid plan, or permission to read patient records.
- New provider-originated client invitations retain identity, credential, training, and legal readiness. Organization invitation readiness does not invent a separate paid Studio requirement merely to issue an Organization trial; Studio access itself remains governed independently.
- Paid continuation reuses the existing verified, Organization-owned Stripe checkout and quantity-one subscription. Runtime price review retrieves the exact configured active recurring Stripe price; it does not substitute a hardcoded amount.
- The owner sees price, billing interval, what the Organization purchase does and does not include, recurring terms, and a required acceptance checkbox before checkout. Consent is recorded against the exact actor, Organization, reservation, and price.
- Active complimentary Organization windows cannot start paid checkout. Expiration does not initiate an automatic charge. Stripe Checkout still requires the owner to authorize payment.
- Declining continuation leaves the Organization and its records intact while existing commercial policy restricts paid operations.

## Tests and verification

Final isolated command selected:

1. `server/tests/businessPilotActivationWorkflow.test.ts`
2. `server/tests/businessPilotAuthorization.test.ts`
3. `server/tests/businessPilotPrerequisites.test.ts`
4. `server/tests/credentialClearanceReadinessContract.test.ts`
5. `server/tests/professionalGlucoseMonitoring.test.ts`
6. `server/tests/careInvitationAcceptance.test.ts`

**Result: 131 passed, 6 suites passed.**

Coverage includes disabled-gate behavior, hashed-token issuance, wrong-account/revoked/expired claims, replay, delayed Organization creation, duplicate Organization prevention, preactivation and paused-feature fallthrough, independent client dates, clinical/request-access consistency, recipient routing, no implicit billing consent, exact price verification, current credentials/legal readiness, patient consent, exact relationships, and organization isolation.

The root no-emit TypeScript check matched the existing reviewed baseline of **121 diagnostics**, including its exact diagnostic fingerprint. The baseline was not altered. Root TypeScript is therefore not clean; the existing debt remains.

An additional older `businessWriteAccess.test.ts` run produced 12 failed source assertions that expect direct `requireProAccess` declarations on six Organization endpoints. Those declarations are also absent in the unchanged HEAD source; this predates the present work. Existing Organization commercial policy was preserved rather than replacing it with personal-plan gates.

The unauthenticated preview capture showed the initial application loading spinner. It did not verify the new authenticated workflow and is not an end-to-end result. No production build, live claim, live checkout, or authenticated browser journey was run.

## Migration awaiting separate approval

`migrations/20261011_business_pilot_activation.sql`

This review-only SQL prepares:

- `business_pilot_activation_links`: companion token/activation/Organization-binding records.
- `organization_checkout_consents`: explicit price/terms consent snapshots.

It is not registered with automatic startup. No existing Drizzle table projection was expanded. Lock and statement timeouts are included. The migration has not been executed or validated against the shared database.

## Remaining release blockers

**Required before any real physician or Production rollout:**

1. Review and explicitly approve the companion schema and where it will be installed.
2. Separately approve any shared-Neon migration/writes, environment-switch changes, and application restart. This source implementation does not authorize those operations.
3. Verify the loaded routes, token claims, transaction behavior, and actual screens in an approved Development test.
4. Complete founder → physician → Organization → patient end-to-end verification, including wrong-email rejection, existing-account acceptance, a delayed Organization date, independent patient expiry, patient consent, and cross-Organization denials.
5. Verify actual price and payment continuation using Stripe TEST mode only. A live Stripe key is intentionally rejected for Development Organization checkout. The current live price was not queried during this work.
6. Review the startup-loading screen during the approved screen test. Do not count the preliminary capture as a rendered activation-page confirmation.

Professional identity, required credential clearance, current agreements, and training must be satisfied through existing onboarding. A consumer Clinical pilot is not a shortcut around them, and no professional Studio entitlement was manufactured.

## Exact steps after approvals and successful end-to-end review

### Founder

1. Sign in with a founder-authorized account and satisfy the existing MFA policy.
2. Open `/admin/pilots`.
3. In **Founder-issued 30-Day Business Pilot**, enter the physician's email and select **Generate Physician Invitation**.
4. Select **Copy Physician Invitation Link** and share it privately with that exact recipient. The activation deadline is 14 days. Generating a link does not start the 30-day access clock.

### Physician

1. Open the founder link in a browser. Register or sign in with the invited email in the same tab.
2. Return to the activation page and select **Activate My Complimentary Pilot**. Record the displayed expiration.
3. Complete personal onboarding if necessary, and complete applicable professional identity/credential/legal/training requirements through the existing flow. Activation itself does not verify medical credentials.
4. Open **More → Start Your Organization**, enter the Organization name, and create it. The Organization uses the original physician pilot expiration, even if setup happens later.
5. Open the Organization dashboard's **Invitations & Access** tools. After required professional readiness is satisfied, issue the existing recipient-bound email/link invitation with 7, 14, or 30 days.
6. At Organization expiry, either decline continuation or select **Review Organization Subscription**. Review the actual price, interval, and separate purchase scope; explicitly accept the terms and authorize payment in Stripe Checkout. No automatic conversion occurs.

### Patient

1. Open their recipient-bound invitation and register/sign in with the invited email.
2. Accept the invitation through the existing acceptance flow.
3. Complete personal onboarding if new, or return to the personal dashboard if already onboarded. They are not sent to the Organization administration dashboard.
4. Complete required clinical consent through the existing care flow before protected professional access to their data.
5. Their selected trial starts at successful acceptance/enrollment. A 30-day acceptance on November 20 runs to December 20, independent of a physician pilot ending December 1, subject to established access and safety rules.

## Proposed activation URL

Verified published host for this **Development workspace**:

`https://my-perfect-meals-npm-dev-1.replit.app`

Proposed path:

`https://my-perfect-meals-npm-dev-1.replit.app/activate/business-pilot#token=<secure-invitation-token>`

This is a proposed URL shape, not a generated invitation. No new code was published. The separate Production workspace/host was not changed or inferred; its eventual host must be independently confirmed before a Production rollout.

## Files changed

### Client

```text
client/src/components/Router.tsx
client/src/lib/auth.ts
client/src/lib/businessPilotJourney.ts
client/src/pages/Auth.tsx
client/src/pages/BusinessDashboard.tsx
client/src/pages/BusinessInviteAccept.tsx
client/src/pages/BusinessSetup.tsx
client/src/pages/PilotProgramAdmin.tsx
client/src/pages/BusinessPilotActivation.tsx
client/src/components/business/FounderPilotInvitation.tsx
client/src/components/business/BusinessPilotWindowNotice.tsx
client/src/components/business/OrganizationPaidContinuation.tsx
```

### Server

```text
server/lib/accessTier.ts
server/middleware/requireAuth.ts
server/middleware/requireProAccess.ts
server/routes/auth.session.ts
server/routes/businessRoutes.ts
server/routes/stripeCheckout.ts
server/routes/businessPilotActivationRoutes.ts
server/services/businessPilotAuthorizationService.ts
server/services/effectiveAccess.ts
server/services/businessPilotActivationPolicy.ts
server/services/businessPilotActivationService.ts
server/services/organizationCheckoutConsent.ts
```

### Tests, review SQL, and documentation

```text
server/tests/businessPilotActivationWorkflow.test.ts
server/tests/businessPilotAuthorization.test.ts
server/tests/businessPilotPrerequisites.test.ts
server/tests/credentialClearanceReadinessContract.test.ts
migrations/20261011_business_pilot_activation.sql
.agents/memory/organization-invitation-clocks.md
docs/business-pilot-development-report.md
```
