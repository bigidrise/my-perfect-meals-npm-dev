# Product Evolution Ledger

This document tracks the evolution of My Perfect Meals features, including deferred capabilities and future roadmap items.

## Clinical Advisory System V1.0

**Status:** IMPLEMENTED  
**Date:** January 2026

### Active Conditions (V1 - LOCKED)

The following metabolic and hormonal considerations are currently implemented and active:

| Condition | Protein Delta | Carb Delta | Fat Delta | Status |
|-----------|---------------|------------|-----------|--------|
| Menopause / Hormone Therapy | +10% | -5% | +5% | ACTIVE |
| Suspected Insulin Resistance | +5% | -15% | +5% | ACTIVE |
| High Stress / Poor Sleep | +5% | 0% | 0% | ACTIVE |

### Deferred Conditions

The following conditions are documented but **NOT YET IMPLEMENTED**. They require more nuanced macro adjustment logic and clinical validation before deployment:

| Condition | Reason Deferred | Target Version |
|-----------|-----------------|----------------|
| Post-Hysterectomy | Requires nuanced hormone-specific adjustments beyond simple macro percentages. Needs clinical review for different HRT protocols. | V2.0 |
| Dyslipidemia | Requires lipid panel integration and triglyceride-specific carb/fat ratios. Complex interaction with cardiac conditions. | V2.0 |

### Implementation Notes

1. **Macro Calculator (User-facing):** Users can toggle advisory conditions in the "Metabolic & Hormonal Considerations" section. Changes require explicit confirmation via "Preview Changes" → "Apply" flow.

2. **ProCare Dashboard (Clinician-facing):** Clinicians access the same conditions via "Clinical Advisory" collapsible. Includes Stage → Apply workflow with audit logging.

3. **No Auto-Application:** Both user and clinician flows require explicit confirmation before macro targets are modified.

---

## Hub Coupling Framework V1.0

**Status:** IMPLEMENTED  
**Date:** 2025

### Active Hub Modules

| Hub Type | Purpose | Key Guardrails |
|----------|---------|----------------|
| Diabetic | Blood sugar management | Carb ceiling, GI limits, blocked sugars |
| GLP-1 | Medication support | Small portions, low fat, easy digestion |
| Anti-Inflammatory | Reduce inflammation | Ingredient bans, cooking method restrictions |
| Competition Pro | Bodybuilding prep | Protein floor, carb ceiling |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 2026 | Initial Clinical Advisory with 3 conditions |
| 0.9 | Dec 2025 | Hub Coupling Framework with 4 modules |
