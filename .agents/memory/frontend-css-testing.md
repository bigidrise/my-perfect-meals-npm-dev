---
name: Frontend CSS testing limits
description: JSDOM color assertions do not fully model the browser's CSS specificity cascade.
---

Use JSDOM computed styles as a limited check, not proof of browser cascade specificity. Keep fixture stylesheet order consistent with the actual application.

**Why:** The installed JSDOM applied a later generic dark-mode color rule over an earlier, more-specific important SVG rule. A browser's specificity calculation would favor the SVG rule.

**How to apply:** Check the real selectors and stylesheet order as well as computed colors. Do not weaken production styling merely to satisfy an unrealistic fixture order; use browser evidence when the result depends on cascade behavior.
