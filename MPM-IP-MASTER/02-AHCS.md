# System 02: Adaptive Hub Coupling System (AHCS)

**Classification:** Clinical Intelligence — Modular Plugin Architecture
**Status:** Active, Production
**Hubs Live:** Diabetic, GLP-1, Anti-Inflammatory, Competition Pro

---

## Purpose

The Adaptive Hub Coupling System detects a user's active clinical or performance context in real time and activates the corresponding intelligence "Hub" — a self-contained module that injects specialized generation rules, coaching language, and macro guardrails into the AI pipeline.

Rather than hardcoding clinical logic into the core generation engine, AHCS treats each condition as a loadable plugin. New conditions can be onboarded as new Hub modules without touching core infrastructure.

---

## How It Works

### Hub Detection
At session initialization and at each generation event, AHCS evaluates:
- Has the user logged glucose data in the last 24 hours?
- Is the user on GLP-1 medication?
- Does the user have a diabetic or pre-diabetic profile?
- Has a physician or coach assigned an anti-inflammatory protocol?
- Is the user in active competition prep?

Based on this evaluation, one or more Hubs are activated for the session.

### Hub Activation
Each active Hub registers overrides into the `UserProtocolEnvelope` (UP-FEM). Hub overrides are applied *within* the medical layer — they refine, not replace, the core safety rules.

### Glucose-State-Responsive Generation (Unique)
For diabetic and GLP-1 users, AHCS performs a real-time glucose state classification at generation time:

| Glucose State | Classification | AI Instruction |
|---|---|---|
| < 80 mg/dL | Low | "Include fast-acting carbs for blood sugar recovery" |
| 80–140 mg/dL | In-Range | Standard protocol — balanced macros |
| > 140 mg/dL | Elevated | "Hard carb ceiling: 25g net. No added sugars. High fiber." |

This means the same user generating the same meal type at 9am vs 2pm may receive fundamentally different output — calibrated to their body's real-time state.

---

## Hub Module Architecture

```
AHCS Hub Registry
    │
    ├── HubModule: Diabetic
    │       ├── carbCeiling (dynamic)
    │       ├── giCap (Glycemic Index ceiling)
    │       ├── fiberFloor
    │       └── glucoseStateResponsiveInstructions
    │
    ├── HubModule: GLP-1
    │       ├── portionReduction
    │       ├── nauseaTriggerAvoidance
    │       ├── proteinPreservation
    │       └── recentInjectionAwareness
    │
    ├── HubModule: AntiInflammatory
    │       ├── omegaRatioOptimization
    │       ├── nightshadeRestriction (optional)
    │       ├── processedFoodBlock
    │       └── phytonutrientEmphasis
    │
    └── HubModule: CompetitionPro
            ├── proteinFloor
            ├── cuttingVsBulkingMode
            ├── mealTimingGuidance
            └── coachControlledOverride
```

---

## Inputs

| Input | Source |
|---|---|
| Recent glucose logs | `glucoseLogs` table |
| GLP-1 injection status | `glp1Shots` table |
| Clinical lab values | `clinicalLabs` table |
| Physician-assigned protocols | ProCare assignment |
| Competition prep flag | User profile / Coach assignment |

## Outputs

| Output | Used By |
|---|---|
| Hub-specific `ProtocolPromptBlock` additions | AI generation engine |
| Real-time `Fix Hints` | Post-generation validation |
| Personalized guardrails (carbCeiling, giCap, etc.) | UMGP |
| Hub state indicators | Client UI (GLP-1 tracking dashboard) |

---

## Key Files

| File | Role |
|---|---|
| `server/services/hubCoupling/` | Hub registry and orchestrator |
| `server/services/hubCoupling/hubModules/diabetic.ts` | Diabetic hub module |
| `server/services/hubCoupling/hubModules/glp1.ts` | GLP-1 hub module |
| `server/routes/biometricsRoutes.ts` | Biomarker data intake |
| `server/db/schema/glucoseLogs.ts` | Real-time glucose data |
| `server/db/schema/clinicalLabs.ts` | Lab values integration |

---

## What Makes This Unique

1. **Real-time generation override based on live biomarker state** — the AI's instructions change based on what a user's glucose is right now, not at profile setup
2. **Modular plugin architecture** — new clinical conditions are added as Hub modules, not hardcoded logic. Adding an Oncology Hub, PCOS Hub, or Heart Health Hub requires only a new module file
3. **Multi-Hub activation** — a user can be simultaneously diabetic + on GLP-1 + anti-inflammatory, and all three Hubs activate concurrently with their rules merged without conflict
4. **Coach-controlled override** — within the Pro portal, a coach can adjust Hub parameters for their client (e.g., set a custom carbCeiling above or below the system default)

---

## Integration

- **Reads from**: Biometric Intelligence System (System 6), UP-FEM (System 1)
- **Writes to**: UserProtocolEnvelope, AI prompt blocks
- **Used by**: Unified Meal Generation Pipeline (System 11), ProCare (System 5)
- **Extends**: Oncology Support Protocol (System 12) operates as a specialized hub variant
