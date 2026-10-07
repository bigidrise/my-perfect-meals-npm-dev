# Professional role boundaries

## Identity and authorization

`shared/professionalRoles.ts` defines the exact practitioner identities:
`trainer`, `physician`, `dietitian`, and `nurse_practitioner`.
`business` remains a legitimate account value but is not a practitioner.
General account `role: coach` and organization owner/admin/member permissions
remain separate from `professionalRole`.

Provider authorization reads canonical persisted account identity. It does not
normalize aliases, use invitation categories as identity, or derive occupation
from payment, internal flags, ownership, credentials, training, or agreements.
Existing credential, training, legal, billing, location, consent, and relationship
checks still apply. This vocabulary is not a grant of every clinical capability:
for example, the raw-glucose policy's narrower physician/dietitian subset remains
unchanged.

## Explicit Care Team request/display mappings

| Boundary value | Canonical request category | Evidence / restriction |
| --- | --- | --- |
| `doctor` | `physician` | Existing Doctor dropdown and physician Care Team default. |
| `np` | `nurse_practitioner` | Existing Care Team badge explicitly says Nurse Practitioner. |
| Four canonical values | Same value | Exact supported categories. |
| Anything else | Rejected / review required | No inference or account conversion. |

Reverse mappings to `doctor` and `np` are for friendly UI labels only.
They are never account authorization mappings.

Provider-originated invitations persist the provider's canonical account role,
not the dropdown selection. Clients may request a canonical category through
these explicit boundary mappings, but connection still resolves the recipient's
actual account identity and current eligibility independently.
After connection, active Care Team card labels use that validated provider
identity, not the client's requested category or an old invitation alias.

Stored legacy provider identities require review before invitations are sent or
their sender direction is inferred. No account migration or repair is performed.

## Surfaces requiring a product-policy decision

- Generic, Trainer, and Physician Care Team dropdowns still contain `rn`, `pa`,
  and `nutritionist`. These cannot safely identify one of the four canonical
  practitioners. Client requests using them receive an explicit unsupported
  category response; provider selections cannot override the actual identity.
- Professional identity onboarding labels group “Trainer / Coach,”
  “Dietitian / Nutritionist,” and “Nurse Practitioner / PA,” while storing
  `trainer`, `dietitian`, and `nurse_practitioner`. These display labels are not
  evidence that standalone `coach`, `nutritionist`, or `pa` account values can be
  authorized or converted. The labels and credential policy need product review.
- `rn`, `pa`, `nutritionist`, `coach`, legacy `medical`, and unknown account
  values are not converted into clinical identities. Case and whitespace
  variants of persisted identity are also not silently normalized.
- The consumer connection evaluator previously accepted `professionalRole:
  coach` despite Studio readiness rejecting it. It now accepts canonical
  practitioners only. General account `role: coach` is unchanged.

## Remaining architectural conflicts outside this phase

- The professional self-upgrade endpoint remains retired. No new identity
  completion/recovery flow is built here.
- Email-link invitation resolution and login auto-accept still need the separate
  bidirectional-identity correction identified by the audit. They must not be
  considered equivalent to the corrected manual-code handler.
- Training middleware database-error behavior, demonstration identity, legacy
  account review/repair, and Care Team blinking remain separate work.

## Documented pre-existing owner-journey failures

`server/tests/businessSuiteOwnerJourney.test.ts` has two stale expectations
unrelated to the identity protection changes:

1. **Business Suite explains the full client journey before setup** expects
   “Turn My Perfect Meals into a business platform” and the old activation copy.
   `BusinessStart.tsx` now describes the no-payment 30-day Business pilot.
2. **organization information is saved before owner-only checkout begins**
   searches for the old literal create-org fetch followed by Business checkout.
   `BusinessSetup.tsx` uses the newer conditional creation endpoint and pilot
   onboarding sequence, so the old literal `createIndex` is `-1`.

These failures must remain visible in promotion review. Do not silently change
their assertions or production behavior as part of professional role vocabulary.

## Verification results

- 47 new role-boundary/invitation regression cases pass: 23 shared-policy cases
  and 24 additional mocked Care Team route cases.
- Across the relevant suites, 229 unique cases pass and the two owner-journey
  cases documented above still fail. The final Care Team route pass has 44
  passing cases, including the existing bidirectional connection coverage.
- Existing organization identity protection, subscriptions, authentication,
  certification, legal activation/recovery, Hydration professional boundaries,
  and raw-glucose policy coverage pass.
- Server TypeScript check passes without diagnostics.
- Client production build and server production build pass.
- Full-project TypeScript remains nonzero due to existing debt. An isolated
  pre-change HEAD comparison found 139 baseline diagnostics versus 136 current
  diagnostics, with zero new/changed diagnostic fingerprints and three removed.
- The two owner-journey failures read unchanged frontend setup/start files.
- No account repairs, database migrations or live acceptance requests were run.
  Production was not modified, restarted, pushed to, published, or deployed.
  This is Development implementation and mocked/static verification, not a
  signed-in Production acceptance test.

## Exact changed files

### Shared vocabulary and types
- `shared/professionalRoles.ts` (new)
- `shared/procareConsumerAccess.ts`
- `shared/schema.ts`

### Server consumers and invitations
- `server/middleware/requireAuth.ts`
- `server/routes/auth.session.ts`
- `server/routes/careTeamRoutes.ts`
- `server/routes/hydration.ts`
- `server/services/emailService.ts`
- `server/services/procareStudioReadiness.ts`

### Client types and friendly display
- `client/src/lib/auth.ts`
- `client/src/pages/CareTeam.tsx`
- `client/src/pages/care-team/TrainerCareTeam.tsx`
- `client/src/pages/procare/ProCareIdentity.tsx`

### Regression tests
- `server/tests/professionalRoleBoundaries.test.ts` (new)
- `server/tests/careTeamConnectionIdentity.test.ts`

### Documentation
- `docs/professional-role-boundaries.md` (new; this report)
- `.agents/memory/organization-practitioner-identity.md` (records the user's
  explicit confirmation of the organization/practitioner separation)
