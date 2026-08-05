---
name: Professional Context Architecture
description: Agreed architectural decisions from the workspace/professional context design session — governs what gets built in Phase 1 vs Phase 2 for multi-business/workspace support.
---

# Professional Context Architecture — Agreed Decisions

## Phase 1 (current — finish before any architecture work)
- Finish Business Center UX and educational content
- Finish partner onboarding experience
- Finish invitation experience (done)
- Finish Dr. Amy / Amber workflow (done)
- Finish trial flows (done)

## Phase 2 (after real partner feedback)
- Introduce Professional Context service — thin layer answering "what am I working inside right now?"
- Allow one identity to belong to multiple business contexts
- Build context switcher UI
- No new tables in Phase 1 that anticipate Phase 2

## Phase 3 (after Phase 2 is proven)
- Refactor businesses + organizations + studios into unified Workspace model
- Move subscriptions to workspace level
- Enterprise hierarchy if needed

## Explicit "do NOT" decisions
- Do NOT build `workspaces` table yet
- Do NOT build `workspace_members` or `user_active_workspace` yet
- Do NOT add a Personal Workspace concept — personal nutrition IS the personal space
- Do NOT remove `UNIQUE(businessId, userId)` constraint before Professional Context exists
  (DB would allow multi-membership but auth, billing, UI, client ownership all assume one)
- Do NOT commit a Phase 2 architecture document to the repo — keep it as external planning artifact

## Two-worlds model (permanent design principle)
**Personal World** — belongs to the individual forever, never transferred to employer:
  nutrition, biometrics, meal plans, medical history, Academy progress, preferences, behavior profile

**Professional World** — contextual, can change:
  organizations, studios, clients, invitations, seats, policies, revenue, Business Center

## UNIQUE constraint status
`businessMembers UNIQUE(businessId, userId)` — INTENTIONALLY LEFT IN PLACE until Phase 2.
Removing it before Professional Context exists creates an inconsistent state the app cannot interpret.

**Why:** From advisory session — "I don't like schema changes that enable functionality the application cannot yet correctly interpret."

## Phase 2 document status
Not in repo. To be written externally as an alignment document when Phase 2 starts.
Will be informed by real organization usage, not theoretical design.
