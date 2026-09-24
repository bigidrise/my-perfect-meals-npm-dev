---
name: Cardiac lab user choice
description: Authority boundary for turning off a lab-derived Cardiac protocol without altering lab evidence.
---

Users may turn off lab-derived Cardiac nutrition guidance even while the underlying measurements still qualify. This is an explicit subject-owned clinical decision, not a correction to lab data and not a general override of physician-owned protocols. Do not use the newer shadow lab-source discontinuation alone to implement it: the current live food pathway still reads the user's specialty state and would keep applying Cardiac guidance.

**Why:** The previous lab-value lock reintroduced Cardiac on profile save, making it impossible for a user to stop that one protocol without editing actual measurements. The user specifically requested control over this lab-activated Cardiac support while retaining lab values.

**How to apply:** Keep lab data and decision history immutable, prevent automatic lab-derived reactivation after explicit off, and update the live specialty authority in the same committed decision. Fail closed for physician-controlled settings. A later explicit on choice can resume Cardiac guidance; do not silently repurpose a raw lab reading as consent.