---
name: Macro replacement boundary
description: Safety rule governing recalculation and replacement of existing macro targets.
---

Macro recalculation must be nondestructive. Existing saved targets remain authoritative while a user enters, edits, cancels, backs out of, closes, or refreshes a recalculation flow. Users with existing targets receive two meaningful warnings before entering replacement recalculation; first-time calculation remains direct.

**Why:** A one-click recalculation flow can cause realistic user error, and preview computation must never silently replace nutrition targets or adherence prescriptions.

**How to apply:** Keep computation read-only. Replace authenticated local state, canonical saved targets, history, and dependent daily prescriptions only at the final explicit save boundary after the server confirms success.

## Explicit meal requests

Explicit requested per-meal macros are not the user's saved daily nutrition prescription. Keep the authoritative daily prescription, server-resolved remaining macros, and requested per-meal targets separate. A meal request must not modify Nutrition Life Plan, the daily prescription, remaining macros, the profile, or stored targets, and must never bypass safety or clinical restrictions.

**Why:** The user explicitly requires meal customization without changing the nutrition plan or its authoritative constraints.

**How to apply:** Treat meal requests as read-only generation constraints within existing safety and nutrition authority, not as a replacement-target save action.