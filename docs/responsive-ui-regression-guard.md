# Responsive UI Regression Guard — Architecture

**Status:** Phases 1–4 implemented — Gate 1 viewport tests + Gate 2 screenshot diff, wired into `scripts/pre-publish-validate.sh`  
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


## Gate 2 — screenshot diff for shared primitives ✅ IMPLEMENTED

**Files:**
- `scripts/modal-screenshot-diff.sh` — orchestrates before/after/acknowledge workflow
- `scripts/modal-screenshot-capture.mjs` — standalone Playwright capture (3 viewports × 7 variants = 21 pairs)
- `docs/screenshots/modal-diff/` — before/, after/, diff/ subdirectories
- `scripts/pre-publish-validate.sh` §7 — fingerprint-validated Gate 2 check

**State model:**

| File | Written by | Purpose |
|---|---|---|
| `.agents/modal-diff-manifest` | `after` | Proof of completed comparison; holds SHA-256 fingerprints of both primitives at capture time |
| `.agents/modal-diff-reviewed` | `after` (auto) or `acknowledge` | Proof of human review; read by pre-publish-validate.sh |

`acknowledge` requires the manifest. Running it without a completed `after` cycle fails. Pre-publish-validate.sh re-hashes both primitives at validation time and rejects the flag if the files changed after the last `after` run — a second edit cannot inherit a prior review.

**Workflow when `universal-modal.tsx` or `dialog.tsx` is modified:**

```bash
# Step 1 — capture baseline BEFORE your edit
bash scripts/modal-screenshot-diff.sh before

# Step 2 — make your changes to universal-modal.tsx or dialog.tsx

# Step 3 — capture AFTER screenshots and compute pixel diff
bash scripts/modal-screenshot-diff.sh after
# If all 21 diffs < 2%: auto-acknowledged, jump to step 5
# If any diff ≥ 2%: inspect docs/screenshots/modal-diff/diff/ then continue

# Step 4 — acknowledge the intentional visual change (only needed when diff ≥ 2%)
bash scripts/modal-screenshot-diff.sh acknowledge

# Step 5 — Gate 2 now passes
bash scripts/pre-publish-validate.sh
```

**Viewports:** small-iphone-portrait (375×667) · iphone-landscape (844×390) · desktop (1280×800)  
**Variants:** universal · confirmation · form · picker · information · workflow · wizard  
**Threshold:** 2% of pixels (ImageMagick AE metric, 3% fuzz) — diffs at or above this require explicit acknowledgement, not a hard block.

---

## Rollout order

| Phase | What | Status |
|---|---|---|
| 0 | Encode minimal-blast-radius rule in `replit.md` and agent memory | ✅ Done |
| 1 | Playwright viewport tests for InspirationCaptureModal | ✅ Done |
| 2 | Extend tests to UniversalDialog + DialogContent | ✅ Done |
| 3 | Screenshot diff for shared primitive changes (Gate 2) | ✅ Done |
| 4 | Connect Gate 1 to pre-publish-validate.sh | ✅ Done |

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
