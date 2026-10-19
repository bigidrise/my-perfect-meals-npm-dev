---
name: Pairing foundation release boundary
description: Scope and safety policy for the approved Development-only first phase of pairing consolidation.
---

Only Phase 1 of the shared pairing foundation is approved, in Development. Keep the existing screens, API compatibility and Production behavior. Do not start conversational intelligence, research, photo input, inventory integration or release work without separate approval.

**Why:** The user authorized a controlled foundation correction, not all five phases of the proposed advisor.

**How to apply:** Keep the implementation server-gated to an undeployed Development runtime. Apply authoritative context and complete output validation to the active Drink Pairing, Wine List Translator and Chef Pairings routes. Tighten the weaker routes; never establish parity by removing Drink Pairing's verified-ingredient gate. Education-versus-consumption policy remains a separate decision.

Wine-list selection must use unambiguous, complete supplied identities, including producer and vintage when present. An unverified Best Choice is withheld, not silently replaced by a different model choice.

**Why:** The prior translator trusted the model to select an actual listed wine. General wine knowledge and verified bottle composition or availability are different evidence.

**How to apply:** Do not substitute fuzzy name matching, model assertions or a safety PIN for source membership and eligibility. Treat unsupported or ambiguous inputs as needing clarification.

Use real scanner consumer tests as well as mocked route tests.

**Why:** A mocked alcohol scanner caught whiskey in alternatives, while the real generic scanner missed that alias. Passing mock contracts alone did not prove actionable-field coverage.

**How to apply:** Reuse the established beverage alcohol detector for already-authoritative alcohol prohibitions; do not add new clinical limits or change unrelated global validators as part of this foundation.
