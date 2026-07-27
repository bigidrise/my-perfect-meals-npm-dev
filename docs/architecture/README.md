# Architecture Decisions

This directory contains architectural contracts and decision records for the MyPerfectMeals platform. Each document captures the *why* behind a design, not just the *what*, so future developers (and AI agents) don't have to rediscover the reasoning.

**Rule:** Before simplifying, consolidating, or replacing any system described here, read the relevant document first.

---

## Index

| Document | System | What it covers |
|---|---|---|
| [certification-contract.md](./certification-contract.md) | Certification & Phase 1 Gating | Separates gate evaluation (`phase1-status`) from cert record retrieval (`/:certType/progress`); defines the `platform_mastery` / legacy `platform+is_certification_track` predicate; migration bridge and rollback |

---

## How to add a new entry

1. Create a new `.md` file in this directory.
2. Open with a short **ADR Summary** box explaining the *intent* behind the design — not just the mechanics.
3. Include: what problem it solves, what the contract is, what rules developers must follow, and any known edge cases.
4. Add a row to the index table above.

Architecture decisions that belong here:
- Any pattern that two or more features depend on
- Any design that caused or could cause a confusing review/regression cycle
- Any API contract where misuse would silently produce wrong behavior
- Any migration or backward-compatibility bridge that must not be removed prematurely
