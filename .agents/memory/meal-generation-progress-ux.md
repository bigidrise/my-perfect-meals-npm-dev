---
name: Meal generation progress UX
description: Shared product rule for explanatory status messaging during long food-generation requests.
---

**Rule:** Every active food-generation or meal-search surface uses the shared context-aware progress system. Rotating messages explain relevant factors the platform considers; they never claim to expose the backend's exact current stage.

**Why:** Long requests appeared frozen behind one static sentence, while page-specific timers produced inconsistent and sometimes incorrect language such as Chef “crafting” restaurant search results.

**How to apply:** Choose the truthful context and single/options/search/pairing mode. Keep medical or specialty language limited to matching workflows. Results always render immediately when ready; rotation makes no API calls and stops on completion, error, or unmount. Keep safety preflight, image-only loading, board loading, and ordinary page loading separate.