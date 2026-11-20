---
name: Frontend CSS testing limits
description: JSDOM color assertions do not fully model the browser's CSS specificity cascade.
---

Use JSDOM computed styles as a limited check, not proof of browser cascade specificity. Keep fixture stylesheet order consistent with the actual application.

**Why:** The installed JSDOM applied a later generic dark-mode color rule over an earlier, more-specific important SVG rule. A browser's specificity calculation would favor the SVG rule.

**How to apply:** Check the real selectors and stylesheet order as well as computed colors. Do not weaken production styling merely to satisfy an unrealistic fixture order; use browser evidence when the result depends on cascade behavior.

Offline visual fixtures must control public release metadata as well as API responses.

**Why:** A real release manifest opened an unrelated update overlay over synthetic Shopping controls, obscuring screenshots and stalling clicks despite pre-acknowledged onboarding flags.

**How to apply:** Supply fixed synthetic release metadata consistent with the fixture's acknowledgement state before capturing layout. Do not disable or modify the application's release-notice behavior.
