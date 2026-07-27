# Architecture Decisions

This directory contains architectural contracts and decision records for the MyPerfectMeals platform. Each document captures the *why* behind a design, not just the *what*, so future developers (and AI agents) don't have to rediscover the reasoning.

**Rule:** Before simplifying, consolidating, or replacing any system described here, read the relevant document first.

Code comments, commit messages, and pull requests may reference these by identifier (e.g. `See ADR-001 for gate semantics.`).

---

## Index

| ID | Document | System | What it covers |
|---|---|---|---|
| ADR-001 | [certification-contract.md](./certification-contract.md) | Certification & Phase 1 Gating | Separates gate evaluation (`phase1-status`) from cert record retrieval (`/:certType/progress`); defines the `platform_mastery` / legacy `platform+is_certification_track` predicate; migration bridge and rollback |
| ADR-002 | *(pending)* | Restaurant Intelligence Platform | ProviderRegistry, MenuProvider interface, RestaurantIntelligenceEngine, `AwayFromHomeRecommendation`, `MenuResolutionResult` |
| ADR-003 | *(pending)* | Away From Home Domain Model | Shared recommendation contract, translation contract, nutrition confidence/disclosure model, Add to Macros / Add to Plan ownership |
| ADR-004 | *(pending)* | Partner Identity | White label, Founding Partners, promo codes, Rewardful IDs, Stripe promotion codes, referral links, QR codes |
| ADR-005 | *(pending)* | White Label Architecture | Tenant boundaries, branding, feature flags, licensing, partner onboarding |
| ADR-006 | *(pending)* | Shared Builder State | Global performance schedule, daily protocol state, builder synchronization, cross-feature consistency |

Pending entries are reserved identifiers — documents are written when the system has been implemented and stabilized, not speculatively.

---

## How to add a new entry

1. Create a new `.md` file in this directory.
2. Open with a short **ADR Summary** box explaining the *intent* behind the design — not just the mechanics.
3. Include: what problem it solves, what the contract is, what rules developers must follow, and any known edge cases.
4. Claim the next available ADR identifier and add a row to the index above.

Architecture decisions that belong here (must satisfy both criteria):

1. **Multiple systems depend on it.**
2. **A future developer could reasonably "simplify" it and accidentally break the platform.**
