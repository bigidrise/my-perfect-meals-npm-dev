---
name: Multi-organization membership
description: Product rule allowing a professional to hold different roles across organizations.
---

A user may remain an active staff member in one organization while creating and owning a different organization. Membership identity and duplicate protection are scoped to the organization/user pair, not globally to the user.

**Why:** Organization ownership is a valid separate role; a global one-active-membership-per-user rule blocked the pre-payment setup flow for existing staff members.

**How to apply:** Preserve same-organization uniqueness, tenant isolation, authorization checks, and transactional organization creation. Do not add a global active-membership uniqueness constraint.