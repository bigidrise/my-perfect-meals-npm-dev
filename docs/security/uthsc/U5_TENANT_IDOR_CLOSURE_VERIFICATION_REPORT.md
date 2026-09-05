# U5 Tenant / Organization / IDOR Isolation Closure Verification Report

**Review date:** 2026-09-04
**Disposition:** **PARTIAL**
**Concrete P0/P1 authorization defects remaining:** **0**

## Scope

This report closes UTHSC review step U5 only: tenant, organization,
relationship, ownership, and IDOR isolation for sensitive application routes.
The review inventoried production-effective route order, tested attacker-shaped
cross-user and cross-organization requests, and repaired only confirmed
authorization defects.

U3 and U4 remain closed. U6, U7, U8, and U9 were not started. No unrelated
product, nutrition-policy, billing, entitlement, tenancy-architecture, or UI
work was performed.

## Canonical inventory

The canonical ledger is:

`docs/security/uthsc/U5_AUTHORIZATION_LEDGER.md`

Expanded effective method/path totals:

|Classification|Count|
|---|---:|
|VERIFIED ISOLATED|171|
|PARTIAL|56|
|CONFIRMED DEFECT|0|
|POLICY DECISION REQUIRED|19|
|LEGACY / UNREACHABLE|5|
|**Total**|**251**|

The original inventory contained 181 records. Production-order and body/query
selector review added 70 previously omitted effective records: 67 verified,
two policy-required, and one retired legacy route.

## Confirmed repairs

The repaired production-effective families include:

- Legacy meal logs, diary, adherence, WMC2, concierge reminders, and voice prompts
- Personal meal-board current/read/create, item creation, repeat-day, and commit
- Physician-report create/list/revoke, including persistent revocation
- Consumer and professional body-composition routes, including goals
- User profile/subscription selectors and meal-plan selectors/mutations
- User reminders, meal preferences, glycemic settings, and time presets
- Weekly, Step 5, enforced, WMC2, and testosterone meal generators
- Physician thyroid and hormone protocol mutations with same-org active relationship checks
- Phone state, verification-code, phone verification, and SMS-consent routes
- Meal-plan archive direct handlers and mounted router, including duplicate production ordering
- Meal-plan routers under both production mounts
- Alcohol history and deletion ownership
- Founder consent/testimonial writes and consent reads
- Account-bound onboarding while preserving anonymous device-only onboarding
- Kids progress, recipe actions, and reminder scheduler diagnostics
- Raw legacy account creation, now retired with HTTP 410

Self-service routes now derive identity from the authenticated actor or reject a
mismatched selector. Opaque resource mutations use ownership predicates.
Professional clinical writes require the expected role plus current same-org
relationship evidence.

## Production-order verification

The review found that later secured routers did not protect earlier matching
Express handlers. Every discovered production-effective duplicate now enforces
authentication and actor binding directly. Registration-order tests cover:

- Seven meal-log registrations
- Two direct meal-plan archive POST registrations
- Mounted archive, meal-plan, phone, alcohol, time-preset, onboarding, and founder routes

Authentication guards on routers mounted at broad `/api` prefixes were narrowed
to their own handlers after validation caught unintended interception of
login/signup routes.

## Verification evidence

- Focused U5 matrix: **67/67** across **9 suites**
- Broad U5 authorization/relationship/invitation matrix: **169/169** across **14 suites**
- Post-mount-scope changed-surface check: **21/21** across **4 suites**
- U4 CSRF regression: **8/8**
- Independent authorization architect: **PASS**, no remaining concrete U5 P0/P1 defect
- `npm run validate`: passed with **0 hard failures**
- `npm run check:safety-types`: passed
- `npm run build:server`: passed
- `npm run check:release-types`: passed
- `git diff --check`: passed
- Release baseline remained exactly:
  - **137 diagnostics**
  - `ba24598f9ed9604727eb348bec92afe0f2d8dddb9191aca9712040fbe45a2cb7`
- Main workflow restarted once and served successfully on port 5000
- Public sign-in page rendered successfully after restart

No client build was required because U5 changed no client source.

## Why the disposition is PARTIAL

U5 cannot be reported as an overall PASS while 56 PARTIAL records and 19 policy
decisions remain. These are not unresolved confirmed P0/P1 defects, but they
include meaningful route groups whose product policy or complete negative-test
evidence is not yet settled.

The most material policy stop is object/media ownership:

- Private upload issuance creates legacy object keys without owner ACL metadata.
- Private download cannot safely enforce ownership for old keys.
- Immediate fail-closed enforcement would break existing profile and campaign uploads.
- Public objects and companion-image bearer/capability behavior require explicit policy.
- Public meal images and signed Studio media are separate and must remain unaffected.

A backward-compatible owner/capability model and migration is required before
those routes can move to VERIFIED ISOLATED.

## Known non-U5 observations

Validation retained the existing 61-route development/production parity warning;
U5 introduced no new route. Development startup logs also retained existing
Stripe billing migration and storage-diagnostic failures. The application still
started, `/api/health` responded successfully, auth integration passed, and the
sign-in UI rendered. These observations were not changed because they are
outside U5.

## Change-control confirmation

- No commit, push, merge, deployment, or publishing was performed.
- No Production data was mutated.
- No U6, U7, U8, or U9 work was started.
- U3 and U4 remain closed.