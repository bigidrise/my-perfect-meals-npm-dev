# Daily Hydration Plan — Governance Decision Matrix

**Status:** Clinician-defined numeric v0.1 is product-approved for development implementation. Production clinical activation remains blocked.

**Companion documents:**

- `docs/DAILY_HYDRATION_PLAN_ARCHITECTURE.md`
- `docs/DAILY_HYDRATION_IMPLEMENTATION_GATE_REVIEW.md`
- `docs/POTS_INTEGRATION_DIAGNOSTIC.md`

## Recorded product-owner direction

On 2026-08-21, the product owner approved the nonclinical platform requirements expressed in Group A: one server-authoritative domain; immutable factual history; original-unit, timestamp, timezone, and provenance preservation; explicit unknowns; distinct volume, contribution, and nutrient semantics; typed plan states; non-averaging conflict handling; authenticated ownership; auditable ProCare access; historical revisions; legacy `water_logs` preservation; lossless reversible migration; no silent browser-data import; and feature-disabled Phase 1 infrastructure.

This records product direction only. It does **not** approve a clinical target, condition policy, electrolyte claim, professional role scope, retention policy, or activation behavior. Those decisions remain subject to their named owners and the activation gate below.

On 2026-08-27, the product owner approved `MPM-HYDRATION-NUMERIC-POLICY-v0.1` with the explicit decision “Approve clinician-defined numeric v0.1.” The authorized scope is development implementation and verification of point, range, floor, and ceiling directives only. This approval has no production activation effect.

## Current controlling gate

`docs/DAILY_HYDRATION_IMPLEMENTATION_GATE_REVIEW.md` is the sole controlling implementation gate. Its staged Foundation gate has passed Checkpoint Zero; its Activation gate remains closed. Therefore:

- development implementation and verification of the approved clinician-defined v0.1 milestone is authorized;
- production numeric planning, professional directive workflows, consumer cutover, and production Hydration UI remain inactive;
- no automatic baseline, weight-only formula, context delta, electrolyte quantity, or LLM-selected number is authorized;
- `water_logs` remains the only editable intake ledger.

This matrix and the implementation-gate review now use the same two-stage authorization model. The Foundation gate does not replace the Activation gate.

### Controlling staged authorization model

1. **Foundation gate:** Checkpoint Zero is passed. Once Task #1472 is explicitly started, this authorizes only non-activating, server-side infrastructure: typed contracts, append-only storage, audit records, immutable revisions, state projection, feature-disabled routes, and resolver harnesses that can return only `monitor_only`, `needs_review`, or `blocked`.
2. **Activation gate:** remains closed until the relevant Group B decision is approved, including its owner, policy/version, effective date, scope, explanation language, and applicable migration/cutover evidence. This authorizes only that policy or consumer behavior.

Foundation approval never authorizes a fluid target, range, floor, ceiling, timing instruction, electrolyte recommendation, clinician directive workflow, consumer cutover, or UI change.

## Group A — decisions required before backend foundation work

| ID | Decision | Safe default pending approval | Required approval owner(s) | Foundation authorization affected |
| --- | --- | --- | --- | --- |
| A1 | Canonical intake-event meaning | Retain declared beverage volume as a fact. Preserve legacy `water_logs` as `legacy_manual` water. Do not infer food water, beverage contribution, or clinical meaning. | Product/data owner; clinical governance | Event schema and future lossless backfill |
| A2 | Contribution and unknown-data semantics | Volume, hydration contribution, and nutrient data remain distinct. Contribution is `unknown` unless a declared, versioned method supports it. | Product safety; clinical governance; engineering | Contribution/state contracts |
| A3 | Electrolyte data provenance and coverage | Store only declared or validated nutrient values with source and confidence. Unknown stays `not_tracked`, `water_only`, or `partial`, never zero. | Clinical governance; product safety; engineering | Nutrient provenance and coverage contracts |
| A4 | Authority and restriction types | Keep point, range, floor, ceiling, timing block, and `monitor_only` as separate typed semantics. A ceiling is never an encouragement target. | Clinical governance; product safety; engineering | Plan/restriction contract |
| A5 | Conflict and fail-safe behavior | Incompatible hard claims return `needs_review` or `blocked`; no registration-order, averaging, or fallback target is permitted. | Clinical governance; product safety | Resolver harness |
| A6 | User preference boundary | A user setting is only a preference proposal and cannot override a hard restriction, clinician directive, `needs_review`, or `blocked` outcome. | Product owner; clinical governance | Baseline/preference contract |
| A7 | Clinician and ProCare access boundary | Deny by default. Self-service identity derives from authentication. Any professional selector requires an active relationship, organization isolation, approved role scope, consent, and audit. | ProCare governance; privacy/security; clinical governance | Role-scoped projections and audit |
| A8 | Event integrity and local-date rules | Preserve original amount/unit, normalized mL, occurrence time, timezone, idempotency, correction/void lineage, and validation rules. | Product/data owner; engineering | Event service and state projection |
| A9 | Revision and historical-state semantics | Plan revisions are immutable. Mid-day changes supersede forward only; events and earlier intervals remain unchanged and explainable by their original policy manifest. | Product/data owner; clinical governance; engineering | Revision/state contracts |
| A10 | Sensitive-data, retention, and audit scope | Define audit actions for corrections, voids, professional reads, denied access, and future directive changes. Classify hydration, symptoms, medication, clinician, and electrolyte data for retention, export, deletion, and access. | Privacy/compliance; ProCare; security | Audit and data-governance design |
| A11 | Legacy migration, shadow, parity, and rollback | Preserve `water_logs`; require lossless/repeatable backfill, non-inference, parity measurement, rollback ownership, and explicit confirmation before a client-only total becomes an event. | Product/data owner; engineering | Backfill and shadow-readiness work |
| A12 | Plan validity and resolution provenance | A resolver result is not valid merely because it returned a value. Every effective plan identifies its authority, contributing inputs, policy versions, provenance, and resolution status. Incomplete, stale, contradictory, or unauthorized inputs may return only `needs_review` or `blocked`, never a hydration number. | Product safety; clinical governance; engineering | Plan/state/provenance contract |
| A13 | Foundation exclusion enforcement | Keep all foundation work feature-disabled and prohibit UI, recommendation, consumer, clinician-directive, electrolyte-calculator, and local-storage cutover changes. | Product owner; clinical governance; engineering | Feature-flag and rollout boundary |

### Group A approval statement

Before the proposed foundation gate could open, the named owners must affirm all of the following:

- uncertainty is preserved rather than converted into a clinical value;
- identity, access, audit, revisions, and historical behavior follow the Group A rows;
- legacy data is migrated only as factual water events, not inferred clinical history;
- a technically successful calculation cannot bypass plan-validity, provenance, or resolution-status requirements;
- all Phase 1 exclusions remain enforced.

## Group B — decisions that may remain clinically inactive during foundation work

The following rows cannot activate an applicable rule, target, action, directive, or consumer behavior until their own approval is recorded. They are not currently authorized because the controlling implementation gate has not been amended or approved.

| ID | Decision | Inactive default | Required approver(s) | Activation blocked until |
| --- | --- | --- | --- | --- |
| B1 | Baseline daily hydration policy | `monitor_only`; no target, range, floor, ceiling, or remaining calculation. | Physician/clinical governance; dietitian/nutrition governance; product safety | Evidence, population, formula, caps, review cadence, and permitted explanation language are approved. |
| B2 | Body-size inputs | Store only optional provenance; do not derive a target from weight, height, or body composition. | Clinical governance; dietitian/nutrition governance | Formula, units, eligible population, validation, and review policy are approved. |
| B3 | Activity and performance modifier | Capture context only; do not change fluid or electrolyte values. | Clinical governance; performance owner; dietitian/nutrition governance | Inputs, timing, caps, conflicts, and language are approved. |
| B4 | Climate, heat, or wearable modifier | No automatic adjustment and no unapproved location/wearable ingestion. | Product/privacy; clinical governance | Consent, source quality, data handling, and adjustment policy are approved. |
| B5 | Pregnancy modifier | Preserve context only; do not change a target or repeat fixed glass guidance as an individualized plan. | Clinical governance; dietitian/nutrition governance | Approved pregnancy policy or clinician directive scope exists. |
| B6 | GLP-1 modifier | Existing GLP-1 behavior remains unchanged; it may be represented only as a future typed observation or overlay candidate. | Clinical governance | Approved hydration-specific safety policy and interaction rules exist. |
| B7 | POTS/dysautonomia modifier | No fluid or sodium rule, target, or automatic modification. | Physician/clinical governance; legal/compliance | Presentation-specific policy, contraindications, clinician requirements, and audit scope are approved. |
| B8 | Renal, cardiac, liver, oncology, and fluid-restriction policy | No numeric rule. An approved hard restriction may only be represented as a typed claim under Group A conflict behavior. | Physician/clinical governance | Condition policy, escalation, and conflict precedence are approved. |
| B9 | Caffeine and alcohol treatment | Preserve declared classification/nutrients when available; do not estimate contribution or give a hydration recommendation. | Clinical governance; dietitian/nutrition governance | Approved accounting, contribution, and user-language rules exist. |
| B10 | Electrolyte target or limit | No numeric electrolyte target, limit, replacement claim, or recommendation. | Clinical governance; dietitian/nutrition governance; product safety | Data-source, coverage, target/limit, contraindication, and claim semantics are approved. |
| B11 | Clinician directive activation | No professional read/write endpoint or directive can be activated. | ProCare governance; clinical governance; privacy/compliance | Role scope, consent, review/expiry, directive types, and audit procedures are approved. |
| B12 | Consumer language and cutover | No target, remaining, “goal met,” dehydration, or action language is published by Biometrics, Coach, Beverage Creator, ProCare, or generators. | Product safety; clinical governance; legal/compliance | Approved language, scoped projection, migration threshold, shadow duration, rollback trigger, and support plan exist. |

## Section 10 checklist coverage

| Section 10 requirement | Matrix decision(s) | What approval authorizes |
| --- | --- | --- |
| Service is the sole source of truth | A4, A5, A9, A12, A13 | One server-owned contract and no competing authoritative calculator. |
| Snapshot/revision/history contract | A8, A9, A12 | Immutable event/revision/state design, validity status, and historical provenance. |
| Baseline and modifier policy owners are named | B1–B8 | Named accountable owners for each inactive policy family; not target activation. |
| Clinical conflict precedence and escalation policy | A4, A5, A12, B5–B8 | Fail-safe foundation semantics; policy-specific precedence activates only with the relevant Group B approval. |
| Clinician/ProCare permissions and audit scope | A7, A10, B11 | Access/audit model; professional behavior only after B11 activation approval. |
| Electrolyte data and claim semantics | A3, B10 | Unknown-data/provenance storage; targets, limits, and claims only after B10 approval. |
| Migration, shadow, parity, and rollback criteria | A11, B12 | Migration design; consumer cutover only after B12 criteria are approved. |
| Phase 1 exclusions remain in place | A13 | Continued feature-disabled, non-user-facing foundation boundary. |

## Approval record template

Each approval or rejection must be recorded with:

```text
Matrix row:
Status: proposed | approved | rejected | superseded
Decision owner:
Required reviewers:
Decision and rationale:
Evidence reviewed:
Policy/version identifier (if applicable):
Effective date:
Review/expiry date:
Authorized scope:
Explicit exclusions:
Rollback or revocation trigger:
```

## Checkpoint Zero record

**Recorded:** 2026-08-21
**Result:** **CHECKPOINT ZERO PASSED — READY TO IMPLEMENT PHASE 1**

The following safeguards are now controlling implementation requirements:

- `water_logs` is preserved and never destructively migrated;
- new schema work is additive, transactional, idempotent, and safe to rerun;
- backfill requires source-to-target counts, checksums, duplicate prevention, reconciliation, and recovery evidence;
- event ordering is tie-safe and browser-local hydration values are never automatically imported;
- shadow/parity must precede any future consumer cutover;
- development and production use one hydration route-registration contract with identical authentication, ownership, and feature-gate behavior;
- release checks compare the tested development route contract with the built production server;
- post-publish acceptance covers both customer-facing domains;
- no user-facing hydration behavior can activate during Phase 1.

Checkpoint Zero does not execute a migration, change schema, register routes, modify runtime behavior, or start Task #1472. It is the documentation gate required before explicit implementation authorization.

## Current decision

As of 2026-08-27, product-owner direction for clinician-defined numeric v0.1 is recorded and development implementation is authorized. The Daily Hydration Plan remains blocked from production clinical activation, production user-facing behavior, and consumer cutover until the remaining named approvals are recorded.