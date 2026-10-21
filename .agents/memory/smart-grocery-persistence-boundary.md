---
name: Smart Grocery persistence release boundary
description: Approved minimal Development picker, historical product evidence, older Production API loss, and isolated live-verification boundaries.
---

The Smart Grocery foundation and approved minimal product picker are
Development-only. Unrestricted recommendations, clinical-rule changes, catalog
ranking and prompt changes still require separate approval; stored product
assessments are historical evidence, not lasting medical clearance.

**Why:** The user approved the minimal existing-catalog picker after the persistence
foundation, not a medical-needs-first recommendation engine.

**How to apply:** Keep new work within the approved foundation unless the user
explicitly expands scope. Preserve current profile revalidation authority.

The approved interface reuses Grocery Coach's existing product lookup and
choices, not a third recommendation engine. Keep the existing list, use a small
Choose Product action only where packaged-product selection matters, and start
lookups only when the member taps it. Show a saved choice beneath the original
ingredient without replacing its name or recipe quantity; allow change/clear.

**Why:** The user explicitly approved this simpler Development-only direction and
prohibited a new engine, clinical-rule system, additional migrations, automatic
lookups or extra AI calls. Interface approval is not permission for live writes.

**How to apply:** Preserve existing medical/evidence and entitlement gates; when
suitability cannot be established, do not portray unverified options as approved
recommendations. Preserve explicit ingredient qualifiers; a matching search phrase
or Profile-Matched Pick label is not evidence that a requirement is satisfied.
Unsupported qualifiers and clinical requirements stay generic until reviewed
evidence rules exist. Complete authenticated Neon verification only under its
separate isolation requirements.

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

Restart permission is conditional on inspecting the exact startup path and establishing
that unrelated migrations and unexpected shared-database writes will not run. If
that cannot be established, stop rather than restart. Live persistence checks require
an existing authorized, dedicated test identity whose isolation and exact synthetic-record
cleanup are established before any writes. If isolation cannot be established, stop
without writes or account creation and report for further approval.

**Why:** The user explicitly set this boundary for Development verification because
the database is shared with Production.

**How to apply:** Do not treat a flag's name or a previous successful restart as
proof for a changed startup path. Keep live preview transport checks distinct from
authenticated database save/hydration evidence. Read-only account-isolation approval
is not permission to sign in or perform persistence writes.

Missing reviewed profile-specific product checks are not evidence that a product
contains a restricted ingredient. Explain policy gaps, missing product information,
and unsupported requested qualifiers separately in member-friendly language,
without internal identifiers. Whether members may also see review-only products
is a separate product-design decision, not permission to loosen eligibility.

**Why:** The user explicitly asked to remember this distinction after finding that
Smart Grocery's stricter selection boundary can exclude products Grocery Coach
displays, and approved explanation changes only.

**How to apply:** Preserve Grocery Coach's recommendation behavior and Smart
Grocery's current selection safeguards unless the user separately approves a
review-only product experience.
