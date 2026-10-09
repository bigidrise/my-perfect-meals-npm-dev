---
name: Page paywall return policy
description: Why page-level upgrade prompts need safe return navigation separate from action-level prompts.
---

Page-level subscription prompts should leave an accessible parent page behind the modal; action-level prompts should preserve the current usable page.

**Why:** A denied route can intentionally render no protected content, so closing its modal exposes an empty page. Blind browser-history navigation is unsuitable for direct links and can revisit another denied route. A global dismiss redirect would incorrectly move users away from ordinary action-level prompts.

**How to apply:** Preserve subscription predicates and protected-content blocking. Use deterministic accessible destinations and replacement navigation for denied page entries; keep shared modal dismissal and pricing navigation independent of entitlement changes.
