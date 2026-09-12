---
name: Multi-organization membership
description: Product and authorization rules for one account managing multiple isolated organizations.
---

A durable organization tenant exists independently of every person who creates, owns, administers, or manages it. Users attach through organization-scoped memberships and may hold different roles in multiple organizations. A Hub selects the active organization, and one reusable dashboard reloads that organization's isolated data.

After every fresh sign-in, access determines which workspace choices are available but never chooses one for the user. Personal-only accounts route directly to Personal; any account with two or more of Personal, Organization, and Studio sees the chooser. Saved workspace state may preserve continuity inside the app but cannot bypass this choice at sign-in.

**Why:** Businesses must retain their data and access when an owner retires, an employee leaves, or an external manager is replaced. No user ID or email is the organization's identity. A role, membership, owned business, or saved workspace is permission to offer a destination—not consent to auto-route there.

**How to apply:** Use a permanent tenant ID for organization-owned data. Treat creator, business authority, internal admin, and external manager as memberships. Require server-validated organization/location selection, and never allow removal of the last controlling authority without a replacement. Show Personal + Organization even when Studio is unavailable; gate Studio with its existing eligibility signal. Choosing Organization with multiple options opens the Organization Hub.

Personal affiliate relationships and organization Partner/Revenue relationships may coexist for the same user. Keep personal/social affiliate records nullable by organization, but organization dashboards must resolve only records keyed to the selected organization UUID. Assign legacy organization history explicitly; never infer ownership from list order or the first available organization. External affiliate webhooks may look up a globally unique external affiliate ID, but every mutation must target the exact matched account row.

**Why:** A person may independently promote MPM while administering one or more organizations. User-scoped fallback, email matching, or updates by user ID can leak commercial history across tenants or attribute incoming revenue to the wrong organization.

**How to apply:** Preserve user-owned affiliate rows for future personal programs. For organization reads and actions, resolve and authorize the active workspace server-side, then query by organization UUID alone; a creator/owner user ID stored on the row is not an authorization filter. Include organization identity in client cache boundaries, and update webhook state by the matched account's primary key.