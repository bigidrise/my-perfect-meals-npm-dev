---
name: Demo practitioner boundary
description: Approved design for demonstration personas; demo status never means real-world clinical verification.
---

Demo practitioners use a canonical practitioner persona with a separate `demo_only` operating status and explicit demo entitlement. They may demonstrate workflows only against synthetic/demo cases, never access real patients merely through internal/test entitlement, and must never be labeled fake verified clinicians.

**Why:** The user explicitly agreed with this architecture after the professional lifecycle trace and reserved implementation of demo grants and legacy identity recovery for separate approval.

**How to apply:** Keep demo operation separate from credential verification, commercial entitlement, Academy evidence, legal acceptance, memberships, relationships, and consent. Install the server-enforced synthetic-data boundary before any demo-persona transition; do not simulate verification by passing true into real-clinical authorization.

## Original Physician Studio restoration

Restore the existing original Physician Studio components and workflow in Development; do not replace them with a synthetic demonstration interface, create another Studio, or roll back unrelated work. Isolated test records are acceptable for verification, but existing authentication, organization isolation, and active-client authorization must remain intact.

**Why:** The user explicitly rejected the substitute demonstration interface and requested the original client list, folders, and complete clinical dashboard. Development and Production share data, so a presentation correction is not permission to change the shared account's role or remove its data restrictions.

**How to apply:** Distinguish Studio discovery, interface routing, practitioner identity, and patient-data authorization. Verify current account and existing Studio state read-only; do not assume previous routing corrections restored server access. Report an exact security blocker rather than fabricating clinical readiness or bypassing restrictions.

The approved initial correction allows narrowly scoped, authenticated, read-only discovery of this Development account's existing workspaces and memberships. It does not authorize changing the shared identity, activating a practitioner role, or opening patient APIs. Discovery failure must remain an explicit error rather than being presented as absent workspaces.

**Why:** The user approved restoring recognition/navigation separately from clinical clearance and explicitly retained the shared-database and patient-security restrictions.

**How to apply:** Preserve independent Business/Organization membership and Studio ownership evidence; keep verified practitioner authority and per-patient access checks separate. When authority is unresolved, show the existing resource with an honest restriction, not a Trainer fallback or substitute demonstration interface.

## Shared-account activation prerequisite

Before any approved demo-persona transition, verify that every deployed application able to authenticate the shared account enforces the demo-only boundary. If the currently running Production application could expose real/live professional capability, or its protections cannot be verified, do not activate the account.

**Why:** The user explicitly made deployed Production enforcement a prerequisite to demo activation because Development and Production share Neon.

**How to apply:** Verify the deployed runtime, not merely local production-entrypoint code or a generic unauthenticated rejection. Keep the identity, grant preparation, and session-changing lifecycle writes untouched until this gate passes. Do not publish Production as an unapproved workaround.

## Hard finish line for this correction project

The user limited the remaining work to controlled identity decisions, the demo/live-data boundary, and invitation completion. The finish line is a Development demo physician inviting a synthetic patient, acceptance creating the correct Care Team connection, and demonstration of the intended physician workflow with no real-patient access or invented real-world verification, followed by passing regressions. Then stop and prepare the separately approved Production promotion.

**Why:** The user explicitly said this was expanding too much and repeatedly instructed staying in scope and finishing rather than adding audits.

**How to apply:** Do not expand RN/PA/nutritionist/coach coverage or redesign occupations. Investigate blinking only if it persists after this work. Credential retention/erasure remains a scoped must-resolve-before-Production item. Stage 3 is Development implementation and reporting only: even after isolation tests pass, Dr. Test's actual transition needs separate user approval. Stop after Stage 3; invitations belong to the separately requested final functional stage.

## Truthful demo presentation

Do not add fabricated consumer-trial, commercial, training, credential, or real-clinical-readiness fields merely to make a restricted demo persona render. Keep its presentation separate from normal consumer/live-client contexts.

**Why:** Demo authority must remain independent of the real account's commercial and professional evidence; normal application chrome can assume a fuller live profile than a truthful restricted bootstrap supplies.

**How to apply:** Preserve the original Physician components and workflow while
isolating test data. Do not substitute a reduced demonstration shell to work
around missing authorization or profile fields. Passing backend tests or
intercepted UI fixtures is not proof that the actual account journey works.

## Validation authority and error evidence

Keep grants and grant events at zero until the user authorizes account setup. Locally intercepted synthetic UI sessions are not proof of actual authenticated-server acceptance.

**Why:** The user explicitly wanted zero grants/events while the browser path was being established, and reserved Dr. Test setup for later approval.

**How to apply:** Report fixture UI evidence separately from server security tests and real signed-in acceptance. For update loops, inspect the thrown update/ref chain and full React component stack rather than attributing the cause to a named parent modal.

## Permanent founder physician Studio

Only the founder-controlled physician dummy account needs this permanent demonstration access. It must be available whenever the founder wants to demonstrate the platform or check whether it works. Do not extend this exception to other accounts.

**Why:** The user explicitly repeated that this is the only account needed like this.

**How to apply:** Keep permanent authorization scoped to the existing designated account and Clinic; leave real physicians and their onboarding unchanged.

The founder wants permanent physician demonstration access to the existing Studio/Clinic, with the full physician interface operating on synthetic patients. No Academy exam, medical credential verification, ordinary professional onboarding, professional agreements, or paid subscription should be required for demo-only use. Never mark those real-world requirements as completed.

**Why:** The user needs dependable physician Studio access for testing and business demonstrations; the product is already public. Temporary access fixes and recurring setup requirements do not meet this purpose.

**How to apply:** Reuse the owned Clinic and preserve its organization/business relationships and existing records. Keep the physician interface isolated from live clinical APIs and use demo-backed data and simulated invitations. Do not replace the Clinic with another Studio or treat ownership as clinical authority. Account/grant changes and Production publishing still require separate authorization and verified shared-runtime isolation. Investigate demonstrated access regressions and protect the established access paths without claiming all customers are affected or expanding into unrelated audits.

The doctor test account must use the original Physician interface and workflow:
Pro Portal, Physician Care Team, the shared client list and folder, and the full
Clinician dashboard. Preserve physician-specific clinical functionality and the
shared architecture with Trainer Studio. Synthetic isolation is a data boundary,
not permission to replace those interfaces.

**Why:** After navigation was added to the substitute interface, the user rejected
that result and explicitly authorized restoration of the original components,
not a redesign, rebuild, or another demonstration interface.

The user subsequently approved reconnecting the original Physician Studio to
its existing server-validated Development test authorization and isolated local
synthetic data. This is not approval to change the shared Business identity,
grant live-clinical readiness, write the shared database, change MFA or billing,
restart the application, or publish Production.

**Why:** The original Studio was recognized but its live-readiness guard could
not represent the already authorized synthetic-only testing context.

**How to apply:** Keep synthetic interface permission independent of
`canEnterStudio` live permission. Render the established Physician components
through isolated data inputs; explicitly identify workflows that lack isolated
adapters instead of letting them call live endpoints or claiming full
restoration from page rendering alone. A future restart needs separate approval.

**How to apply:** Reconnect original guarded routes; preserve relationships,
permissions, prescriptions, messaging, notes, Builder assignments, Macro
Calculator behavior, and starch corrections. Keep Development-only scope and
do not roll back unrelated work. If server restrictions prevent a workflow,
report the exact blocker rather than bypassing it or claiming restoration is
complete. Keep demo files until their remaining dependencies are established.

Shared-account activation requires both live-data isolation and a usable permanent founder demo experience in the intended runtime. A protective release that only denies live APIs is not sufficient evidence that activation restores the requested Studio.

**Why:** Isolation and demonstration availability are separate acceptance conditions; restricting a shared account must not leave it without the promised demo workspace or require recurring temporary grants.

**How to apply:** Verify the deployed release rather than Development source alone. Distinguish protective middleware from enabled synthetic demo routes and permanent founder authority before activating the account.

## Real physician pilot evidence

Founder-demo acceptance is not evidence that real physician pilot onboarding works. A 30-day Clinical pilot does not waive genuine physician credential, legal, education, or other clinical authorization requirements.

**Why:** The user explicitly requires the actual physician onboarding journey to be investigated separately from restoring the founder's synthetic demonstration access.

**How to apply:** Separate commercial entitlement, clinical readiness, fixture results, and acceptance on the identified Production release. Never present Development tests or synthetic demo access as proof of a complete Production physician-to-client journey.
