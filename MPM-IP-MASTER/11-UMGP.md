# System 11: Unified Meal Generation Pipeline (UMGP)

**Classification:** Core Infrastructure — AI Orchestration
**Status:** Active, Production

---

## Purpose

The Unified Meal Generation Pipeline is the central orchestration layer that routes all meal generation requests across MPM's multiple generation engines, enforces the protocol stack, selects the appropriate AI strategy, and delivers validated meal output.

Every generation event — whether initiated from the Create a Dish page, the Fridge Rescue tool, the Meal Planner, or a ProCare board — flows through UMGP. It is the traffic controller for the entire generation infrastructure.

---

## Generation Contexts

UMGP serves multiple distinct generation contexts, each with different prompt strategies, constraint sets, and output formats:

| Context | Description | Unique Logic |
|---|---|---|
| **Create a Dish** | General meal creation | Full UP-FEM, preference weighting |
| **Chef's Kitchen** | Walkthrough-style meal creation | Step-by-step instruction emphasis |
| **Fridge Rescue** | Ingredient-constrained generation | Must-use ingredient enforcement |
| **Snack Creator** | Small-portion, snack-appropriate | Portion and macro calibration for snacks |
| **Beverage Creator** | Drink generation | Routes to BIS (System 14) |
| **Craving Creator** | Craving-informed generation | Craving signal interpretation |
| **Meal Planner** | Multi-day board planning | Variety enforcement, starch distribution |
| **Holiday Feast** | Multi-course meal generation | Course sequencing, serving size scaling |

---

## Pipeline Stages

### Stage 1: Request Intake
Generation request arrives with context type, user ID, and optional constraints (ingredients, cuisine, craving signal).

### Stage 2: Protocol Envelope Assembly
UP-FEM (System 1) assembles the UserProtocolEnvelope for this user's current state.

### Stage 3: Hub Activation Check
AHCS (System 2) evaluates whether clinical hubs should activate and injects hub-specific overrides.

### Stage 4: Starch Game Plan Evaluation
SGPCS (System 9) evaluates the day's starch state and injects guidance.

### Stage 5: Engine Selection
UMGP selects the appropriate generation engine (stable, unified, restaurant, etc.) based on context and configuration.

### Stage 6: Prompt Assembly
The system prompt is assembled from:
- ProtocolPromptBlock (from UP-FEM)
- Hub overlays (from AHCS)
- Context-specific instructions
- Starch guidance
- Creator overlay (if Signature Kitchen context)

### Stage 7: AI Generation
The assembled prompt is sent to the AI model. Generation parameters (temperature, model version) are set per context type.

### Stage 8: Post-Generation Validation
- UP-FEM post-generation scan
- Macro Truth Contract validation (System 3)
- Allergy guardrail scan

### Stage 9: Stable Generation Fallback
If primary generation fails or produces invalid output, the stable meal generator provides a deterministic fallback rather than returning an error.

### Stage 10: Output Delivery
Validated meal object is returned to the calling context and stored in the user's session/board.

---

## Architecture

```
Generation Request (any context)
    │
    ├── UP-FEM Protocol Envelope (System 1)
    ├── AHCS Hub Activation (System 2)
    ├── SGPCS Starch Evaluation (System 9)
    └── Creator Overlay (System 10, if applicable)
         │
         ▼
    Engine Selection
    ├── unifiedMealGenerator.ts (standard)
    ├── stableMealGenerator.ts (fallback)
    ├── fridgeRescueGenerator.ts (fridge rescue)
    └── restaurantMealGeneratorAI.ts (restaurant context)
         │
         ▼
    AI Model Call
         │
         ▼
    Post-Generation Validation
    ├── UP-FEM scan
    ├── MTC macro check (System 3)
    └── Allergy guardrail scan
         │
    ┌────┴────────┐
  PASS          FAIL → Retry → Stable fallback
    │
    ▼
  Output: UnifiedMeal object
```

---

## Key Files

| File | Role |
|---|---|
| `server/services/unifiedMealPipeline.ts` | Core pipeline orchestrator |
| `server/services/universalMealGenerator.ts` | Standard generation engine |
| `server/services/stableMealGenerator.ts` | Deterministic fallback engine |
| `server/services/fridgeRescueGenerator.ts` | Fridge rescue engine |
| `server/services/restaurantMealGeneratorAI.ts` | Restaurant context engine |
| `server/services/protocolEnvelope.ts` | Protocol assembly |
| `server/services/allergyGuardrails.ts` | Allergy scan |
| `server/services/guardrails/macroTruthContract.ts` | Macro validation |

---

## What Makes This Unique

1. **Single pipeline, multiple contexts** — eight distinct generation contexts share one orchestration layer, ensuring consistent enforcement while maintaining context-specific logic
2. **Stable fallback architecture** — no generation event returns an error to the user. If AI generation fails, the stable generator provides a safe, validated fallback meal
3. **Layered prompt assembly** — the AI prompt is not a static template. It is dynamically assembled from multiple independent systems (UP-FEM, AHCS, SGPCS, Creator) each contributing their layer without knowledge of the others
4. **Post-generation integrity loop** — the pipeline validates output before delivery, making the AI's output a starting point rather than a final answer

---

## Integration

- **Called by**: All generation-facing routes and page actions
- **Calls**: UP-FEM (1), AHCS (2), MTC (3), SGPCS (9), SKCS (10), BIGRG (6)
- **Outputs to**: Meal board, meal logs, shopping list pipeline (SINAE — System 8)
