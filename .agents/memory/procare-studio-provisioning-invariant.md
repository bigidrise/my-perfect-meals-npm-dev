---
name: ProCare Studio provisioning invariant
description: Provider readiness and Studio creation must remain coupled across setup, invitations, and legacy recovery.
---

An eligible ProCare provider must have exactly one active owned Studio before any provider-originated client invitation is persisted. All Studio creation and invitation flows use the same readiness requirements: provider access, supported professional role, Academy completion, applicable training completion, legal acceptance, and session MFA.

**Why:** Previously, a provider could send a Care Team invitation without a Studio. A client who signed up but did not complete acceptance was left unlinked and invisible to the provider. Historical invitation acceptance also created Studios through a separate race-prone path.

**How to apply:** When adding any provider-facing onboarding, Studio, invitation, or activation route, use the shared readiness/provisioning path rather than duplicating role or access checks. Legacy repairs must only consider explicit professional provider roles and must report ambiguous records without mutating them. Studio provisioning must remain idempotent and restore the internal billing row without creating external billing.