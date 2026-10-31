---
name: DOM snapshot CSS fidelity
description: Snapshot CSS fidelity and references for focused Jest execution and Vite-only feature gates.
---

JSDOM HTML serialization can omit vendor-prefixed inline CSS, including the vertical box orientation needed for line clamping. A browser screenshot of that HTML can falsely report unbounded text growth even when React would apply the property in a real browser.

**Why:** Responsive checks of the actual rendered Saved Groceries DOM exposed this serialization difference.

**How to apply:** For static browser checks, include the application's compiled stylesheet and prefer its complete CSS utility classes for vendor-dependent behavior. Otherwise mount the real React component in a browser. Do not change working production behavior solely to satisfy an incomplete serialized snapshot.

## Live browser freshness

Responsive browser results apply to the loaded DOM and stylesheet, not automatically to the current working tree. A disconnected Development HMR session can continue displaying obsolete component markup after an edit.

**Why:** A release audit initially classified stale markup as a failed responsive correction after HMR connection errors.

**How to apply:** Establish that the browser has the current markup and CSS before judging a correction. If source and rendered classes disagree, require a fresh load rather than changing working code to satisfy an obsolete view.

## Related test runtime constraints

- [Focused Jest execution](focused-jest-execution.md) — isolated transpilation and separate type checks avoid loading the entire project twice.
- [Vite-only feature gates in Jest](vite-feature-gates-jest.md) — isolate import.meta.env gates from request helpers used by CommonJS tests.
