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

Current authorized implementation and translation work concentrates on English and Spanish. Preserve existing translations and support for other languages, but do not undertake French, German, Arabic, Japanese or other-language completion.

**Why:** The founder explicitly said they are not paying to complete other languages right now.

**How to apply:** Limit new translation and broad journey-verification work to English/Spanish. Document other-language limitations without silently expanding the work or weakening release checks.

For newly scoped consumer copy, an additive English/Spanish namespace with ordinary English fallback is preferable to filling sibling locales with untranslated placeholders.

**Why:** The approved scope preserves every existing catalog value and explicitly excludes paid completion of other languages; a parity workaround must not misrepresent translation coverage.

**How to apply:** Keep legacy catalog gates intact, verify new namespace parity and interpolation separately, and explicitly disclose that legacy JSON scanners do not measure the additive namespace.

The first-time Spanish experience must begin before login or registration by automatically detecting Spanish on the device, without requiring an account, saved preference or manual language selection.

**Why:** The founder identified this as the original device experience problem and explicitly required it not be lost in broader localization work.

**How to apply:** Include fresh-session Spanish-device checks on public entry, login and registration alongside English fallback and explicit-language-choice checks.

Hardcoded-string scanner results are candidates, not confirmed customer defects.

**Why:** The founder specifically said not to chase scanner findings blindly and to prioritize text actually visible to customers.

**How to apply:** Verify visibility and meaning before extracting strings; preserve product names and identifiers and distinguish static evidence from browser/provider verification.

Required first-run consent gates cannot be treated as optional untranslated exceptions when claiming a Spanish consumer journey is complete.

**Why:** Translating headings and buttons still makes a Spanish-speaking new user read and accept English; clinical/legal review requirements block completion rather than remove the gate from scope.

**How to apply:** Prepare exact Spanish wording for explicit approval without activating unapproved clinical/legal copy. Keep the task incomplete until the required explanation and acknowledgments are translated and their existing checkbox behavior is verified.
