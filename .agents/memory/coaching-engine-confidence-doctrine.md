---
name: Coaching Engine — Confidence Doctrine Override
description: getConfidenceInstructions() in confidence.ts is the authoritative LLM constraint — it overrides engine.ts system prompts. Change doctrine here first.
---

## The rule

`server/services/coaching/confidence.ts` → `getConfidenceInstructions(level)` injects text directly into the rendering pass prompt under **CONFIDENCE RESTRICTIONS**. The LLM treats this block as overriding the system prompt instructions in `engine.ts`.

**Why this matters:** System prompt changes to the rendering pass (e.g. "give general education at LOW confidence") are silently defeated if `getConfidenceInstructions("low")` still says "exactly 1 action item — focused on gathering more information." The LLM follows the injected restriction, not the system prompt intention.

## How to apply

When changing coaching philosophy (e.g. evidence doctrine, item caps, tone rules):
1. **Always update `getConfidenceInstructions()` in `confidence.ts` first** — this is the actual control surface.
2. Then add reinforcing text in the engine.ts system prompts (both reasoning pass and rendering pass) as redundant support.
3. Restart the server after any `.ts` service file change — `tsx` does not hot-reload service modules.

## Current doctrine (post Three-Level Evidence update)

LOW confidence = **general education required, not blocked**:
- Language: "in general", "can sometimes be associated with", "generally speaking"
- todayPlan: up to 2 items; at least 1 substantive action (eat/drink); logging item may be second but must NOT be sole item
- `whatItCouldMean`: MUST enumerate general nutritional possibilities — not left as a vague placeholder
- Learning opportunity: MANDATORY (what logging would personalize the next answer)

PARTIAL confidence = combine observed platform data with general guidance for gaps.
HIGH confidence = personalized longitudinal claims using specific platform evidence.

## Verification

Three API-level tests confirmed doctrine works end-to-end:
- **LOW** (zero data): general possibilities enumerated, 2 substantive actions (eat + drink), no "just log something"
- **PARTIAL** (prescription + 1 meal + check-in): mixes specific observed numbers with hedged general language
- **HIGH-ish** (14 days of logs): uses specific numbers ("your avg intake has been ~1050 kcal") while maintaining hedged causal language
