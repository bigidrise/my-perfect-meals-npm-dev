---
name: Oncology release review
description: Release and scope constraints for symptom-personalized oncology nutrition support.
---

Symptom-personalized oncology changes require an authenticated Development review before any Production promotion or publication. Do not treat mocked handoff tests or the app's public reference list as clinical validation or platform-wide clearance.

**Why:** The user explicitly required Development-only corrections followed by an authenticated review before marketing symptom-personalized support. The oncology references support educational context, not organizational endorsement or certification of individual meal rules.

**How to apply:** Keep release approval separate from implementation completion. Do not add breast-cancer-specific rules or medication recommendations without a separately approved scope. Report any remaining creator-specific inconsistencies instead of claiming every tool has verified symptom behavior.

Consumer symptom editing is self-managed only. Physician-owned selections remain consumer-read-only even if a historical lock bit is clear, until a separate ownership policy is approved.

**Why:** The user approved consumer symptom entry while explicitly preserving clinician ownership, not a new patient/clinician co-editing model.

**How to apply:** Preserve clinician-owned records and server-owned metadata; do not infer editing permission from an unlocked historical record.

Verify actual oncology Development eligibility before declaring signed-in testing ready. A Development workflow and a visible DEV badge do not establish that all project/deployment safety guards permit the feature.

**Why:** The Development runtime was running successfully while the combined oncology eligibility gate was inactive.

**How to apply:** Keep Production guards intact and distinguish successful code/tests from runtime activation. Confirm the workspace's Development configuration before changing eligibility.
