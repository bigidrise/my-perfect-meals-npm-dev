---
name: Localization language policy
description: Founder requirements for Auto language intent, Spanish completeness, and evidence-led localization scope.
---

Auto is a persistent user choice that follows the current device language, not permission to overwrite the account with a detected explicit language.

**Why:** The founder explicitly required proper Auto handling without persisting Auto as an explicit language.

**How to apply:** Preserve Auto when adding generation-language propagation, session restoration, or new language selectors. Keep the resolved display language separate from the saved choice.

The product goal is a consistent Spanish experience across every applicable supported area without requiring English to navigate. Complete the existing localization system rather than replacing it.

**Why:** The founder accepted the architecture audit and authorized phased completion, with clinical wording reviewed separately.

**How to apply:** Keep interface, generated content, professional workflows, and delivery channels within their approved phase. Never interpret an interface phase as authorization to change clinical or nutrition rules.

Hardcoded-string scanner results are candidates, not confirmed customer defects.

**Why:** The founder specifically said not to chase scanner findings blindly and to prioritize text actually visible to customers.

**How to apply:** Verify visibility and meaning before extracting strings; preserve product names and identifiers and distinguish static evidence from browser/provider verification.
