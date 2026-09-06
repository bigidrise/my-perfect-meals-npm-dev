---
name: One-action food choice
description: Product contract for conflicts between persistent nutrition profiles and explicit food requests.
---

The persistent Nutrition Life Plan establishes the default, but an explicit conflicting food request can govern exactly one action after MPM identifies the conflict, recommends the aligned option, and receives acknowledgement. The profile itself never changes, and the next independent action starts again from the persistent profile. Silent substitution is a failure. The override waives only the exact conflicting rule; allergies, clinical protections, targets, preparation intelligence, portioning, and all unrelated context remain active.

**Why:** MPM should demonstrate that it remembers and understands the user while preserving informed human control: identify meaningful contradictions, recommend, and let the human decide without disabling the rest of personalization.

**How to apply:** Represent acknowledgement as one canonical server-authoritative action scope shared by every applicable food surface and every downstream prompt, retry, fallback, filter, and validator. Once a client hands an acknowledgement token to its authorized request, discard the client copy regardless of the request outcome; a later action must precheck again rather than resend a consumed token. Do not implement separate page-specific meanings for the same choice.

The one-action override behavior has been owner-confirmed in Development. For guided location searches, disclose and acknowledge the conflict on step 2 before advancing; “Continue anyway” should advance to step 3, which then behaves normally.

Cuisine is ordinarily a default preference rather than a governed contradiction. An explicit cuisine request supersedes it silently for that action, then the next independent action returns to the saved cuisine default.

Every dietary-accountability intervention must present two meaningful actions: remain aligned with the saved plan, or knowingly continue with the conflicting request for one action. A continue-only interruption is not acceptable.