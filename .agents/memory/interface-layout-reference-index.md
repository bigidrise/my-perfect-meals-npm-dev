---
name: Interface layout references
description: Navigation to modal, mobile scrolling, compact selectors, frontend assets and CSS testing rules.
---

- [Safe-area modal layout](safe-area-modal-layout-rule.md) — safe-area spacing must not restructure modal flex or overflow.
- [Universal modal system](universal-modal-system.md) — typed universal modals and the DialogContent import rule.
- [Mobile page scroll ownership](mobile-page-scroll-ownership.md) — RootViewport owns vertical scrolling; fixed controls must allow gestures.
- [Icon pill choices](icon-pill-choice-layout.md) — food selectors place icons above compact text pills.
- [Frontend static asset location](frontend-static-asset-location.md) — browser-facing images belong in client/public; verify the exact served asset before changing page layering.
- [Frontend CSS testing](frontend-css-testing.md) — JSDOM color checks do not fully model browser specificity; fixtures must reflect application stylesheet order.
