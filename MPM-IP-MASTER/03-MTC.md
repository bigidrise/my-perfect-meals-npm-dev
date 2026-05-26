# System 03: Macro Truth Contract (MTC)

**Classification:** Data Integrity — AI Output Validation
**Status:** Active, Production
**Version:** v1.0

---

## Purpose

The Macro Truth Contract is an integrity enforcement layer that governs all macro-nutritional data in AI-generated meals. It exists to solve a fundamental problem with AI nutrition systems:

> **AI models fabricate macro values. They confidently generate numbers that are internally inconsistent, physiologically implausible, or simply invented.**

MTC enforces a strict contract:

- Macro values are either **known** (sourced from a verifiable calculation) or **null** (acknowledged as unknown)
- **Zero is never a placeholder** — `0g protein` means the system knows there is no protein, not that it hasn't been calculated
- **Null is never fabricated** — missing data is surfaced as missing, not silently filled
- Macro values are **never mutated** — if a value fails validation, the meal is regenerated, not edited

---

## The Contract Rules

### Rule 1: Null Means Unknown, Not Zero
If the system cannot calculate a macro value with confidence, that field is `null`. The UI surfaces this as "—" or "Not calculated," not as 0.

### Rule 2: Zero Means Verified Zero
If a macro field is `0`, it means the system has verified that value is correct (e.g., a water beverage has 0 calories). Zero is never used as a default or placeholder.

### Rule 3: No Mutation — Regenerate or Reject
If post-generation validation detects that a macro value is implausible (e.g., a 500-calorie meal with 45g protein, 60g carbs, and 40g fat — which would be ~760 calories), the meal is rejected and regenerated. The value is never "corrected" by the system.

### Rule 4: Diet-Type Injection Block
For certain diet types (e.g., raw food, fasting protocols), macro injection into the AI prompt is blocked entirely because the model cannot reliably calculate macros for those cases. The system acknowledges the limitation rather than inventing numbers.

### Rule 5: Source Attribution
Every macro value carries a source tag — whether it came from the AI's generation, a manual entry, a barcode scan, or a database lookup. Source integrity is preserved in the data layer.

---

## How It Works

```
AI Output Received
    │
    ▼
MTC Validator
    ├── Parse macro fields (protein, carbs, fat, calories)
    ├── Check internal consistency (cals ≈ (p×4) + (c×4) + (f×9))
    ├── Check physiological plausibility (range checks per meal type)
    ├── Check for fabrication markers (suspiciously round numbers)
    └── Check diet-type injection block status
         │
    ┌────┴────┐
  PASS      FAIL
    │          │
    │          └── Flag violation → Regenerate (max 2 retries)
    │               │
    │          Still FAIL → Return null values + telemetry log
    ▼
  Macro values committed to DB with source tag
```

---

## Inputs

| Input | Source |
|---|---|
| AI-generated meal object | Generation pipeline output |
| Diet type flags | UserProtocolEnvelope |
| Meal type category | Generation request |
| Historical macro patterns (for plausibility) | User meal log |

## Outputs

| Output | Used By |
|---|---|
| Validated macro object (or nulls) | Meal card display |
| Violation flag + regeneration trigger | Generation pipeline |
| Source-tagged macro record | Database, audit trail |
| Telemetry entry | AI quality monitoring |

---

## Key Files

| File | Role |
|---|---|
| `server/services/guardrails/macroTruthContract.ts` | Core contract enforcement |
| `server/services/unifiedMealPipeline.ts` | Integration point |
| `server/services/aiTelemetry.ts` | Violation logging |
| `shared/schema.ts` | Macro field definitions with null handling |

---

## What Makes This Unique

1. **Explicit null semantics** — most nutrition apps treat null and zero as interchangeable. MTC treats them as fundamentally different states with different UI implications.
2. **Regeneration-first integrity** — the system never patches or mutates AI output. It rejects and regenerates, maintaining the integrity of the generation chain.
3. **Fabrication detection** — the plausibility checks are tuned to catch the specific patterns of AI macro fabrication (over-round numbers, impossible caloric math)
4. **Diet-type awareness** — rather than generating plausible-sounding but unverifiable macro values for edge-case diets, the system blocks the attempt and surfaces the limitation honestly

---

## Why This Matters for IP

The macro fabrication problem is unsolved across the AI nutrition space. Apps that use AI to generate nutrition data either:
- Display AI-generated numbers as fact (dangerous for clinical users)
- Strip macro data entirely (limiting)
- Allow users to manually edit (shifts burden to user)

MTC represents a third path: **enforced integrity with honest uncertainty signaling**. This is architecturally significant and has direct clinical safety implications.

---

## Integration

- **Called by**: All generation engines after AI output is received
- **Reads from**: UserProtocolEnvelope (for diet-type block rules)
- **Writes to**: Meal database, telemetry
- **Works alongside**: UP-FEM post-generation scan (System 1)
