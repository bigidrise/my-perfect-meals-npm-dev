# System 12: Oncology Support Protocol (OSP)

**Classification:** Clinical — Physician-Assigned Protocol
**Status:** Active, Production
**Access Control:** Physician-assigned only — not user-selectable

---

## Purpose

The Oncology Support Protocol is a physician-assigned clinical nutrition layer for users undergoing cancer treatment. It enforces a strict set of evidence-based dietary guidelines specific to oncology patients — and it does so at the generation enforcement level, not just the coaching level.

This means:

> A user on oncology support does not receive advice to avoid certain foods. Their AI generation engine *cannot produce* content that violates oncology-safe guidelines.

---

## Critical Design Decision: Assignment vs. Intent

The OSP distinguishes between two distinct concepts that are treated as entirely separate fields:

| Field | Who Sets It | What It Means |
|---|---|---|
| `oncology_support_context` | Physician only (via ProCare) | Clinical assignment — drives enforcement |
| `oncology_support_intent` | User (during onboarding) | Self-reported interest — informational only |

The `oncology_support_intent` field captures that a user *wants* oncology support. The `oncology_support_context` field captures that a physician has *assigned* it. Only the physician-assigned field activates enforcement.

This separation prevents users from self-assigning clinical protocols that require medical oversight.

---

## What OSP Enforces

### Hard-Blocked Ingredients
A curated list of ingredients that are not generated for oncology patients. This includes:
- Raw proteins (raw fish, rare meat, raw eggs)
- Unpasteurized dairy and juices
- High-risk fermented foods
- Specific supplements contraindicated during treatment

### Temperature and Food Safety Guidance
Cooking instructions include specific temperature guidance. Oncology patients are immunocompromised; food safety is clinical, not preferential.

### No Treatment Claims
The system explicitly prevents any AI-generated content from making claims about food's impact on cancer treatment, tumor activity, or cancer outcomes. This is a hard constraint in the prompt engineering layer.

### Nausea and Appetite Adaptation
The generation engine is aware of common treatment side effects (nausea, appetite suppression, taste changes) and adjusts meal character accordingly — gentler textures, milder flavors, smaller portions — without requiring the user to specify this each time.

---

## Architecture

```
Physician assigns oncology_support_context (via ProCare)
    │
    ▼
AHCS Hub Activation
    └── OncologyHub registers with UP-FEM
         │
         ▼
    UP-FEM Layer 1 (Medical) — OSP rules injected
    ├── Hard ingredient blocks added
    ├── Food safety temp guidance added
    ├── Treatment claim block added
    └── Nausea adaptation flag set
         │
         ▼
    AI Generation (constrained by OSP rules)
         │
         ▼
    Post-generation scan includes OSP checklist
```

---

## Key Files

| File | Role |
|---|---|
| `shared/schema.ts` | `oncology_support_context` and `oncology_support_intent` field definitions |
| `server/services/protocolEnvelope.ts` | OSP rule injection |
| `server/routes/procareRoutes.ts` | Physician assignment route |

---

## What Makes This Unique

1. **Physician-only assignment** — the protocol cannot be self-activated, ensuring clinical appropriateness
2. **Intent vs. context separation** — the architecture explicitly distinguishes between what a user wants and what a clinician has prescribed
3. **Hard block at generation level** — unsafe ingredients are blocked at the AI prompt level, not filtered after the fact
4. **No treatment claims enforcement** — explicit guardrail preventing the AI from making oncology outcome claims, which is both ethically critical and legally significant

---

## Integration

- **Assigned via**: ProCare Professional Infrastructure (System 5)
- **Enforced through**: UP-FEM (System 1) — Layer 1 Medical
- **Activated by**: AHCS (System 2) — as a specialized Hub variant
- **Operates with**: All generation engines via UMGP (System 11)

---

## Environment Control

The OSP system-level feature is controlled by the environment variable:

```
ONCOLOGY_SUPPORT_V1=active (default — feature enabled)
ONCOLOGY_SUPPORT_V1=off   (feature disabled for specific deployments)
```

This allows the feature to be disabled for deployments where the clinical context is not appropriate without code changes.
