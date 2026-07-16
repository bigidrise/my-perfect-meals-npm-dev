---
name: Performance Hub macro anchoring
description: How the /ask endpoint enforces Macro Calculator ownership over all macro targets; validator rules and pre-flight gate pattern.
---

## Rule
The AI coach in /api/performance/ask MUST NOT invent macro values. The Macro Calculator (daily_protein_target, daily_carbs_target, daily_fat_target, daily_calorie_target on users table) is the sole baseline authority. The Performance Protocol resolver applies session modifiers on top — the AI executes these, never invents a third set.

## How to apply
- /ask fetches live targets + resolves today's session before calling OpenAI
- If any core target is null → return `{ macroCalculatorRequired: true }` before calling OpenAI
- System prompt includes two context blocks: AUTHORITATIVE BASELINE TARGETS and TODAY'S RESOLVED PERFORMANCE TARGETS
- `server/lib/performanceResponseValidator.ts` validates response; one retry then deterministic fallback
- meal generation path (applyGuardrails in guardrails/index.ts) passes dailyProteinTarget when available; logs warn + 160g fallback if absent

**Why:** OpenAI invented 300g protein for a 105-lb female (stored target: 126g), causing potential harm to real users on a clinical-adjacent platform.

**How to apply:** Any new coaching/AI endpoint that discusses macros must follow this three-step pattern: (1) fetch live targets, (2) gate if null, (3) inject authoritative context blocks + validate.
