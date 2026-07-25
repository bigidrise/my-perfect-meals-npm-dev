---
name: ProCare Client Ownership — Design Rule
description: Architectural rule governing what belongs on the client profile vs. the professional relationship table, derived from the assignedBuilder sync bug investigation.
---

## The Rule

> **A client exists exactly once. Every portal — client, trainer, physician, admin — renders the same client profile with different permissions. Professional relationship tables may store relationship metadata, but they must never become independent copies of client state.**

## What belongs where

**Membership / relationship table** (`studioMemberships`, `clientLinks`):
- Connection identity: studioId, clientUserId, proUserId
- Relationship lifecycle: status, isArchived, joinedAt, active
- View context: workspace (clinician vs. trainer — derived from studio.type at connect time)
- Relationship permissions: mealBoardControl

**Client profile** (`users` and dedicated client tables):
- Active builder, medical conditions, protocols
- Macros, goals, biometrics, preferences
- Specialty conditions, performance context, therapeutic context
- Weekly meal board ownership
- Builder settings of any kind

## Confirmed misplacements in studioMemberships

| Column | Problem | Resolution |
|---|---|---|
| `assignedBuilder` | Client's active builder stored in relationship table | Fix A+B address divergence; Fix C (read users.activeBoard directly) is structural endgame, deferred |
| `builderSource` | Provenance of who set the builder — not current state, not relationship state | Eventually belongs in a builder-change event/history table (actor, from, to, reason, timestamp) — not on client profile either |
| `activeBoardId` | UUID pointer to a board record — appears unused in server logic | Do NOT remove; leave until board ownership is intentionally redesigned |

## The oncologySupportContext split

`users.oncologySupportContext` conflates two distinct concepts:
- **Clinical facts** (diagnosis, cancer history, allergies) → stay on client profile forever
- **Provider plan** (physician instructions, current treatment workflow, coaching protocol) → can reasonably expire when the professional relationship ends

Currently the whole field is cleared on deactivation. This is defensible but loses clinical facts along with the provider plan. Named as design debt, not a bug to fix today.

## isProCare

Acceptable denormalization of `clientLinks.active`. Every activation/deactivation path updates it atomically. Do not touch.

## Why this matters beyond the builder

The reconnect test exposed one stale field. The same class of bug can occur anywhere the Pro Portal reads from relationship tables instead of the client profile:
- Macro targets — are they on the client or inside the relationship?
- Meal boards — owned by client or scoped to studio?
- Builder settings (performance context, starch strategy, GLP-1 targets)
- Protocols — who owns them, what survives a disconnect?

**How to apply:** Before adding any field to a relationship table, ask: "Does this change because the client changes, or because the relationship changes?" If the former, it belongs on the client profile.
