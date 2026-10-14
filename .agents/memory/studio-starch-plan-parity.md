---
name: Studio starch plan parity
description: Physician and Trainer client dashboards must share the client's current starch count and timing with the calculator and builders.
---

Physician Studio and Trainer Studio client dashboards must reflect the current
Macro Calculator starch game plan: the number of meals containing starch and
their distribution/timing, not an independent one-meal/flex plan. Professional
choices must reach that client's Meal Builders.

**Why:** The user identified the old Studio controls and stated that Studio must
reflect calculator numbers and that two- or three-meal choices must work across
Meal Builders and the rest of the system.

**How to apply:** Read and save the selected client's authoritative preferences,
not the logged-in professional's personal settings. Keep total meal count
separate from starch-meal count and preserve clinical/performance authority.
Verify persistence and builder consumption, not only visual parity.

The approved correction is Development-only. Do not publish Production, change
nutrition formulas or generation algorithms, or broadly refactor Builder
fallbacks without separate approval. Use synthetic fixtures or isolated tests;
never modify real client prescriptions to verify this correction.

**Why:** The user explicitly required these boundaries and emphasized that
Client A's edits must never reach Client B or the professional's own preferences.
Development and Production share a database.

**How to apply:** Verify request identity and delayed-response isolation alongside
save/reload behavior. Report unresolved compatibility limits rather than
silently widening the implementation scope.

Client starch controls must recognize verified nonclinical Business Studio
operating authority, not only a stored physician or trainer occupation. Keep
the exact active-client and organization checks; ownership alone is insufficient.
Never change Business identity to repair access.

**Why:** An established, eligible Business-owned Studio was incorrectly denied
by the occupation-only starch gate even though it could already manage that
client through the normal Studio workflow. Intercepted browser fixtures missed
this real-account authority path.

**How to apply:** Include eligible Business Studio operators in positive
authorization contracts, alongside unready owners and unrelated clients in
negative contracts. Distinguish permission denials from retryable load failures.
