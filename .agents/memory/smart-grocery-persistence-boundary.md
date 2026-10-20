---
name: Smart Grocery persistence release boundary
description: Shared-schema approval, older Production API loss, unowned cache handling, and the explicit pause before recommendations.
---

The Smart Grocery persistence foundation is Development-only. Product selection,
recommendations, clinical-rule changes, catalog ranking and prompt changes require
explicit next-phase approval; stored product assessments are historical evidence,
not lasting medical clearance.

**Why:** The user approved persistence and isolated synthetic verification, not the
medical-needs-first recommendation phase.

**How to apply:** Keep new work within the approved foundation unless the user
explicitly expands scope. Preserve current profile revalidation authority.

Development and Production share Neon, while the older Production application does
not understand ingredient metadata. Its scoped replacement deletes/recreates items
without metadata; nullable additive storage compatibility is not lifecycle preservation.

**Why:** The user accepted Production compatibility but explicitly identified this
loss boundary. A successful old API response cannot establish metadata preservation.

**How to apply:** Require positive target-API support before new metadata writes;
never promise that selected products survive every Production operation. Do not
rerun the approved additive migration or let schema sync remove its column.

Do not adopt or upload the old unowned global shopping-list browser cache into a
signed-in account.

**Why:** That historical cache does not establish which account owns its contents,
so upgrading persistence must not convert it into cross-account server writes.

**How to apply:** Keep the new cache account-scoped and use server-owned legacy rows
as the restoration source. Keep late asynchronous responses account-bound.
