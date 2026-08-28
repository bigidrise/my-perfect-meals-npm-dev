# Research Notes: Hydration Formula & Numeric Safety Policy

**Status:** complete
**Depth:** Standard

## Plan

- **Question:** What evidence-backed numeric Hydration policy can My Perfect Meals safely propose for approval, and when must it produce no number?
- **Scope:** Healthy-adult baseline, context adjustments, clinician-defined values, specialized populations, withholding rules, evidence governance, and future Resources provenance. No engine or UI implementation.
- **Audience:** Product owner, clinical reviewers, product safety, and implementing engineers.
- **Deliverable:** One proposed versioned policy, structured source registry, explicit approval decisions, and implementation-ready acceptance criteria.

## Focus Areas

| # | Area | Status | Sources |
|---|---|---|---|
| 1 | Healthy-adult baseline and formula methodology | done | 7 |
| 2 | Exercise, heat, sweat loss, altitude, and overhydration | done | 7 |
| 3 | Pediatrics, pregnancy/lactation, and older adults | done | 6 |
| 4 | Renal, cardiac, liver, and clinician-defined restrictions | done | 7 |
| 5 | GLP-1/GI losses, fever, bariatric care, POTS, and electrolytes | done | 7 |

## Coverage Checklist

- [x] Automatic baseline: none in v0.1; population references are not individual water targets. [@national-academies-2005] [@efsa-nda-2010]
- [x] Weight-only and population-reference formulas rejected for v0.1. [@dolci-et-al-2022]
- [x] Total water, beverages, logged water, and hydration contribution remain distinct.
- [x] Automatic context adjustments: none in v0.1. [@nata-2017] [@eah-consensus-2015]
- [x] Specialized and acute contexts produce no automatic number.
- [x] Current authorized clinician point/range/floor/ceiling/timing semantics are preserved without conversion.
- [x] Overhydration, hyponatremia, acute loss, and electrolytes suppress routine numeric planning. [@eah-consensus-2015] [@who-oral-rehydration-salts]
- [x] Evidence records, versioning, review, rollback, and Resources eligibility are defined.

## Findings Log

_Source markers are added after the source registry is merged._

### Healthy-adult baseline and formula methodology

- NASEM and EFSA values describe population total water, including food and beverages, not an individual plain-water target. [@national-academies-2005] [@efsa-nda-2010]
- A water-only remaining calculation cannot subtract `water_logs` from a total-water reference.
- Available personalization research does not validate a universal weight-only multiplier. [@dolci-et-al-2022]

### Exercise, heat, sweat loss, altitude, and overhydration

- Exercise replacement is individual and can create overdrinking/hyponatremia risk; no automatic delta is approved. [@nata-2017] [@eah-consensus-2015]
- Occupational heat guidance supports behavior and workplace controls, not conversion into a general daily target. [@osha-heat-water-rest-shade]

### Pediatrics, pregnancy/lactation, and older adults

- Population references vary by age and life stage but do not authorize automatic personalized values. [@national-academies-iom-2005] [@efsa-2010]
- Older-adult heat vulnerability supports withholding automatic adjustments when risk context is present. [@nia-2022]

### Renal, cardiac, liver, and clinician-defined restrictions

- Kidney, heart-failure, and ascites management require disease-specific clinical authority, not a generic increase. [@kdigo-2020-dialysis] [@aha-acc-hfsa-2022-heart-failure] [@aasld-2021-ascites]
- Numeric clinician directives must retain point/range/floor/ceiling/timing semantics, review, expiry, and provenance.

### GLP-1/GI losses, fever, bariatric care, POTS, and electrolytes

- GLP-1 volume-depletion risk, acute GI losses, bariatric stages, and POTS are treatment/protocol contexts, not baseline adjustments. [@fda-ozempic-2025] [@niddk-viral-gastroenteritis] [@asmbs-life-after-bariatric] [@vernino-pots-2021]
- ORS and electrolyte guidance are excluded from the routine daily target. [@who-oral-rehydration-salts]

## Conflicts & Open Questions

- National Academies and EFSA reference values differ; v0.1 resolves the conflict by treating both as educational total-water references only.
- Weight-based conventions lack sufficient support for an automatic consumer target; v0.1 rejects them.
- Exercise guidance requires individualized measured inputs and overdrinking controls; v0.1 approves no automatic adjustment.
- Specialized populations may have reference values, but v0.1 permits numeric output only from a current compatible clinician directive.

## Gaps

- The evidence does not support a universal automatic water target from the existing water-only ledger.
- Future healthy-adult or measured-exercise formulas require a separate approved policy version; this is an explicit limitation, not a hidden fallback.