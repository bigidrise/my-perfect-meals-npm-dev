---
name: Professional Context Architecture
description: Phase roadmap, design constraints, and policy model for the two-worlds (personal vs professional) workspace system
---

## Two permanent worlds
- **Personal world:** nutrition, health, diary — belongs to the user forever, never affected by org membership
- **Professional world:** businesses, clients, revenue — contextual, org-funded or independently purchased

## Current constraint (Phase 1)
- `UNIQUE(businessId, userId)` constraint stays — removing it before the Professional Context engine exists creates an uninterpretable state
- No `workspaces` table yet — that is Phase 2
- No "Personal Workspace" concept — personal nutrition IS the personal space

## Phase roadmap
- **Phase 1 (now):** Business Center UX + education + partner onboarding polish
- **Phase 2:** Professional Context service + context switcher (thin layer, no new table migration)
- **Phase 3:** Unified Workspace model + subscription migration

## Client-ownership policies (team workspaces)
Organizations choose one of four policies that governs how seat-holders may use the platform professionally:

1. **Organization clients only** — members cannot add outside clients to this workspace, but may operate a separately paid independent MPM business
2. **Outside clients allowed with disclosure** — members may serve personal clients, clearly labeled as personally owned
3. **Outside clients allowed without restriction** — members may freely serve personal clients, with ownership still recorded
4. **Exclusive organizational use** — members may NOT operate a separate independent professional MPM business (affiliate profile, referral code, client invitations, independent ProCare) while the org-funded seat is active

### Policy 4 — Exclusive Organizational Use (DO NOT CODE UNTIL PHASE 2)
**What it does:**
- Blocks Start Independent Business, affiliate activation, personal client invitations, personal ProCare
- Shows an explanatory message: "Your organization currently provides your professional My Perfect Meals access under an exclusive-use policy. Independent business tools are unavailable while this organization-sponsored seat remains active."
- When org removes member or changes policy: permanent personal identity, Academy/certs, personal nutrition data all remain; org workspace + org clients stay with the org; member may then purchase independently

**Must be disclosed at invitation time** — this materially limits how the coach can use the platform; they must see and accept it before joining.

**Why deferred:**
- The platform cannot yet safely distinguish an org-funded professional entitlement from an independently purchased one under the same user identity
- Depends on the Phase 2 Professional Context engine

**Legal boundary (IMPORTANT):**
- This is an **org-selected contractual policy**, NOT a universal MPM rule
- Restrictions on outside work vary heavily by jurisdiction and worker classification
- FTC nationwide noncompete rule is not currently in effect; state law governs (California broadly voids restraints on lawful professions)
- Independent contractor classification raises separate issues
- **MPM can technically enforce the setting, but the org is responsible for confirming its policy is lawful** with its employment or contractor agreements
- **Attorney review required before this option ships**

**How to apply:**
- Add a `clientOwnershipPolicy` enum column to the business/workspace table in Phase 2 with values: `org_only | outside_with_disclosure | outside_unrestricted | exclusive_org_use`
- Default for new orgs: `org_only`
- Gate enforcement on `exclusive_org_use` in the Professional Context middleware, not the individual feature routes
