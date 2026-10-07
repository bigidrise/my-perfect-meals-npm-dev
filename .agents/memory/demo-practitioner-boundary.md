---
name: Demo practitioner boundary
description: Approved design for demonstration personas; demo status never means real-world clinical verification.
---

Demo practitioners use a canonical practitioner persona with a separate `demo_only` operating status and explicit demo entitlement. They may demonstrate workflows only against synthetic/demo cases, never access real patients merely through internal/test entitlement, and must never be labeled fake verified clinicians.

**Why:** The user explicitly agreed with this architecture after the professional lifecycle trace and reserved implementation of demo grants and legacy identity recovery for separate approval.

**How to apply:** Keep demo operation separate from credential verification, commercial entitlement, Academy evidence, legal acceptance, memberships, relationships, and consent. Install the server-enforced synthetic-data boundary before any demo-persona transition; do not simulate verification by passing true into real-clinical authorization.
