---
name: Demo practitioner boundary
description: Approved design for demonstration personas; demo status never means real-world clinical verification.
---

Demo practitioners use a canonical practitioner persona with a separate `demo_only` operating status and explicit demo entitlement. They may demonstrate workflows only against synthetic/demo cases, never access real patients merely through internal/test entitlement, and must never be labeled fake verified clinicians.

**Why:** The user explicitly agreed with this architecture after the professional lifecycle trace and reserved implementation of demo grants and legacy identity recovery for separate approval.

**How to apply:** Keep demo operation separate from credential verification, commercial entitlement, Academy evidence, legal acceptance, memberships, relationships, and consent. Install the server-enforced synthetic-data boundary before any demo-persona transition; do not simulate verification by passing true into real-clinical authorization.

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

**How to apply:** Use a dedicated isolated shell and verify it separately. Passing backend authorization tests is not proof that the demo browser journey works; do not activate a shared account while that acceptance is blocked.

## Validation authority and error evidence

Keep grants and grant events at zero until the user authorizes account setup. Locally intercepted synthetic UI sessions are not proof of actual authenticated-server acceptance.

**Why:** The user explicitly wanted zero grants/events while the browser path was being established, and reserved Dr. Test setup for later approval.

**How to apply:** Report fixture UI evidence separately from server security tests and real signed-in acceptance. For update loops, inspect the thrown update/ref chain and full React component stack rather than attributing the cause to a named parent modal.

## Permanent founder physician Studio

The founder wants permanent physician demonstration access to the existing Studio/Clinic, with the full physician interface operating on synthetic patients. No Academy exam, medical credential verification, ordinary professional onboarding, professional agreements, or paid subscription should be required for demo-only use. Never mark those real-world requirements as completed.

**Why:** The user needs dependable physician Studio access for testing and business demonstrations; the product is already public. Temporary access fixes and recurring setup requirements do not meet this purpose.

**How to apply:** Reuse the owned Clinic and preserve its organization/business relationships and existing records. Keep the physician interface isolated from live clinical APIs and use demo-backed data and simulated invitations. Do not replace the Clinic with another Studio or treat ownership as clinical authority. Account/grant changes and Production publishing still require separate authorization and verified shared-runtime isolation. Investigate demonstrated access regressions and protect the established access paths without claiming all customers are affected or expanding into unrelated audits.

## Real physician pilot evidence

Founder-demo acceptance is not evidence that real physician pilot onboarding works. A 30-day Clinical pilot does not waive genuine physician credential, legal, education, or other clinical authorization requirements.

**Why:** The user explicitly requires the actual physician onboarding journey to be investigated separately from restoring the founder's synthetic demonstration access.

**How to apply:** Separate commercial entitlement, clinical readiness, fixture results, and acceptance on the identified Production release. Never present Development tests or synthetic demo access as proof of a complete Production physician-to-client journey.
