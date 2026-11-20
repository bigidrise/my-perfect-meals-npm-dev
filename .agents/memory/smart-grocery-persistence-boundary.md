---
name: Smart Grocery persistence release boundary
description: Approved minimal Development picker, historical product evidence, older Production API loss, and isolated live-verification boundaries.
---

The Smart Grocery foundation and approved minimal product picker are
Development-only. Unrestricted recommendations, clinical-rule changes, catalog
ranking and prompt changes still require separate approval; stored product
assessments are historical evidence, not lasting medical clearance.

## Explicit shopping-reference permission

"A shopping reference represents the customer's intended product, not medical or
dietary clearance." The user approved a separate, explicitly labeled unverified
shopping-reference workflow in Development. This supersedes the earlier
view-only restriction for this intent-only workflow, NOT verified-selection rules.
Keep verified selections and unverified references distinguishable. Preserve all
unresolved warnings, exact-product identity requirements and known-conflict
exclusions. Update the existing row without duplicates or changes to quantities
or recipe contributions. Never mark a reference verified, medically cleared or
suitable for a restricted diet. No Production deployment, live paid-provider
calls or real-account writes without separate authorization.

**Why:** The user explicitly chose unverified references after the actual
Development recommendations remained unselectable despite a synthetic eligible
button demonstration.

**How to apply:** Treat saving shopping intent as a separate action and validation
path. Missing eligibility checks stay unresolved. Synthetic verification must
exercise the actual unresolved service-response contract, not assume an eligible
fixture proves the customer's workflow.

For offline browser fixtures, align both profile endpoints, local storage,
capability owner and row ownership with the unchanged server-composed reference
subject before interactive checks. Count Shopping mutations separately from
advisor POST lookups, and inspect the active confirmation controls rather than
requiring every below-fold recommendation action to be in view simultaneously.

**Why:** Reused fixture identity defaults stopped the browser before persistence;
broad POST and viewport assertions then falsely flagged the working reference
journey. Never relax account guards or rewrite the service payload to repair
fixture identity.

**Why:** The user approved the minimal existing-catalog picker after the persistence
foundation, not a medical-needs-first recommendation engine.

**How to apply:** Keep new work within the approved foundation unless the user
explicitly expands scope. Preserve current profile revalidation authority.

The approved interface reuses Grocery Coach's existing product lookup and
choices, not a third recommendation engine. Keep the existing list, use a small
Choose Product action only where packaged-product selection matters, and start
lookups only when the member taps it. Show a saved choice beneath the original
ingredient without replacing its name or recipe quantity; allow change/clear.

The founder confirmed Find a Product's generic-to-branded personalized
recommendation experience as the intended source for Shopping List options.
Reuse that experience rather than treating a parallel catalog-only presentation
as equivalent. Reuse the actual Find a Product recommendation presentation
where practical; sharing its service or explanation text alone is not sufficient.
The founder explicitly rejected simply restyling ShoppingProductPicker and
calling it the same experience. Report the reusable components and minimal
adapter first, then obtain approval before changing that implementation.
Independently enforce the existing selection requirements:
an AI recommendation or Add/Save action does not establish verified eligibility.
Show up to three eligible branded choices without weakening rules to fill the
count. Preserve existing Product Scan identity and require explicit alternative
selection.

**Why:** The founder confirmed the intended behavior using Development screenshots
and explicitly distinguished recommendation Add/Save from Shopping List
replacement. Development integration and offline verification are approved.
Live paid-provider calls, real-account writes, Production deployment, and GitHub
push or merge require separate authorization.

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
without internal identifiers. Useful review-needed catalog products may be shown
as review-needed references with a clear current-label notice; only existing eligible
structured choices may be saved as verified selections. The separate intent-only
reference permission above now governs saving unverified shopping intent. Never display established conflicting products.
Review-only cards should offer available exact-source identity and label evidence
without gaining verified-selection permission. Bind selectable recommendations to the
named brand, product and variant; word overlap alone is not that binding. An
unresolved avoidance check proves neither presence nor absence of the ingredient.
Do not describe the customer selection workflow as fixed merely because a
synthetic eligible fixture renders Choose. An unimplemented verification path
still prevents verified selections; saving a reference does not resolve it.

**Why:** The user explicitly asked to remember this distinction after finding that
Smart Grocery's stricter selection boundary can exclude products Grocery Coach
displays, then separately approved view-only references and simple fallback tips
without changing selection eligibility or Grocery Coach behavior.
The founder subsequently approved evidence-first identity/review corrections,
not fabricated verification or bypassing unresolved avoidance checks.
The founder then reported that the screenshot showed Choose while the actual
Development app still allowed no selections; fixture evidence is not acceptance
of the actual customer workflow.

**How to apply:** Keep Smart Grocery concise and useful, not a medical product
certification system. If nothing is selectable, provide one short shopping tip
from already-resolved nutrition guidance or an explicit ingredient qualifier.
Condition names alone never imply a new nutrient restriction. Preserve the
ingredient, quantity, saved choice and Keep generic behavior; no extra AI calls
or automatic searches. Authenticated Neon persistence verification remains outstanding.

Preserve a member's Grocery Coach Choose for Shopping selection when Add All
transfers it to Smart Grocery; do not require the same selection twice. Generic
meal-card ingredients offer Choose Product only when no choice exists. Different
sources alone must not create duplicate rows. Retain a choice across a merge only
when product identity and ingredient requirements are compatible; never overwrite
an existing choice or silently discard conflicts. Incompatible evidence also
requires separate items, without losing quantities or recipe provenance.

**Why:** The user confirmed the Grocery Coach selection experience works as wanted
and approved only its Development Add All transfer and compatible merging, without
changing lookup, ranking, recommendations, selection experience or medical rules.

**How to apply:** Reuse the existing saved-product presentation and selection
system and preserve recipe quantities and qualifiers. Verification uses synthetic
identities and storage; real customer accounts and destructive authenticated
persistence tests are prohibited.
