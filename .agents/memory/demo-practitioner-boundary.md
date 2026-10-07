---
name: Demo practitioner boundary
description: Approved design for demonstration personas; demo status never means real-world clinical verification.
---

Demo practitioners use a canonical practitioner persona with a separate `demo_only` operating status and explicit demo entitlement. They may demonstrate workflows only against synthetic/demo cases, never access real patients merely through internal/test entitlement, and must never be labeled fake verified clinicians.

**Why:** The user explicitly agreed with this architecture after the professional lifecycle trace and reserved implementation of demo grants and legacy identity recovery for separate approval.

**How to apply:** Keep demo operation separate from credential verification, commercial entitlement, Academy evidence, legal acceptance, memberships, relationships, and consent. Install the server-enforced synthetic-data boundary before any demo-persona transition; do not simulate verification by passing true into real-clinical authorization.

## Hard finish line for this correction project

The user limited the remaining work to controlled identity decisions, the demo/live-data boundary, and invitation completion. The finish line is a Development demo physician inviting a synthetic patient, acceptance creating the correct Care Team connection, and demonstration of the intended physician workflow with no real-patient access or invented real-world verification, followed by passing regressions. Then stop and prepare the separately approved Production promotion.

**Why:** The user explicitly said this was expanding too much and repeatedly instructed staying in scope and finishing rather than adding audits.

**How to apply:** Do not expand RN/PA/nutritionist/coach coverage or redesign occupations. Investigate blinking only if it persists after this work. Credential retention/erasure remains a scoped must-resolve-before-Production item. Stage 3 is Development implementation and reporting only: even after isolation tests pass, Dr. Test's actual transition needs separate user approval. Stop after Stage 3; invitations belong to the separately requested final functional stage.

## Truthful demo presentation

Do not add fabricated consumer-trial, commercial, training, credential, or real-clinical-readiness fields merely to make a restricted demo persona render. Keep its presentation separate from normal consumer/live-client contexts.

**Why:** Demo authority must remain independent of the real account's commercial and professional evidence; normal application chrome can assume a fuller live profile than a truthful restricted bootstrap supplies.

**How to apply:** Use a dedicated isolated shell and verify it separately. Passing backend authorization tests is not proof that the demo browser journey works; do not activate a shared account while that acceptance is blocked.
