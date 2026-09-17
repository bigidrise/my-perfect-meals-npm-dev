---
name: Business workspace shell
description: Layout boundary for authenticated organization and Business Suite routes.
---

Authenticated organization and Business Suite routes use dedicated business desktop chrome. They must not bypass all layout, and they must not reuse consumer navigation as a substitute.

Standalone business enrollment, setup, invitation, and offer-acceptance flows remain outside the authenticated business shell.

**Why:** A broad business-route bypass removed both inappropriate consumer navigation and required desktop structure, leaving the entire authenticated business route family without a sidebar or header.

**How to apply:** Classify authenticated business workspaces separately from standalone flows, preserve mobile page behavior, and keep page-level mobile headers from overlapping the desktop shell.