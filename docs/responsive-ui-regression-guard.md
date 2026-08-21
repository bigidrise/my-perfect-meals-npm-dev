# Responsive UI Regression Guard — Architecture Proposal

**Status:** Proposed — do not implement until reviewed  
**Reference incident:** Recipe Maker (InspirationCaptureModal) — August 2026  
**Problem class:** A correct safe-area fix also restructured `flex/overflow/height` on the modal container. The app compiled cleanly, no JS errors, but the modal was wider than the phone screen and only usable in landscape.

---

## Why a clean console isn't enough

The Recipe Maker regression produced:
- Zero JavaScript errors
- Zero TypeScript errors  
- A passing server start
- A visually broken modal that only appeared on a real phone in portrait orientation

The existing gate (start the server, check for errors) cannot catch this class of bug. Only a check that actually **measures modal bounds relative to the viewport** can catch it.

---

## The minimal-blast-radius rule (immediate, no infrastructure needed)

Before any automated system: encode this rule for every agent working in the codebase.

> **Spacing, padding, and safe-area fixes must not restructure `flex`, `grid`, `width`, `overflow`, or scroll architecture unless the existing structure makes the requested fix impossible. If broader restructuring is necessary, the agent must stop and explain why before touching it.**

This rule alone would have prevented the incident. The safe-area fix required only an inline `paddingTop` style change. The flex column restructuring was unnecessary and increased blast radius from "padding change" to "every layout property of the modal."

This goes into `replit.md` and into agent memory, not just a doc.

---

## Existing infrastructure inventory

| Asset | Status | Relevant |
|---|---|---|
| Playwright (via testing skill) | Available, not yet configured for viewport tests | Yes — primary test runner |
| Mockup sandbox (Vite preview) | Running at port 23636 | Yes — component isolation |
| `scripts/run-prod-acceptance.sh` | Built | Partially (post-publish gate only) |
| `scripts/pre-publish-validate.sh` | Built | Partially (env checks only) |
| `client/src/components/ui/universal-modal.tsx` | In use | Yes — shared primitive |
| `client/src/components/ui/dialog.tsx` | In use | Yes — shared primitive |

---

## Three-gate architecture

```
┌─────────────────────────────────────────────────────┐
│  GATE 1 — Development                               │
│  Responsive Playwright tests                         │
│  Runs: after any change to modal/sheet/dialog files  │
│  Blocks: merge / task completion                     │
└──────────────────────┬──────────────────────────────┘
                       │ passes
┌──────────────────────▼──────────────────────────────┐
│  GATE 2 — Pre-promotion                             │
│  pre-publish-validate.sh (already built)             │
│  + screenshot diff for shared primitive changes      │
│  Blocks: clicking Publish                            │
└──────────────────────┬──────────────────────────────┘
                       │ passes
┌──────────────────────▼──────────────────────────────┐
│  GATE 3 — Post-publish                              │
│  run-prod-acceptance.sh (already built)              │
│  Blocks: marking release healthy                     │
└─────────────────────────────────────────────────────┘
```

---

## Gate 1 — Responsive Playwright tests

### Viewports to test

| Label | Width × Height | Represents |
|---|---|---|
| `small-iphone-portrait` | 375 × 667 | iPhone SE, smallest common phone |
| `large-iphone-portrait` | 390 × 844 | iPhone 14 Pro |
| `large-iphone-portrait-xl` | 430 × 932 | iPhone 14 Pro Max |
| `iphone-landscape` | 844 × 390 | iPhone 14 rotated |
| `android-portrait` | 412 × 915 | Pixel 7 |
| `tablet-portrait` | 768 × 1024 | iPad |
| `desktop` | 1280 × 800 | Baseline desktop |

### Assertions for every modal/dialog

For each viewport, after opening the component:

1. **No horizontal overflow** — `document.body.scrollWidth <= window.innerWidth`
2. **Dialog within viewport bounds** — dialog bounding rect: `left >= 0`, `right <= viewport width`
3. **Close/trash control visible** — the close button exists, its bounding rect is within the viewport, and is not occluded
4. **No unintended multi-column layout** — dialog width on portrait mobile equals dialog width on desktop (within 10%) — catches flex-row accidents
5. **Safe-area clearance** — on notch viewports, modal top edge is below status-bar height
6. **Vertical scroll works** — when content height > viewport, the modal body can scroll (scrollHeight > clientHeight on the scroll container)
7. **Primary action button reachable** — the main CTA button bounding rect is within the viewport

### Components to cover first (Phase 1)

| Component | File | Why first |
|---|---|---|
| InspirationCaptureModal | `client/src/components/InspirationCaptureModal.tsx` | Reference incident |
| UniversalDialog | `client/src/components/ui/universal-modal.tsx` | Shared primitive — affects 20+ modals |
| DialogContent | `client/src/components/ui/dialog.tsx` | Root of all dialogs |
| Sheet / drawer | (bottom sheets pattern) | High mobile usage |

### Trigger rule (what causes these tests to run)

- Any file matching `**/ui/dialog.tsx`, `**/ui/universal-modal.tsx`, `**/ui/*sheet*`, `**/ui/*drawer*`
- Any file matching `*Modal.tsx`, `*Sheet.tsx`, `*Drawer.tsx`
- Any file that imports from `universal-modal` or `dialog`

This is implemented as a Playwright project config that maps file patterns to test suites.

---

## Gate 2 addition — screenshot diff for shared primitives

When `universal-modal.tsx` or `dialog.tsx` is modified:

1. Before the change: capture screenshots at small-iphone-portrait, iphone-landscape, desktop
2. After the change: capture same viewports
3. Compute pixel diff — flag if diff > threshold (e.g., 2% of pixels)
4. Agent must explicitly acknowledge the diff before proceeding

This doesn't block on diff alone — it surfaces the diff for review. A layout change may be intentional. What matters is it's **seen**, not ignored.

The pre-publish-validate script gains one check: `did_shared_primitives_change && screenshot_diff_not_reviewed → FAIL`.

---

## Rollout order

| Phase | What | Effort |
|---|---|---|
| 0 | Encode minimal-blast-radius rule in `replit.md` and agent memory | 30 min |
| 1 | Playwright viewport tests for InspirationCaptureModal | 1–2 hours |
| 2 | Extend tests to UniversalDialog + DialogContent | 1–2 hours |
| 3 | Screenshot diff for shared primitive changes | 2–3 hours |
| 4 | Connect Gate 1 to pre-publish-validate.sh | 30 min |

Phase 0 is free — it costs nothing and prevents the class of bug immediately.  
Phase 1 is the reference incident made into a test that guards future changes forever.  
Phases 2–4 expand coverage progressively.

---

## What the Recipe Maker test specifically would have asserted

```
Given: InspirationCaptureModal is open on small-iphone-portrait (375×667)
When: modal renders in "capture" phase

Assert:
  - modal.getBoundingClientRect().left >= 0       ← FAILS with broken code (−47px)
  - modal.getBoundingClientRect().right <= 375    ← FAILS with broken code (422px)
  - document.body.scrollWidth <= 375              ← FAILS with broken code
  - trashButton.getBoundingClientRect().width > 0 ← PASSES (button was visible but modal was off-screen)
```

Three assertions would have caught the regression before the user ever opened the app on their phone.

---

## Permanent engineering principle

**Every serious bug you fix should leave behind a test that makes that exact class of bug harder to reintroduce.**

The Recipe Maker problem is now fixed. The next step is making it the reason the next 50 modal changes are safer.
