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

Current release customer-selectable languages are only Automatic, English and Español. Automatic supports only English/Spanish, with English fallback for other device languages. Unsupported saved languages display English without rewriting their account value. Preserve dormant language definitions, resources and code for future activation.

**Why:** The founder explicitly limited current release choices to EN/ES and required the smallest change to the existing Language page and system, not another selector, engine or page.

**How to apply:** Keep language separate from measurement/country. Filter customer choices through existing preference resolution, retain raw saved unsupported intent until an explicit user selection, and describe interface language rather than AI alone. Keep an accurate incomplete-Spanish footer until coverage is verified. Report overlap with measurement or Spanish tasks before editing overlapping code; never weaken release checks.

For newly scoped consumer copy, an additive English/Spanish namespace with ordinary English fallback is preferable to filling sibling locales with untranslated placeholders.

**Why:** The approved scope preserves every existing catalog value and explicitly excludes paid completion of other languages; a parity workaround must not misrepresent translation coverage.

**How to apply:** Keep legacy catalog gates intact, verify new namespace parity and interpolation separately, and explicitly disclose that legacy JSON scanners do not measure the additive namespace.

The first-time Spanish experience must begin before login or registration by automatically detecting Spanish on the device, without requiring an account, saved preference or manual language selection.

**Why:** The founder identified this as the original device experience problem and explicitly required it not be lost in broader localization work.

**How to apply:** Include fresh-session Spanish-device checks on public entry, login and registration alongside English fallback and explicit-language-choice checks.

Hardcoded-string scanner results are candidates, not confirmed customer defects.

**Why:** The founder specifically said not to chase scanner findings blindly and to prioritize text actually visible to customers.

**How to apply:** Verify visibility and meaning before extracting strings; preserve product names and identifiers and distinguish static evidence from browser/provider verification.

Before reporting missing translations, resolve imported helper aliases, the caller's namespace and plural resource forms; distinguish a missing English value from a missing Spanish value.

**Why:** A bare-key or helper-name scan can falsely classify connected consumer phrases and plural messages as missing, and a Spanish-only entry is not an untranslated-Spanish defect.

**How to apply:** Treat initial lookups as candidates until source ownership and actual resource resolution are reconciled. Keep dictionary presence separate from runtime visibility and semantic approval.

Required first-run consent gates cannot be treated as optional untranslated exceptions when claiming a Spanish consumer journey is complete.

**Why:** Translating headings and buttons still makes a Spanish-speaking new user read and accept English; clinical/legal review requirements block completion rather than remove the gate from scope.

**How to apply:** Prepare exact Spanish wording for explicit approval without activating unapproved clinical/legal copy. Keep the task incomplete until the required explanation and acknowledgments are translated and their existing checkbox behavior is verified.

The founder approved the revised 32-section English/Spanish onboarding comparison for Development implementation only. Preserve both required consent checkboxes, the onboarding route, all medical/AI disclosures and current clinical safeguards; no Production deployment is authorized.

**Why:** The founder explicitly approved this bounded wording after the side-by-side source-fidelity review.

**How to apply:** This approval is for onboarding copy, not broader clinical language or medical/legal certification. Changes to the approved disclosure/acknowledgment meanings need renewed approval.

Keep the application-wide localization inventory as a separate task. Do not begin additional translation work until the founder reviews that inventory and authorizes the next scope.

**Why:** The founder requested a customer-surface inventory that distinguishes actual text from scanner candidates and identifies shared fixes, rather than assuming a centralized language engine translates every feature.

**How to apply:** Include routes, features, modals, sheets, menus, notifications, shared components and mobile/desktop variants. Report broad phase scope separately from measured coverage; connect future languages through the existing architecture.

Finish the read-only application-wide localization inventory before translating individual pages. Keep measurement repairs separate from broad translation work, and reuse the existing measurement infrastructure rather than building another system.

**Why:** The founder reviewed the international audit and explicitly selected inventory-first work, with measurement findings reserved for a separate, carefully tested repair.

**How to apply:** Map untranslated pages and shared text owners without application-code changes or paid AI services. Return shared-first priorities for review; do not combine unit or nutrition changes with translation implementation.

After reviewing the completed inventory, the founder selected a Development-only next scope: shared food components, Recipe Maker, Create a Dish, Grocery Coach and shopping, with a permanent new-interface-text localization check established before implementation.

**Why:** The founder wants shared-first reuse and prevention of newly introduced English interface text, not another broad inventory or a separate Spanish application.

**How to apply:** Use the existing EN/ES architecture, preserve English, verify desktop/mobile and report protected content for separate approval. Keep clinical/legal wording, server messages, measurement repairs and broader Business Center/ProCare expansion separate; never weaken existing release checks.

Copilot and voice-service removal require a reviewed dependency audit and explicit approval; localization work alone does not authorize disconnecting narration.

**Why:** The founder requested the smallest safe way to remove unnecessary ElevenLabs narration while preserving essential text features and accessibility, and explicitly required review before removal.

**How to apply:** Distinguish narration, microphone input, transcription, browser speech, recorded media and text-based Copilot functionality. Propose a bounded shutdown separately; do not treat deleting a voice secret as an approved implementation.
