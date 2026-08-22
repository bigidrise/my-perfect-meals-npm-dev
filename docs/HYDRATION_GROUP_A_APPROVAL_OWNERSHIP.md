# Hydration Group A Approval Ownership Resolution

**Purpose:** Resolve which Group A decisions can be approved by the product owner now, which require a qualified external owner, and which genuinely block a feature-disabled Hydration Domain Foundation.  
**Status:** Scope lock affirmed; Checkpoint Zero passed. **Do not start Task #1472 implementation from this document alone.**
**Inputs:**

- `docs/HYDRATION_GOVERNANCE_DECISION_MATRIX.md`
- `docs/DAILY_HYDRATION_IMPLEMENTATION_GATE_REVIEW.md`
- Product-owner instruction: no user-facing clinical target, recommendation, policy activation, consumer cutover, or destructive migration in Phase 1.

## Executive finding

**No unresolved clinical number or disease-specific rule needs to block a feature-disabled backend foundation.**

The foundation may represent facts, uncertainty, ranges, ceilings, status states, provenance, authorization hooks, policy versions, and immutable history without deciding what amount of fluid or sodium is correct for any person.

The distinction is:

```text
Foundation infrastructure:
  Can represent a future policy/directive → does not activate it.

Clinical activation:
  Selects a target/restriction/modifier for a real user → requires the relevant
  qualified policy owner’s approval.
```

The product owner has affirmed the scope lock below, and the exact engineering blueprint has passed Checkpoint Zero. Application code changes still require explicit Task #1472 start authorization. External review is required before enabling the specifically identified authority or rule, not before creating an inactive representation for it.

## Scope lock affirmed before Task #1472

The following is an approvable nonclinical platform decision:

> **Phase 1 may build only feature-disabled, server-authoritative hydration infrastructure. It may not activate a baseline target, clinical modifier, condition policy, electrolyte target, clinician directive, user override, or consumer/UI behavior. It must retain existing `water_logs`, preserve immutable history, derive ownership from authentication, and keep unknown data unknown.**

**Product owner who can affirm:** Idrise  
**Engineering/Data confirmation:** implementation includes no seeded active rule, no enabled consumer cutover, no new recommendation response, and no destructive migration.  
**Security confirmation:** subject identity remains server-derived; access is deny-by-default; audit hooks exist for future privileged use.

## Product-owner approval record

**Recorded:** 2026-08-21
**Approver:** Idrise
**Approval:** Idrise approved the concept of a feature-disabled Phase 1 Hydration Intelligence foundation and affirmed the boundaries above. The existing Biometrics water tracker is not the target architecture; existing logs and safe presentation pieces may be audited for reuse, while the Hydration Domain is designed as the future authoritative system.

**Condition of approval:** This is approval of the nonclinical product scope, not a self-starting instruction to modify application code. Checkpoint Zero has resolved the blueprint’s required changes, but Task #1472 implementation still requires explicit start authorization.

**Future architecture direction affirmed:** One server-produced Daily Hydration State must eventually serve all authorized consumers and professional views. Future general wellness, performance, GLP-1, pregnancy, POTS/dysautonomia, clinician, restriction, beverage, electrolyte, and professional capabilities remain inactive until their required governance approvals exist. Autonomous dehydration, water-cutting, rapid weight-cutting, and fluid-restriction protocols are excluded from Phase 1.

---

## Group A decision ownership

| ID | Decision still required | Recommended decision | Why this is recommended | Approval owner | Can Idrise approve now? | If external review is needed, exact question | What it blocks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **A1** | Define what an intake event means. | In v1, preserve declared beverage volume and class. Legacy rows become `legacy_manual` water events only. Do not infer food water, total fluid, or hydration effect. | It preserves factual history without turning incomplete records into medical data. | **Product** owns v1 product meaning; **Engineering/Data** validates schema/migration fidelity. | **Yes.** | No external clinical review is needed for a water-only factual event model. Future expansion to clinical total-fluid interpretation is separately reviewed. | Foundation schema/event model only. |
| **A2** | Define partial hydration contribution. | Keep raw beverage volume separate from hydration contribution. Default contribution is `unknown` unless a declared, versioned method supports an estimate. | “Unknown” is technically and clinically safer than pretending equal contribution. | **Product + Engineering/Data**. | **Yes.** | If MPM later estimates contribution for coffee, food, or other drinks: **Dietitian/Nutrition** must answer, “What approved calculation and limitations apply to this beverage class?” | Foundation may model `unknown` now. Estimation activation is blocked. |
| **A3** | Define electrolyte data semantics. | Store only declared/validated values with source/confidence; expose coverage as `not_tracked`, `water_only`, or `partial`; never synthesize zero or a target. | It makes the ledger honest without issuing supplementation advice. | **Product + Engineering/Data** for storage/labels. | **Yes, for representation only.** | For any nutrient target, limit, recommendation, or medical label: **Physician/Clinical + Dietitian/Nutrition** must answer, “What values, populations, contraindications, and claim language are approved?” | Foundation data model may proceed. Numeric rule activation is blocked. |
| **A4** | Define clinician directive authority. | Build a generic, inactive directive representation with effective interval, source, rationale, audit, and deny-by-default access. Do not enable any professional role to create directives in Phase 1. | The platform can preserve future authority without granting treatment-like powers prematurely. | **Product + Engineering/Data + Security** for inactive structure. **ProCare Governance + Privacy/Compliance + Physician/Clinical** for enabled authority. | **Yes, for inactive representation only.** | “Which specific professional roles may create/read/edit each directive type; what client consent, organization scope, review/expiry, and audit requirements apply?” | Does not block foundation. Blocks professional directive activation. |
| **A5** | Define user override authority. | A user may later submit a preference proposal only; it never overrides a restriction, clinician directive, `needs_review`, or `blocked`. Phase 1 enables no override behavior. | Preserves user agency without allowing unsafe self-service bypass. | **Product**; engineering enforces the invariant. | **Yes.** | If a clinician-approved exception path is later requested: **Physician/Clinical + ProCare Governance** must define the approval workflow. | Does not block foundation. Blocks future preference activation only. |
| **A6** | Define conflict precedence/composition. | Implement generic typed claims and status transitions. Do not seed clinical precedence. Enforce only structural invariants: hard restrictions cannot be silently discarded; incompatible hard claims become `needs_review` or `blocked`; registration order is never authority. | This permits a safe resolver without inventing disease-specific order or numbers. | **Product + Engineering/Data** for generic status semantics. **Physician/Clinical + Dietitian/Nutrition** for active clinical precedence. | **Yes, for generic resolver invariants.** | “For each approved condition policy, what is the exact precedence against clinician floor/range/ceiling, other condition policies, and performance/pregnancy context?” | Does not block foundation. Blocks clinical conflict-rule activation. |
| **A7** | Define `needs_review` behavior. | No actionable target/remaining amount; preserve event logging; return neutral status/explanation and a permitted next action. No clinical escalation text in Phase 1. | It handles uncertainty without creating a false safe target or erasing factual logs. | **Product + Engineering/Data** for neutral state behavior. | **Yes.** | For condition-specific routing/escalation language: **Physician/Clinical** must answer, “What action is safe for this conflict class?” | Foundation may implement the status. Clinical routing is blocked. |
| **A8** | Define `blocked` behavior. | Do not return a target, remaining amount, hydration action brief, or recommendation. Preserve events and return a neutral blocked state. Phase 1 contains no diagnosis/escalation copy. | It distinguishes hard safety stop from uncertainty while retaining history. | **Product + Engineering/Data** for generic suppression. **Physician/Clinical** for clinical escalation. | **Yes, for generic suppression only.** | “For each clinical blocked state, what user-facing instruction, timing, and emergency/clinician escalation is appropriate?” | Foundation may model the status. Clinical blocked messaging/action is blocked. |
| **A9** | Define mid-day clinician changes. | Any valid future change creates a superseding, effective-dated plan revision; earlier events/revisions remain immutable. No retroactive rewrite by default. | This is a provenance/history rule, not a clinical-number decision. | **Product + Engineering/Data**. | **Yes.** | For retrospective clinical corrections: **Physician/Clinical + Privacy/Compliance** must define who may perform them, why, and how the original remains visible/audited. | Does not block foundation. Special correction workflow remains blocked. |
| **A10** | Define mid-day policy changes. | New policy versions create new effective intervals and plan revisions. Past intervals stay linked to their original policy manifest. | Allows debugging, clinical review, and audit without mutable history. | **Product + Engineering/Data**. | **Yes.** | For a policy that must be applied retrospectively: **Physician/Clinical + Privacy/Compliance** must define correction scope, patient communication, and audit requirements. | Does not block foundation. Retroactive policy application is blocked. |
| **A11** | Define ProCare permissions and consent. | Keep all hydration professional access deny-by-default in Phase 1. Reuse current relationship/org isolation patterns only when future permission policy explicitly enables a scope. | Avoids granting access to sensitive hydration/clinical data before role and consent decisions exist. | **Security + Privacy/Compliance + ProCare Governance**, with **Product**; **Physician/Clinical** when a role can set a clinical directive. | **No, not for enabled access.** Idrise can approve deny-by-default foundation scope. | “Which roles may view events/state, create directives, amend directives, see explanations, and access history; what consent, revocation, audit, and retention rules apply?” | Does not block generic foundation. Blocks all professional hydration access/directive activation. |
| **A12** | Define legacy water-log migration acceptance. | Use a lossless, repeatable, no-destructive backfill with retained IDs/timestamps/amounts; label legacy events water-only and nonclinical. Keep legacy table/route during parity and rollback window. | Preserves existing user data while avoiding invented historical meaning. | **Product + Engineering/Data**; Security validates identity/rollback integrity. | **Yes, subject to engineering acceptance evidence.** | If migration introduces new retention, sharing, or purpose-of-use beyond current records: **Privacy/Compliance** must answer the applicable data-governance requirement. | Does not block schema foundation. Blocks backfill/cutover until parity/rollback proof passes. |

---

## APPROVABLE NOW

Idrise can legitimately approve these **nonclinical platform decisions now**:

1. **Feature-disabled Phase 1 scope lock** — no active clinical/user hydration rule, no UI, no consumer cutover, no destructive migration.
2. **A1 factual event model** — legacy rows are water-only events; no inferred total-fluid, food-water, or clinical meaning.
3. **A2 uncertainty model** — raw volume and hydration contribution are distinct; default contribution is unknown.
4. **A3 data-quality model** — electrolyte values require declared/validated sources and explicit coverage; no numeric target/limit.
5. **A4 inactive authority model** — generic directive representation/audit is allowed, but all professional use remains disabled.
6. **A5 user preference invariant** — preferences never override restrictions, clinician authority, or unresolved/blocked status.
7. **A6 structural conflict invariants** — typed claims, no registration-order choice, no silent deletion of hard restrictions, safe status outcomes.
8. **A7/A8 neutral status behavior** — suppress invalid target/action output while preserving immutable event history.
9. **A9/A10 revision history model** — effective-dated supersession, no historical rewrite by default, versioned policy manifests.
10. **A12 migration method** — retain `water_logs`, backfill losslessly later, and require parity/rollback proof before cutover.

These decisions are enough to define the engineering contract. They do not authorize a user-facing hydration plan or medical recommendation.

## EXTERNAL REVIEW REQUIRED

| External owner | Required review before activation | Exact question to answer |
| --- | --- | --- |
| **Physician/Clinical governance** | Baselines, condition modifiers, clinical conflict precedence, fluid/sodium/electrolyte restrictions, POTS/dysautonomia, pregnancy, GLP-1, renal/cardiac/liver interactions, clinical escalation language. | “For this named population/policy, what rule, range, contraindication, precedence, escalation, evidence basis, review date, and limitation is approved?” |
| **Dietitian/Nutrition governance** | Beverage/food contribution estimates, electrolyte claims/coverage, caffeine/alcohol treatment, performance/wellness modification, nutrition-facing language. | “What nutrition calculation or claim is valid for this data source/population, what uncertainty must be shown, and when must it not be applied?” |
| **ProCare governance** | Professional role matrix, directive authority, client consent, relationship scope, review/expiry, and operational workflow. | “Which roles may access which hydration projection or action, for which linked clients, under what consent/revocation/audit rules?” |
| **Privacy/Compliance** | Sensitive-data purpose, retention/deletion/export, professional visibility, retrospective correction handling, and audit requirements. | “What retention, access, consent, correction, and audit obligations apply to hydration events, plan revisions, and future clinical directives?” |
| **Security** | Threat model for future professional access and sensitive hydration data, authorization tests, logging constraints, and identity/cache isolation. | “Does the proposed authorization, audit, cache partitioning, and denial behavior prevent cross-account or over-privileged access?” |

## FOUNDATION BLOCKERS

### Genuine blockers to starting feature-disabled infrastructure

**The product-owner scope-lock confirmation and Checkpoint Zero are complete.** The remaining gate before code is explicit Task #1472 start authorization.

Once Task #1472 is explicitly started, there are **no unresolved clinical-number or condition-policy decisions that need to block the strictly feature-disabled infrastructure**.

Engineering must still complete normal review of:

- database migration safety;
- authentication/authorization tests;
- privacy-safe audit/logging implementation;
- no-active-policy/no-consumer-cutover enforcement.

These are implementation quality gates, not missing clinical decisions.

## ACTIVATION-ONLY BLOCKERS

The following may stay unresolved while a feature-disabled foundation is built, but each must be approved before it affects a user:

- every numeric baseline, target, range, floor, ceiling, or timing rule;
- all activity, climate, pregnancy, GLP-1, performance, POTS/dysautonomia, renal, cardiac, liver, oncology, or medication modifiers;
- all electrolyte targets/limits and contribution estimates;
- caffeine/alcohol contribution policy;
- role-enabled clinician directives and professional hydration views;
- disease-specific conflict precedence and escalation actions;
- user-facing clinical claims, “goal met” language, and actionable remaining amounts;
- client migration/cutover and Hydration Center activation.

## Recommended immediate path

1. Treat the recorded Idrise approval as the **Scope lock** and approval of the ten **Approvable Now** platform decisions.
2. Treat the completed Checkpoint Zero record as the reconciled implementation gate.
3. Keep #1472 paused until its explicit start authorization is recorded.
4. After authorization, implement only the explicitly feature-disabled Phase 1 foundation in dependency order.
5. Use the external-review table to create/version individual clinical policy decisions before enabling each future rule.

No application code, schema, route, calculation, UI, or migration behavior was changed by this review.