---
name: Business workspace shell
description: Layout boundary for authenticated organization and Business Suite routes.
---

Authenticated organization and Business Suite routes use dedicated business chrome on desktop and mobile. They must not bypass all layout, and mobile must not reuse consumer navigation as a substitute.

Standalone business enrollment, setup, invitation, and offer-acceptance flows remain outside the authenticated business shell.

**Why:** A broad business-route bypass removed inappropriate consumer navigation but also removed required desktop and mobile structure, leaving authenticated business routes without a complete workspace shell.

**How to apply:** Classify authenticated business workspaces separately from standalone flows. Desktop uses the Business sidebar/header; mobile uses one Business header and fixed Business navigator while RootViewport remains the sole vertical scroll owner. Centralize safe-area clearance and remove overlapping page-owned mobile headers.