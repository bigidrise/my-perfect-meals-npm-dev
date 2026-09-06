---
name: One-action food choice
description: Product contract for conflicts between persistent nutrition profiles and explicit food requests.
---

The persistent Nutrition Life Plan establishes the default, but an explicit conflicting food request can govern exactly one action after MPM identifies the conflict, recommends the aligned option, and receives acknowledgement. The profile itself never changes, and the next independent action starts again from the persistent profile. Silent substitution is a failure.

**Why:** MPM should demonstrate that it knows the user while preserving informed human control: inform, recommend, remind, and let the human decide.

**How to apply:** Represent acknowledgement as one canonical server-authoritative action scope shared by every applicable food surface and every downstream prompt, retry, fallback, filter, and validator. Do not implement separate page-specific meanings for the same choice.

The one-action override behavior has been owner-confirmed in Development. For guided location searches, disclose and acknowledge the conflict on step 2 before advancing; “Continue anyway” should advance to step 3, which then behaves normally.