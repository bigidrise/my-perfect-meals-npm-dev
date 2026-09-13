---
name: Mobile page scroll ownership
description: The shared mobile scrolling contract for routed pages, fixed navigation, and route transitions.
---

`RootViewport` is the sole vertical page scroller. Routed pages fill that owner instead of creating `100vh` boundaries or relying on window scrolling. Fixed global controls may remain fixed, but their full rectangles must not disable vertical touch panning.

**Why:** A fixed dynamic-viewport scroll layer, page-level viewport sizing, window scroll calls, and a full-width fixed navigation layer with vertical gestures disabled caused intermittent dead swipes and content appearing to scroll behind stationary layers on mobile.

**How to apply:** Keep document scrolling disabled, route page-level scroll-to-top through `RootViewport`, allow `pan-y` on fixed navigation containers, and reserve nested `overflow-y: auto` for true modal or sheet internals. Preserve safe-area padding independently.