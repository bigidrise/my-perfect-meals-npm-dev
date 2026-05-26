# System 01: Universal Protocol-First Enforcement Model (UP-FEM)

**Classification:** Core Infrastructure — Safety-Critical
**Status:** Active, Production
**Version:** v2 (4-Layer Hierarchy)

---

## Purpose

UP-FEM is the foundational safety and compliance system for My Perfect Meals. Every piece of AI-generated food content — every meal, snack, beverage, and holiday feast — passes through this enforcement model before it reaches the user.

It answers one question at every generation event:

> *"Given everything we know about this person — their medical conditions, their identity, their culture, and their preferences — what can the AI safely and appropriately generate?"*

---

## The 4-Layer Constraint Hierarchy

The hierarchy is enforced in strict priority order. Lower layers cannot override higher ones.

```
Layer 1: MEDICAL          (Hard stops — clinical safety, allergies, oncology)
Layer 2: DIETARY IDENTITY (Halal, Kosher, Vegan, Vegetarian — identity-level, non-negotiable)
Layer 3: CULTURAL/CUISINE (Preferred cuisines, cultural cooking norms, technique restrictions)
Layer 4: BEHAVIORAL       (Taste preferences, heat tolerance, portion style — user-adjustable)
```

A user who prefers spicy food (Layer 4) but has a GI condition (Layer 1) will receive heat-capped recipes regardless of their stated preference. The system does not ask the user to reconcile this conflict — it resolves it automatically and silently.

---

## How It Works

### Step 1 — Protocol Envelope Assembly
When a user initiates any generation event, `protocolEnvelope.ts` queries the user's full profile and assembles a `UserProtocolEnvelope` object. This is the complete, ranked specification of what the AI is permitted to generate for this specific user in this specific moment.

### Step 2 — Prompt Block Injection
The envelope is serialized into a `ProtocolPromptBlock` — a structured natural-language instruction block injected into every AI system prompt before user-facing content is added.

### Step 3 — Pre-Generation Enforcement (`enforceBeforeGenerate()`)
Hard constraints are applied before the AI call is made. This prevents sending unconstrained prompts to the model even temporarily.

### Step 4 — Post-Generation Scan (`scanGeneratedOutput()`)
The AI's output is scanned against the same ruleset after generation. If violations are detected, the output is rejected and regenerated — never silently mutated. This prevents the AI from "reasoning around" constraints.

### Step 5 — Macro Truth Pass
Output is passed to the Macro Truth Contract (System 03) for numeric integrity validation before final delivery.

---

## Procedural Layering (Unique Differentiator)

UP-FEM does not only enforce ingredient restrictions. It enforces **procedural restrictions** — cooking technique rules derived from identity.

Examples:
- **Halal**: No deglazing with wine, no alcohol in marinades, even when burned off
- **Kosher**: Dairy and meat separation enforced in instructions, not just ingredients; equipment notes included
- **Oncology**: No raw proteins, restricted fermented foods, temperature guidance for food safety

This level of procedural granularity is not found in any consumer nutrition platform.

---

## Architecture

```
User Request
    │
    ▼
protocolEnvelope.ts
    ├── Queries: userProfile, allergies, medicalConditions
    ├── Queries: dietaryIdentity, culturalPreferences
    ├── Queries: behavioralPreferences, heatTolerance
    └── Assembles: UserProtocolEnvelope
         │
         ▼
    ProtocolPromptBlock (injected into AI system prompt)
         │
         ▼
    enforceBeforeGenerate()
         │
         ▼
    [AI Generation]
         │
         ▼
    scanGeneratedOutput()
         │
    ┌────┴────┐
  PASS      FAIL → Regenerate (max 2 retries)
    │
    ▼
  Macro Truth Contract (System 03)
    │
    ▼
  Delivered to User
```

---

## Inputs

| Input | Source |
|---|---|
| Medical conditions | `server/db/schema/userHealthProfile.ts` |
| Allergies | `server/db/schema/` (allergy fields) |
| Dietary identity | User onboarding, profile |
| Cultural/cuisine preferences | Onboarding V3, profile |
| Behavioral preferences | Profile, ongoing updates |
| Active clinical flags | Oncology assignment, GLP-1 status, diabetic status |

## Outputs

| Output | Used By |
|---|---|
| `UserProtocolEnvelope` | All generation services |
| `ProtocolPromptBlock` | AI system prompt injection |
| Enforcement decision (PASS/FAIL) | Generation pipeline |
| Violation report | Telemetry, regeneration trigger |

---

## Key Files

| File | Role |
|---|---|
| `server/services/protocolEnvelope.ts` | Envelope assembly and serialization |
| `server/services/allergyGuardrails.ts` | Allergy hard-stop enforcement |
| `server/services/unifiedMealPipeline.ts` | Pipeline integration point |
| `server/services/guardrails/` | Individual guardrail modules |
| `server/services/guardrails/macroTruthContract.ts` | Downstream macro integrity |

---

## What Makes This Unique

1. **Simultaneous multi-condition enforcement** — a user can be Halal + diabetic + GLP-1 + anti-inflammatory and all four are enforced in a single generation event without conflict
2. **Procedural enforcement** — cooking technique restrictions, not just ingredient restrictions
3. **Identity-tier separation** — religious/cultural dietary identity is protected at a higher priority tier than taste preferences, preventing accidental override
4. **Regeneration, never mutation** — the system never "edits" AI output to make it compliant; it rejects and re-generates, preserving output integrity

---

## Integration

UP-FEM is the mandatory entry point for every generation engine in the platform. It cannot be bypassed. The following systems all call it:

- Unified Meal Generation Pipeline (System 11)
- Beverage Intelligence System (System 14)
- Adaptive Hub Coupling (System 2) — for hub-specific overrides
- ProCare Professional Infrastructure (System 5) — for coach-assigned overrides
- Oncology Support Protocol (System 12)
