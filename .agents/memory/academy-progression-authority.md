---
name: Academy progression authority
description: Durable rules for Academy phases, credentials, and next-step routing.
---

Academy progression must come from one authoritative calculation. Completing all nine Platform Mastery lessons completes educational Phase 1 without requiring a Platform certificate. Completing all six Marketing & Coaching modules after Phase 1 creates eligibility for the distinct Certified My Perfect Meals Specialist credential. ProCare training is a separate optional advanced path and never blocks the Specialist credential.

**Why:** Independent page-level calculations previously sent completed learners backward, treated ProCare as part of the core credential, and coupled educational completion to legacy certificate issuance.

**How to apply:** New Academy surfaces must consume the shared progression result and its next step. Preserve legacy certificate rows as compatibility evidence; do not relabel or overwrite them. Offer ProCare only to eligible professional roles, while leaving legal, MFA, readiness, and access gates authoritative.

Legacy `platform` certification data is ambiguous: Platform Mastery evidence requires its explicit certification-track marker, while ProCare compatibility requires the known three-video/three-quiz LMS structure plus related module progress. Never infer either identity from the `platform` string alone.

**Why:** Both historical Academy records and the advanced ProCare LMS have used the same storage identifier, so blanket aliases can grant the wrong credential or erase valid progression.

**How to apply:** Introduce canonical identities in code first, keep compatibility matching evidence-based, and move records only through a later reviewed migration with a dry-run inventory.

Before any shared-data migration, endpoint-level tests must prove attempt persistence, history immutability, answer-key suppression, and incomplete-submission rejection. The migration's first pass must be read-only and report which rows move, remain, and why.

**Why:** Stage 1 is accepted, but the shared Neon database contains production data and the migration boundary must remain reversible and reviewable.

**How to apply:** Complete HTTP-path hardening tests first, then review dry-run counts and classifications; do not let a migration task mutate data by default.