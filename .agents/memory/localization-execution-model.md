---
name: Global Localization Execution Model
description: Finalized execution model, finish line definition, gate rules, and failure reporting standard for the platform-wide localization project.
---

# Global Localization Execution Model

## The finish line (approved definition)
"Done" requires ALL of the following — not just merged migrations:
- All active user-facing surfaces localized
- All 38 active AI generation paths language-governed
- 138 clinical strings reviewed and translated through controlled path
- RTL / expansion / mobile tests passing
- GATE_08 at approved final baseline (below 1,439, agreed before migration starts)
- CI preventing regression
- #1033 final validation report signed off

## Four execution tracks (all authorized)
1. **#1031** — Shared-component migration (highest leverage; fixes many screens per change)
2. **#986** — Wave 1C Premier-facing surfaces (Dashboard, Profile, Business Suite, ProCare); runs alongside #1031
3. **#1032** — Clinical string controlled review workflow (138 strings; separate path from UI migration)
4. **#1033** — Final platform validation (release gate, not just a task)

## GATE_08 rule
- Starting ceiling: **1,439** hardcoded strings on ACTIVE surfaces
- Ratchet: every migration PR must lower or hold this number; any increase = immediate CI failure
- The baseline is a strict downward ratchet, not a permanent plateau

## #1033 is the release gate
- Must be **independent** — cannot trust merge reports; must test the resulting platform
- Reports failures by: `Surface → Locale → Viewport → Failure Type`
  - Example: `Beverage Creator → Arabic → 375px → button text overflow`
- Must verify:
  - No unexplained English leakage (all 13 locales)
  - Language persistence across navigation and session
  - AI response language (all 8 P0 surfaces × EN/ES/TL/AR)
  - Arabic RTL on nav, modals, meal cards, clinical surfaces, Coach's Corner, Grocery Coach
  - Long-text expansion at 375/390/430/768px
  - 130% font scaling in ES and AR
  - Clinical string integrity (GATE_07 passing)
  - GATE_08 at approved final baseline

## Cost/speed model
- Background agents: use for parallelizable batches (multiple surfaces, multiple files)
- Main agent (me): use for focused single-surface patches where context already loaded is faster
- Always choose whichever is faster/cheaper for the specific task shape

## AI locale propagation (completed)
- `getLanguageInstruction()` in `server/utils/languageInstruction.ts` is the canonical helper
- All 8 P0 surfaces patched; 32-case proof matrix at `docs/localization/proof-1011-32-case-matrix.md`
- Chain: `users.preferredLanguage → req.authUser.preferredLanguage → getLanguageInstruction() → system prompt prefix`
- Arabic RTL: `applyDocumentDir` in `client/src/i18n/index.ts` fires on init + languageChanged event

**Why:** Localization is now a platform rule enforced by CI, not a cleanup project. GATE_08 is the watching number throughout all migration work.
