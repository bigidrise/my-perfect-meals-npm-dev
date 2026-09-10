---
name: Multi-organization membership
description: Product and authorization rules for one account managing multiple isolated organizations.
---

A user may hold different roles in multiple organizations through one account. A Hub selects the active organization, and one reusable dashboard reloads that organization's isolated data. Membership identity and duplicate protection are scoped to the organization/user pair, not globally to the user.

**Why:** Organization ownership is a valid separate role, and multi-organization administrators must not need duplicate accounts or risk acting on whichever business a query happens to return first.

**How to apply:** Require explicit server-validated organization/location selection for sensitive reads and mutations. Keep the active organization obvious, clear old data before switching, and never hard-code a dashboard per organization.