---
name: ProCare Client Ownership — Three Architectural Principles
description: The Single Client Truth Principle and two supporting rules governing what belongs on the client profile vs. professional relationship tables. Apply before adding any field anywhere in the ProCare/studio system.
---

## The Three Principles

### Principle 1 — Single Client Truth

> **A client exists exactly once. Every portal — client, trainer, physician, admin — renders the same client profile with different permissions. Professional relationship tables may cache client state only for performance, never as an authoritative source. Any cached value must be derivable from the client profile and safe to rebuild.**

The `assignedBuilder` bug is the canonical example of this failing: `studioMemberships.assignedBuilder` became an authoritative source instead of a cache, diverged from `users.activeBoard`, and the reconnect path restored the stale value.

**The one question to ask before adding a field:**
> "Is this changing the client, or is it changing the professional relationship?"

### Principle 2 — Relationship vs. Identity

Relationship tables describe:
- Who is connected (clientUserId, proUserId, studioId)
- Permissions (mealBoardControl, workspace)
- Lifecycle (status, isArchived, joinedAt, active)
- Relationship-specific context (notes, invitations, check-in schedules, cycle protocols)

Relationship tables never define who the client IS:
- Active builder → client profile
- Macros, goals, biometrics → client profile
- Medical conditions, protocols → client profile
- Board contents → client-owned
- Builder settings (starch strategy, performance phase, GLP-1 config) → client profile

**Ownership test for builder settings:** "If the client changes trainers tomorrow, should this still exist?" If yes → client profile.

### Principle 3 — AI reasons over the client profile

Every AI feature (Coach's Corner, builders, scanners, protocol recommendations) must reason over one unified client profile, not over whichever portal the user happened to be using. The protocol envelope and macro truth contract enforce this at generation time; the principle must also hold at the data layer.

---

## What belongs where

**Membership / relationship table** (`studioMemberships`, `clientLinks`):
- Connection identity: studioId, clientUserId, proUserId
- Relationship lifecycle: status, isArchived, joinedAt, active
- View context: workspace (clinician vs. trainer — derived from studio.type at connect time)
- Relationship permissions: mealBoardControl
- Coach's instructions scoped to this relationship: clientCycleProtocols (studioId is correct here)

**Client profile** (`users` and dedicated client tables):
- Active builder (users.activeBoard, users.selectedMealBuilder)
- Medical conditions, specialty conditions, protocols
- Macros, goals, biometrics, preferences
- Performance context, therapeutic context, pregnancy context, GLP-1 targets
- Board ownership (boards belong to the client, pros edit them)
- Builder settings of any kind

---

## Confirmed misplacements in studioMemberships

| Column | Problem | Status |
|---|---|---|
| `assignedBuilder` | Client's active builder — wrong table | Fix A+B address divergence; Fix C (eliminate column) is structural endgame, deferred |
| `builderSource` | Provenance of who set the builder — not current state, not relationship state | Should become a builder-change event record (actor, from, to, reason, timestamp) — not on profile, not on membership |
| `activeBoardId` | UUID pointer to a board — appears unused in server logic | Leave until board ownership is intentionally redesigned; do not remove |

---

## The cache vs. authoritative source distinction

Acceptable denormalization:
- `users.isProCare` — derivable from `clientLinks.active`, stored for query performance, updated atomically on every write path ✅

Unacceptable authoritative copy:
- `studioMemberships.assignedBuilder` — diverged from `users.activeBoard` and became the authoritative source for the trainer dashboard ❌

**Rule:** A cached field must be (a) derivable from the canonical source, (b) always updated atomically when the canonical source changes, and (c) treated as read-only by consumers — never written to directly as if it were the source.

---

## The oncologySupportContext split (design debt, not bug)

`users.oncologySupportContext` conflates:
- **Clinical facts** (diagnosis, cancer history, allergies) → should persist on client profile indefinitely
- **Provider plan** (physician instructions, current treatment workflow) → can reasonably expire when the professional relationship ends

Currently the whole field is cleared on deactivation. Named as design debt; no immediate action needed.

---

## Next audit targets (in priority order)

1. **Meal boards** — who owns the board? Answer must be: the client. Pros edit it, not own it.
2. **Macros** — who owns them? Client. Pros prescribe/modify, client profile holds them.
3. **Protocols** — split clinical facts (permanent) from provider plans (relationship-scoped).
4. **Builder settings** — starch strategy, performance phase, GLP-1 behavior — do these survive a trainer change? If yes, they're on the client profile.
