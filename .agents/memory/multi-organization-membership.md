---
name: Multi-organization membership
description: Product and authorization rules for one account managing multiple isolated organizations.
---

A durable organization tenant exists independently of every person who creates, owns, administers, or manages it. Users attach through organization-scoped memberships and may hold different roles in multiple organizations. A Hub selects the active organization, and one reusable dashboard reloads that organization's isolated data.

**Why:** Businesses must retain their data and access when an owner retires, an employee leaves, or an external manager is replaced. No user ID or email is the organization's identity.

**How to apply:** Use a permanent tenant ID for organization-owned data. Treat creator, business authority, internal admin, and external manager as memberships. Require server-validated organization/location selection, and never allow removal of the last controlling authority without a replacement.