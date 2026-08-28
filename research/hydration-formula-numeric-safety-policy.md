# My Perfect Meals Hydration Formula & Numeric Safety Policy

**Policy version:** `MPM-HYDRATION-NUMERIC-POLICY-v0.1-PROPOSED`  
**Status:** Proposed; inactive until required governance approval and activation-gate amendment  
**Research date:** August 27, 2026  
**Evidence registry:** `research/sources.json`

## Approval decision

Approve the following conservative v0.1 policy:

1. Keep `water_logs` as the active canonical intake source through the existing read-through bridge.
2. Do not derive an individual drinking-water target from population total-water references or a weight-only formula.
3. A separate numeric-policy service may calculate remaining water only when the completed eligibility gate returns `PLAN_ELIGIBLE` **and** a current, authorized numeric clinician directive has survived the existing modifier resolver.
4. For everyone else, the Hydration Center may show logged water intake and nonnumeric education, but no target, remaining amount, completion percentage, or “goal met” statement.
5. Do not add automatic exercise, heat, sweat, altitude, pregnancy, illness, medication, sodium, or electrolyte adjustments in v0.1.

This is the fastest policy supported by the reviewed evidence that can support a useful Hydration Center without turning a population reference into an individualized prescription. Approval of this proposal satisfies the numeric-policy decision only. It does not supersede `docs/DAILY_HYDRATION_IMPLEMENTATION_GATE_REVIEW.md`, start Task #1472, activate clinician-directive workflows, authorize consumer language, or permit a user-facing Hydration Center.

## Why the baseline is not an automatic number

The National Academies’ Adequate Intake values are population-level **total water** references: drinking water, other beverages, and food moisture. The commonly quoted adult values—3.7 L/day for males and 2.7 L/day for females—are not plain-water prescriptions or values designed to be subtracted from a water log. The report also describes wide normal variation and bases the values largely on observed intake. [National Academies, 2005](https://nap.nationalacademies.org/read/10925/chapter/6)

EFSA likewise defines adult references as **total water** under moderate environmental temperature and activity, with values of 2.5 L/day for males and 2.0 L/day for females. Its methodology and population differ from the National Academies’ methodology and population. [EFSA NDA Panel, 2010](https://www.efsa.europa.eu/en/efsajournal/pub/1459)

Neither authority validates this calculation:

```text
population total-water reference − logged plain water = individual water remaining
```

Food moisture and non-water beverages are not fixed percentages for an individual. The active MPM ledger currently records water, not total water from all food and beverages. A weight-only `mL/kg` formula is also rejected for v0.1: it is not the method used for the population Adequate Intakes, and available personalization research uses multiple clinical and environmental inputs rather than validating a universal weight multiplier. [Dolci et al., 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9669042/)

Population values may appear on the Resources page as educational references, clearly labeled “total water, including food and beverages.” They must not appear as the user’s target.

## Numeric authorization

`PLAN_ELIGIBLE` remains a necessary but insufficient condition. The completed eligibility gate stays unchanged and continues to return:

```text
numericPlanningPermission: "disabled"
```

The later numeric-policy layer may authorize a number only when all of these are true:

- eligibility outcome is `PLAN_ELIGIBLE`;
- the existing resolver reports no block or unresolved review state;
- a current numeric directive exists with source `clinician_directive`;
- the authenticated viewer is the subject or has valid delegated ProCare access;
- the directive’s author, scope, semantic kind, unit, effective time, expiration/review time, and provenance are complete;
- the directive is bound to the current policy manifest and intake snapshot;
- no higher-authority or same-scope conflict remains.

A self-reported condition, user preference, population reference, model output, analytics threshold, or old browser goal cannot authorize numeric planning.

## Permitted numeric semantics

Every authorized value retains its original semantic kind. The system must not convert one kind into another.

| Kind | Meaning | Permitted display |
|---|---|---|
| `point` | Current clinician-defined daily water target | Consumed and remaining to target |
| `range` | Current clinician-defined acceptable daily water range | Amount to minimum and headroom to maximum |
| `floor` | Current clinician-defined minimum | Amount remaining to floor; never imply that the floor is an optimum |
| `ceiling` | Current clinician-defined maximum or restriction | Headroom to ceiling; never present the ceiling as a goal |
| `timing_block` | Water is restricted during a defined interval | Restriction state and approved explanation; no catch-up instruction |
| `monitor_only` | Intake may be tracked but no number is authorized | Logged intake only |

## Exact v0.1 arithmetic

The numeric engine may perform only the following arithmetic after authorization:

```text
consumedWaterMl =
  sum of active canonical water events for the subject and local date

remainingToPointMl =
  max(0, pointTargetMl − consumedWaterMl)

remainingToFloorMl =
  max(0, floorMl − consumedWaterMl)

remainingToRangeMinimumMl =
  max(0, rangeMinimumMl − consumedWaterMl)

headroomToRangeMaximumMl =
  max(0, rangeMaximumMl − consumedWaterMl)

headroomToCeilingMl =
  max(0, ceilingMl − consumedWaterMl)
```

Rules:

- Corrected and voided `water_logs` changes must immediately change the projection.
- Results use the subject’s governed local date and timezone.
- Negative remaining/headroom values display as zero plus an explicit over-target or above-ceiling state where policy permits; the UI must not recommend compensatory restriction, bolus drinking, or “catch-up.”
- A range is never collapsed to its midpoint.
- A ceiling is never copied into a target field.
- No event timing plan, per-hour amount, bolus, sodium amount, or electrolyte amount is calculated.
- Unknown contribution remains unknown. v0.1 counts canonical water only.

## No-number states

The system returns no target, remaining value, progress percentage, or “goal met” statement when any of the following applies without a current compatible clinician directive:

| Context | v0.1 behavior |
|---|---|
| No current numeric clinician directive | Logged water and nonnumeric education only |
| Child or adolescent | No automatic number; pediatric guidance is age- and context-specific |
| Pregnancy or lactation | No automatic number; population references are educational only |
| Frailty, impaired thirst, cognitive impairment, or older-adult heat vulnerability | No automatic number; prompt for care-plan guidance |
| Kidney disease, dialysis, transplant fluid plan, or electrolyte disorder | Withhold automatic number; clinician plan controls |
| Heart failure, edema, cardiac fluid restriction, or diuretic-sensitive plan | Withhold automatic number; clinician plan controls |
| Cirrhosis, ascites, or liver-related fluid/sodium restriction | Withhold automatic number; clinician plan controls |
| POTS or other dysautonomia | Context only unless a compatible clinician directive exists |
| Bariatric surgery or unknown postoperative stage | Protocol-specific; no generic number |
| GLP-1 treatment with persistent nausea, vomiting, diarrhea, or poor intake | No routine number; show approved escalation guidance |
| Vomiting, diarrhea, fever, inability to keep fluids down, or suspected acute dehydration | Exit daily planning; acute care/ORS guidance belongs to clinicians or authoritative public-health instructions |
| Exercise, occupational heat, measured or unmeasured sweat loss, or altitude | No automatic adjustment in v0.1 |
| Fluid/sodium/electrolyte restriction or unresolved modifier conflict | `PLAN_WITHHELD` or `NEEDS_REVIEW`; no number |
| Stale, partial, tampered, cross-subject, or unavailable intake snapshot | `NEEDS_REVIEW`; no number |
| Missing authorization, registry provenance, policy version, or directive expiry | `NEEDS_REVIEW`; no number |

These exclusions follow the evidence that exercise replacement must be individualized and excessive drinking can contribute to exercise-associated hyponatremia. [NATA Position Statement](https://pmc.ncbi.nlm.nih.gov/articles/PMC5634236/) [Third International EAH Consensus Statement](https://bjsm.bmj.com/content/49/22/1432)

Kidney, heart-failure, and ascites guidance likewise requires disease- and treatment-specific clinical management rather than a generic hydration increase. [KDIGO Dialysis Volume Consensus](https://kdigo.org/wp-content/uploads/2017/05/KDIGO-BP-Volume-in-Dialysis-FINAL.pdf) [2022 AHA/ACC/HFSA Heart Failure Guideline](https://professional.heart.org/en/science-news/-/media/832EA0F4E73948848612F228F7FA2D35.ashx) [AASLD Ascites Guidance](https://www.aasld.org/practice-guidelines/diagnosis-evaluation-and-management-ascites-spontaneous-bacterial-peritonitis)

For GLP-1 users, persistent gastrointestinal adverse effects can be associated with volume depletion and kidney injury; the app must not answer that risk with an automated catch-up volume. [FDA Ozempic Prescribing Information, 2025](https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/209637s025lbl.pdf)

Acute diarrheal illness and oral rehydration therapy are treatment contexts, not extensions of a daily wellness target. [NIDDK](https://www.niddk.nih.gov/health-information/digestive-diseases/viral-gastroenteritis/treatment) [WHO Oral Rehydration Salts](https://www.who.int/publications/i/item/WHO-FCH-CAH-06.1)

## Context adjustments

v0.1 approves **no automatic numeric context adjustment**.

Exercise, heat, sweat rate, altitude, fever, GI losses, pregnancy/lactation, GLP-1 intolerance, bariatric stage, POTS, medications, caffeine, alcohol, sodium, and electrolytes may contribute nonnumeric context or trigger withholding. They do not produce a delta.

A future adjustment policy must separately approve:

- measured input and device/source quality;
- population and contraindications;
- formula, units, bounds, and timing window;
- interaction with point/range/floor/ceiling semantics;
- overhydration and hyponatremia controls;
- stale-data behavior;
- clinical and product owner;
- explanation language;
- policy version, expiry, rollback, and tests.

## Clinician authority

Clinician-defined numbers are externally authoritative inputs, not outputs of the generic formula. Each directive must include:

- subject and authorized clinician identity;
- active professional relationship and permitted scope;
- kind: point, range, floor, ceiling, or timing block;
- metric and unit;
- effective time, timezone, review date, and expiration;
- rationale and source reference;
- policy/version manifest;
- audit record and supersession lineage.

An expired directive is not silently extended. A changed directive creates a new effective-dated revision. Conflicting current directives produce review or blocking, never averaging or registration-order selection.

## Intake accounting

v0.1 uses the existing canonical projection from `water_logs`:

- plain water events count at their recorded normalized volume;
- corrections and voids retain lineage and immediately affect the current projection;
- food moisture is not estimated;
- coffee, tea, milk, juice, alcohol, recipes, and unknown beverages are not silently converted into water;
- sodium, potassium, magnesium, and other electrolyte values remain separate and unknown unless an approved future accounting policy exists.

This avoids presenting incomplete beverage or food coverage as zero.

## Safety and escalation

The Hydration Center is not an acute-care calculator. Approved red-flag states suppress numeric planning and show reviewed escalation language. These include inability to keep fluids down, fainting or confusion, severe or worsening symptoms, bloody stool, chest pain, severe shortness of breath, new neurologic symptoms, and other care-team-defined red flags.

The product must not:

- diagnose dehydration, overhydration, POTS subtype, kidney injury, heart failure, or electrolyte imbalance;
- prescribe oral rehydration, sodium, electrolytes, IV fluids, medication changes, or bolus drinking;
- interpret a generic reference as individualized care;
- let an LLM select, alter, or override a number;
- let a user preference override a restriction or clinician directive.

## Versioning, expiry, and rollback

This proposal is inactive until the required governance owners approve it and the controlling activation gate records the approval. Product-owner acceptance records direction but does not alone create an active clinical policy.

Every active numeric decision records:

- numeric policy version;
- eligibility policy version;
- resolver/registry policy versions;
- clinician directive and revision IDs;
- intake snapshot hash;
- calculation timestamp and local date;
- reason and explanation codes.

Policy activation must be feature-gated. Revocation or expiry immediately returns the product to monitor-only behavior; it must not fall back to a previous formula or cached number. Historical views retain the policy and directive versions that governed them.

## Structured evidence record contract

Every relied-on source is stored in `research/sources.json` with:

- stable source key;
- source title;
- organization or author;
- publication date;
- URL and full citation;
- saved evidence path;
- evidence tier and evidence level;
- population scope;
- exact policy rule supported;
- Hydration policy version informed;
- approval status.

The registry is the future Resources-page source of truth. Resources must show only approved records applicable to an active or historical policy. Draft, rejected, expired, or superseded records must not be presented as current support.

## One implementation milestone after gate authorization

After this numeric policy is approved **and** the controlling activation gate is explicitly amended/opened with its required clinical-policy, professional-access/audit, user-language, feature-gate, cutover, and rollback approvals, implementation should be compressed into one combined milestone:

1. Add a numeric-policy service after eligibility and the existing resolver; do not change eligibility ownership.
2. Implement only the clinician-authorized arithmetic defined above.
3. Connect the service to the canonical `water_logs` projection.
4. Build Hydration Center states for logged intake, clinician-authorized progress, monitor-only, withheld, review, unavailable, and red-flag escalation.
5. Surface approved evidence records on Resources.
6. Register Hydration in the App Library with description, purpose, supported uses, safety boundaries, and Hydration Center link.
7. Keep all future automatic baselines, context deltas, electrolyte calculations, weather, wearables, and LLM numeric decisions disabled.

## Implementation acceptance criteria

- Existing eligibility behavior remains unchanged.
- Numeric output requires both `PLAN_ELIGIBLE` and a valid current clinician directive.
- No target or remaining field exists in monitor-only/withheld/review/unavailable results.
- Every numeric result carries directive, policy, resolver, and intake provenance.
- Point, range, floor, ceiling, and timing-block semantics have separate tests.
- Cross-subject, unauthorized, expired, stale, tampered, conflicting, and missing-provenance inputs fail closed.
- Corrections and deletions in `water_logs` immediately change current consumed/remaining values.
- No automatic population baseline, weight formula, exercise delta, heat delta, illness replacement, sodium target, or electrolyte target is present.
- Resources reads approved evidence records rather than a duplicate list.
- App Library availability matches Hydration activation and safety state.
- Production and development route behavior is identical.

## Explicit exclusions

Approval does not authorize:

- a universal healthy-adult target;
- a body-weight formula;
- pediatric, pregnancy/lactation, older-adult, bariatric, POTS, renal, cardiac, liver, GLP-1, fever, or GI-loss formulas;
- exercise, sweat-rate, heat, weather, altitude, or wearable adjustments;
- sodium or electrolyte quantities;
- oral rehydration treatment;
- acute dehydration diagnosis;
- LLM numeric selection;
- migration away from `water_logs`;
- activation without feature gating, tests, review, and rollback.

## Approval and activation record

**Decision requested:** Approve or reject `MPM-HYDRATION-NUMERIC-POLICY-v0.1-PROPOSED`.

**If product direction is approved:** Record the decision in the existing Hydration governance matrix. The policy remains inactive until the required clinical, professional-governance, privacy/security, product-safety, and consumer-language owners are recorded with effective scope/date, review/expiry, feature-gate, rollback, and cutover authorization.

**When the controlling activation gate is opened:** Replit may build the one combined Hydration implementation milestone described above. No extra decomposition into separate engine, remaining-water, UI, Resources, or App Library projects is required.

**If rejected:** Numeric permission remains disabled. Any future monitor-only Hydration Center still requires separate authorization under the controlling activation gate.

## Sources

The complete machine-readable registry contains every source consulted and the rule each source supports: `research/sources.json`.