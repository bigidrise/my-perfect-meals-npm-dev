---
name: Professional glucose access
description: Durable authorization and presentation boundary for professional access to patient-entered blood-glucose data.
---

Raw blood-glucose values are server-authorized clinical data. Access requires a verified approved clinical role, an active professional account, same-organization isolation, an exact active and non-archived care relationship for the requested patient, and current patient clinical-data consent. Business, pilot, subscription, trainer, staff, administrator, or frontend visibility state never substitutes for those facts.

**Why:** Shared professional surfaces serve roles with different clinical authority. UI hiding or broad ProCare middleware can leak raw readings and related clinical details to trainers or unrelated professionals.

**How to apply:** Resolve the authoritative policy before querying sensitive source tables or constructing response fields. Keep physician list summaries on a separate server-authorized batch endpoint. Keep fasting, pre-meal, post-meal, and other contexts separate, and use only stored patient-specific guardrails for range interpretation.

The current legal-acceptance records are append-only and not relationship-specific. Do not claim that they prove a relationship-specific revocation state; add an explicit revocation-capable consent model before supporting that behavior.