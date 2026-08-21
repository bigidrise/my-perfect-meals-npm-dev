# Daily Hydration Plan — Implementation Gate Review

**Reviewed architecture:** `docs/DAILY_HYDRATION_PLAN_ARCHITECTURE.md`  
**Status:** **CONDITIONALLY READY FOR BACKEND-FOUNDATION PLANNING; NOT APPROVED FOR IMPLEMENTATION OR USER-FACING ACTIVATION**  
**Date:** 2026-08-21  
**Scope:** Phase 1 — Hydration Domain Foundation only

## Gate decision

The Daily Hydration Plan architecture is sound enough to become the implementation source document. The codebase audit confirms that MPM can build this as a server-authoritative platform service without replacing the existing tracker first.

The gate is **not fully passed** because the clinical-policy and professional-governance inputs required to produce user-facing plans have not yet been approved. Engineering may prepare an implementation plan and schema contract, but must not activate a default target, condition-specific fluid rule, electrolyte recommendation, clinician override workflow, or Hydration Center.

### The single-source-of-truth decision

> **The Hydration Domain Service is the single answer to: “What is this person’s hydration plan today?”**

It owns canonical events, effective plan revisions, daily state, policy/version provenance, and role-scoped projections. The following must eventually stop independently calculating an authoritative hydration answer:

- Biometrics’ browser-local ounces counter and weight × 0.67 target;
- GLP-1’s independent water-row aggregation;
- the coaching observer’s 2,000 mL comparator as a target;
- prompt-only hydration/electrolyte claims in beverage flows;
- any future performance, pregnancy, POTS/dysautonomia, or builder-specific target calculation;
- optional hydration-like fields in nutrition prescription models as a hidden second authority.

## 1. Existing-path inventory and classification

Classifications:

- **KEEP** — retain as-is or as a compatibility boundary.
- **ADAPT** — retain the capability but change its input/output contract.
- **MIGRATE** — transfer data/behavior to the Hydration Domain Service without destructive deletion.
- **DEPRECATE** — stop treating it as authoritative after a verified replacement exists.
- **REMOVE LATER** — only remove after reachability, parity, migration, and rollout evidence are complete.

### 1.1 Persistence, APIs, and local hydration state

| Current path | Current behavior | Classification | Phase 1 disposition |
| --- | --- | --- | --- |
| `shared/schema.ts` — `waterLogs` / physical `water_logs` table | Stores `userId`, mL amount, unit, intake time, and creation time with user/time indexes. | ADAPT + MIGRATE | Retain unchanged as legacy source. Design canonical event tables and a lossless future backfill; do not delete or overwrite rows. |
| `migrations/0000_deep_madrox.sql` — `water_logs` creation | Original database definition and indexes. | KEEP | Preserve as baseline migration history. |
| `server/routes/waterLogs.ts` | Converts mL/oz/cup, supports event creation/history, requires auth, derives user from `req.authUser`, and verifies delegated physician client access. | KEEP + ADAPT | Preserve the #1469 ownership fix and compatibility behavior. Future canonical hydration routes must use the same ownership model. |
| `client/src/lib/waterLogsApi.ts` | Water-log types, history query, mutation helper, account-aware query key/stale-result guard. | KEEP + ADAPT | Keep cache partitioning by local account identity while removing caller identity from API URLs/bodies. |
| `client/src/hooks/useWaterLogsInfinite.ts` | Paged client history fetch. | ADAPT | Later point at canonical hydration history, retaining cache partitioning and cursor safety. |
| `client/src/pages/my-biometrics.tsx` — water section | Local daily ounces/goal, server history display, optimistic add, local reset, browser-derived weekly aggregation. | MIGRATE + DEPRECATE as authority | Leave behavior unchanged in Phase 1. Later replace local target/progress with server plan/state. |
| `localStorage["mpm_bio_water:${userId}"]` | Browser-only daily total. | MIGRATE + DEPRECATE | Never silently import as history or clinical fact; use only user-confirmed current-day reconciliation during cutover. |
| `localStorage["latestWeight"]` | Input to legacy Biometrics hydration formula. | KEEP for biometrics; DEPRECATE for hydration authority | It may inform an approved baseline input later; it cannot determine an authoritative target in the browser. |
| `server/db/schema/dailyNutritionPrescriptions.ts` and `shared/dailyNutritionPrescription.ts` | Macro prescription contracts contain hydration-adjacent optional fields but no hydration-plan history/state. | ADAPT, then REMOVE LATER as hydration authority | Keep nutrition prescription separate. Do not add a second hydration state to it. |

### 1.2 GLP-1, coaching, performance, pregnancy, and protocol contributors

| Current path | Current behavior | Classification | Required future boundary |
| --- | --- | --- | --- |
| `server/services/glp1/resolveDailyMedicationTolerance.ts` | Reads water rows with GLP-1 symptoms/check-ins and produces daily risk, adaptations, escalations, and rule provenance. | KEEP as safety behavior; ADAPT hydration aggregation | Consume shared daily state/event aggregates; remain a GLP-1 safety overlay and never become the general plan resolver. |
| `server/routes/glp1.ts` | GLP-1 daily tolerance/check-in APIs and persistence. | KEEP + ADAPT | Retain GLP-1 workflow; map hydration-related inputs/outputs through a structured adapter. |
| `migrations/0009_create_glp1_daily_tolerance.sql` | Mutable per-user/day GLP-1 tolerance snapshot including water total and resolver version. | ADAPT | Preserve as condition history; it is not the canonical hydration history because upserts do not preserve a plan-revision timeline. |
| `server/db/schema/glp1Checkins.ts` and ACE check-in schema | Raw symptoms and functional observations. | KEEP | Use as evidence inputs only where a clinically approved adapter requires them. |
| `shared/glp1-schema.ts` and `client/src/pages/physician/GLP1Hub.tsx` | GLP-1 hydration minimum guardrail/profile input and UI. | ADAPT | Become a versioned condition-policy/modifier input; not an independent daily target. No behavior change in Phase 1. |
| `server/services/coaching/observers/hydrationObserver.ts` | Water-only recent-history evidence, using 2,000 mL as an investigation comparator; explicitly not a diagnosis/prescription. | KEEP evidence; DEPRECATE comparator as target | Consume canonical state later. Preserve its non-diagnostic boundary. |
| `server/services/coaching/observers/complianceObserver.ts` and coaching reasoning families | Counts water-log days and uses hydration as an investigation/coaching signal. | ADAPT | Read role-scoped canonical state/evidence, not raw independent water aggregation. |
| `shared/performanceDemandEngine.ts` and `server/routes/performanceNutrition.ts` | Performance demand, schedule, and nutrition context. | KEEP + ADAPT | Supply structured session/context input only; no independent fluid or electrolyte calculator. |
| `server/services/pregnancyNutritionGenerator.ts`, pregnancy prompt builders/coaching routes | Contains pregnancy hydration language, including fixed glass-range wording. | KEEP + ADAPT | Route hydration language through approved policy/explanation contracts. Do not treat current fixed text as an individualized rule. |
| `server/services/protocolEnvelope.ts`, `shared/clinical/clinicalModeResolver.ts`, clinical guardrails | Canonical structured clinical context and safety propagation for generators. | KEEP + ADAPT | Add a typed hydration projection only after a plan/state exists; do not embed a second resolver in the envelope. |
| `server/services/unifiedMealPipeline.ts` and legacy/direct meal paths | Safety/generation distribution paths. | KEEP active pipeline; MIGRATE duplicate paths only after reachability review | Hydration matters only through the common structured envelope/action brief. |

### 1.3 Product consumers and professional access

| Current path | Current behavior | Classification | Future contract |
| --- | --- | --- | --- |
| `server/routes/beverage-creator.ts` and `server/services/guardrails/beverageMedicalRules.ts` | Authenticated beverage generation and medical validation. | KEEP + ADAPT | Consume a server-produced hydration action brief; never calculate target/remaining/electrolyte needs. |
| `client/src/pages/BeverageCreator.tsx` | Hydration category and generated-recipe cache (`mpm_beverage_creator_result`). | KEEP result cache; ADAPT hydration request | Recipe cache is not an intake event or hydration ledger. |
| `client/src/pages/AthleteBeverageCreator.tsx` | Hydration/electrolytes intent and prompt language; recipe cache (`mpm_athlete_beverage_result`). | ADAPT + MIGRATE claims | Replace autonomous electrolyte prompting with approved plan constraints/action brief. |
| `server/routes/coachCorner.ts` and coaching engine/context services | Maps hydration/drinks conversation to Beverage Creator but has no common hydration-state query. | KEEP + ADAPT | Receive a role-scoped Daily Hydration State projection and controlled actions. |
| `client/src/pages/CoachsCorner.tsx` and related Coach’s Corner pages/cards | Generic coaching UI with no independent hydration calculation. | KEEP | No UI work in Phase 1; future state arrives via the server context contract. |
| Nutrition Life Plan, board, and meal-builder pages | No direct fluid-state reads found; some “hydration” mentions are loading/sync terminology, not water tracking. | KEEP + future ADAPT | Consume Protocol Envelope hydration context only after consumer rollout. |
| `server/middleware/requireProCareAccess.ts`, `server/services/procareAccessService.ts`, `server/routes/procareRoutes.ts` | Existing professional role, relationship, and organization isolation controls. | KEEP + ADAPT | Reuse for role-scoped hydration projections and clinician-plan authority; do not grant blanket access. |
| `server/routes/waterLogs.ts` delegated `clientId` path | Current limited professional hydration-history read path, protected by relationship verification. | KEEP as security pattern | Future professional hydration routes must verify the same active relationship and scope before honoring an explicit client selector. |
| ProCare client pages and nutrition-plan pages | No hydration-specific plan/state UI found. | KEEP | No UI work in Phase 1. |

### 1.4 Known non-hydration false matches

- `server/routes/mealImages.ts` uses “hydration” in image/network request context, not fluid intake.
- Some meal builder hydration terminology refers to board loading/synchronization, not the hydration domain.

These are **KEEP / out of scope** for this initiative.

## 2. Exact Phase 1 server-side domain contract

Phase 1 creates the domain boundary. It does not activate new user-visible hydration recommendations.

### 2.1 Proposed persistence model

| Proposed table/read model | Required purpose | Key fields and invariants |
| --- | --- | --- |
| `hydration_baselines` | Versioned default/user/clinician baseline input. | Subject, status, mode, optional target/range, formula/version metadata, effective interval, source/author, rationale. A baseline is not a hard restriction. |
| `hydration_clinician_directives` | Effective-dated professional input. | Subject, authorized clinician/organization, target kind, point/range/floor/ceiling values, timing scope, review/expiry, reason, status, audit linkage. It cannot bypass relationship checks. |
| `hydration_modifiers` | Structured condition/context contributor claims. | Subject, type, typed delta/range/timing claim, conflict group, policy ID/version, source evidence reference, effective interval, status (`active`, `withheld`, `expired`). |
| `hydration_restrictions` | Enforceable hard or advisory boundaries. | Subject, metric, scope, min/max, severity, hard-stop flag, policy/clinical source, effective interval, rationale. A ceiling remains a ceiling in all projections. |
| `hydration_policy_versions` | Logic/policy provenance registry. | Policy ID, version, content hash, effective interval, approval status, author/reviewer reference. It can register policies before policy values are activated. |
| `hydration_intake_events` | Canonical immutable intake ledger. | Event ID, subject, occurred time/timezone, normalized mL and original value/unit, beverage class, source, idempotency key, provenance, status/correction lineage, optional declared nutrient fields and confidence. |
| `hydration_event_audits` | Event correction/void and administrative history. | Actor, action, reason, prior/new event references, timestamp, correlation ID. No silent event mutation. |
| `hydration_plan_revisions` | Immutable answer to the plan for one user/date/effective interval. | Subject, local date/timezone, revision/supersedes pointer, status, target semantics, timing windows, references to all inputs, policy-version manifest, calculation-policy version, input snapshot hash, explanations, effective/superseded timestamps. |
| `hydration_contributions` | Derived volume/contribution projection. | Event/plan reference, contribution value or unknown state, method, confidence, assumptions, algorithm version. Raw volume and contribution are never conflated. |
| `hydration_electrolyte_ledgers` | Derived nutrient/accounting projection. | Plan/date, declared totals, coverage (`complete`, `partial`, `water_only`, `not_tracked`), source/confidence, warnings, policy version. Unknown is never stored as zero. |
| `hydration_daily_states` | Recomputable query/read model. | Subject/date/timezone, plan revision timeline, totals, remaining when valid, coverage/warnings, trend projection, input watermark, state version, computed timestamp. |
| `hydration_audit_log` | Clinical/professional plan and access audit. | Actor/subject/action/resource, policy/plan version, reason, correlation ID, least-privilege metadata. |

**Schema safety rules**

- PostgreSQL is authoritative for all active plan inputs, events, audit history, revisions, and state.
- Each new table uses an explicit migration; no destructive change to `water_logs`.
- Store UTC timestamps plus the event/plan timezone required for local-date determination.
- `hydration_plan_revisions` is append-only. A mid-day change creates a new revision with a supersession interval.
- `hydration_daily_states` is materialized/recomputable, never the sole source of historical truth.

### 2.2 Service and resolver boundaries

```text
HydrationEventService
  owns authenticated event acceptance, conversion, validation, idempotency,
  correction/void lineage, and event auditing.

HydrationInputService
  owns baseline, clinician directive, modifier, restriction, and policy-version retrieval.

HydrationPlanResolver
  loads effective inputs → normalizes claims → resolves authority/conflicts
  → creates immutable plan revision + explanations.

HydrationStateProjector
  folds canonical events against the plan-revision timeline
  → contribution/electrolyte projections → daily state/version.

HydrationProjectionService
  returns least-privilege user, coach, generator, and professional projections.

HydrationPolicyAdapter interface
  allows GLP-1, performance, pregnancy, and later dysautonomia/POTS to contribute
  typed inputs without calculating their own effective plan.
```

No language model, React component, prompt builder, or condition-specific route is a hydration resolver.

### 2.3 Proposed API contracts

Phase 1 APIs may remain feature-flagged/internal until governance and migration gates pass.

```text
GET  /api/hydration/plan?date=YYYY-MM-DD
GET  /api/hydration/state?date=YYYY-MM-DD
GET  /api/hydration/history?from=...&to=...&cursor=...
POST /api/hydration/events
POST /api/hydration/events/:id/correction
POST /api/hydration/plan/preview
```

| Endpoint class | Ownership and response rule |
| --- | --- |
| User plan/state/history/event routes | Subject derives from session/token only. No request field may select another account. |
| Professional hydration routes | A client selector is permitted only after active ProCare relationship, organization isolation, role scope, and audit checks. |
| Event writes | Require `idempotencyKey`; preserve original unit/value; write only canonical intake facts. |
| Plan preview | May evaluate a user preference in a non-activating preview; cannot activate a clinical directive or override restriction. |
| All responses | Include plan revision, state version, input watermark, calculation-policy version, and appropriate explanation/provenance projection. |

### 2.4 Client identity and cache boundary

The #1469 repair established server-derived ownership. The client must not reverse that repair by sending `userId` in URLs or request bodies.

However, local account identity remains required for:

- React Query keys;
- stale response rejection;
- resetting/remounting account-scoped views;
- partitioning client cache/local storage;
- preventing a fetched projection for account A from rendering after a switch to account B.

**Rule:** account identity belongs in local cache/render identity, not in ordinary self-service API authority.

## 3. Authority, revision, and history semantics

The following contract must remain unchanged during implementation:

1. Intake events are immutable; correction and void form an auditable lineage.
2. A daily plan is immutable per revision; current-day changes produce superseding revisions.
3. A historical day is queried against the plan revision/policy versions effective during that day, never recalculated using today’s rules.
4. Current state is dynamic and re-computable from events plus plan-revision timeline.
5. A clinician ceiling is a structured boundary, not a user encouragement target.
6. Hard conflicts result in `needs_review` or `blocked`; no registration-order or numerical-average fallback.
7. Electrolyte accounting reports quality/coverage rather than fabricating complete data.

## 4. Future consumer map

| Consumer | Reads from Hydration Domain Service | Must never do |
| --- | --- | --- |
| Biometrics / Hydration Center | User plan/state/history projection; submits idempotent events. | Browser-owned target, browser-only remaining state, local reset that rewrites history. |
| Nutrition Life Plan | Plan status, rationale, trend summary, relevant constraints. | Query and aggregate water events independently. |
| Beverage Creator | Hydration action brief: valid time/use window, constraints, remaining range when valid, coverage limitations, required labels. | Calculate target/remaining, infer electrolyte need, treat a generated drink as consumed. |
| Coach’s Corner | Compact role-scoped state/explanation/action projection. | Diagnose hydration, derive targets, infer unknown electrolyte intake. |
| ProCare | Clinician directives, effective-plan timeline, authorized actual intake/adherence projection. | Read a client without active relationship/role scope or silently override policy. |
| Meal/builders | Structured Protocol Envelope hydration context only when relevant. | Count food water as measured intake or own a second calculator. |

## 5. No-destructive migration design

### `water_logs`

1. Keep the table and the #1469 authenticated ownership route throughout the foundation and shadow period.
2. Backfill each row into `hydration_intake_events` with retained source ID/timestamp, exact normalized amount, `source=legacy_manual`, and `beverageClass=water`.
3. Do not infer electrolytes, food-water contribution, medical status, or historical plan membership.
4. Run repeatable, lossless backfill verification before any consumer switch.
5. Retain legacy read compatibility until canonical history parity, telemetry, and rollback requirements pass.

### Browser-local total and target

1. Never silently convert `mpm_bio_water:${userId}` into historical or medical data.
2. At UI cutover, fetch server state first.
3. Offer an explicit, auditable same-day manual adjustment only when a user confirms a higher client-only value.
4. Treat the legacy local target only as a user preference proposal after confirmation.
5. Cache the future server projection locally only under account-specific keys and state versions; it cannot replace server state.

## 6. Test plan required before implementation

### Unit and property-level resolver tests

- Unit conversion preserves original data and canonical mL.
- Plan input normalization has deterministic output.
- Authority ordering covers safety, clinician, policy, context, preference, and baseline.
- Compatible modifiers compose; incompatible hard claims yield `needs_review`/`blocked`.
- Ceiling/floor/range/point semantics never collapse into the wrong target kind.
- Same events and inputs yield identical revision/state outputs.
- Policy/version/input-hash provenance is present for every plan revision.

### API and data-isolation tests

- Unauthenticated plan/state/history/event requests return `401`.
- A spoofed body/query identity cannot access another user.
- Client cache keys remain account-scoped while requests omit caller identity.
- An authorized professional can access only a currently linked, organization-valid client.
- Revoked/expired access fails immediately.
- Event write retries with the same idempotency key apply once.
- Corrections/voids preserve immutable audit history.

### Revision, history, and conflict tests

- A clinician change at midday creates a new plan revision without rewriting the morning revision or earlier events.
- A policy version update creates a new effective interval and preserves historical explanation.
- Yesterday’s state renders using yesterday’s revision/policy manifest.
- A new current plan changes current remaining only according to approved revision semantics.
- Unknown nutrient data is shown as partial/unknown, never zero.

### Migration and compatibility tests

- Backfill is lossless, repeatable, and preserves source IDs/timestamps.
- Canonical history matches legacy water-log totals for legacy water events.
- No local-storage total becomes an event without user confirmation.
- Existing Biometrics and GLP-1 behavior remain unchanged during the Phase 1 foundation rollout.
- Legacy routes retain secure ownership behavior during the shadow period.

### Consumer regression tests

- Beverage Creator receives a constrained action brief but cannot create intake events automatically.
- Coach uses a server state projection and controlled action; it does not recompute.
- Protocol Envelope passes only the intended hydration fields.
- ProCare projections distinguish clinician directive, effective plan, actual events, and coverage.

### Cross-device tests

- Device A event produces a new server state/version visible to Device B.
- Device B cannot overwrite a newer state with a stale cached total.
- Account switching never renders hydration state from the previous user.

## 7. Unresolved clinical and governance decisions

These are blockers for activating behavior. The implementation team must not invent answers.

| Decision required | Why it blocks activation |
| --- | --- |
| Evidence-based baseline hydration policy | The current 2,000 mL observer value is explicitly investigation-only; the Biometrics formula is browser-local and unapproved. |
| Allowed wellness/context modifiers | Activity, climate, performance, and diet context need approved scope, inputs, caps, timing, and explanation language. |
| Clinician authority model | Define who can create/view/edit ranges, floors, ceilings, electrolyte limits, review dates, and overrides; include ProCare role/consent/audit rules. |
| Conflict precedence | Approve how fluid floor/ceiling, condition policy, pregnancy, renal/cardiac/liver constraints, GLP-1 safety, and performance context coexist. |
| Pregnancy, renal, cardiac, liver, oncology, GLP-1, and performance interactions | Existing text/guardrails are not a unified hydration clinical policy. Fixed pregnancy glass text requires review. |
| Electrolyte semantics | Define what data sources are acceptable, which nutrients can be displayed, coverage rules, and when any target/limit is permissible. |
| User-facing language | Approve target, uncertainty, safety, symptom, escalation, and “goal met” wording without implying diagnosis or unsupported medical advice. |
| POTS/dysautonomia policy | No POTS implementation or sodium rule may enter Phase 1. It requires the separate governance work already identified. |
| Timezone/date and data-quality policy | Decide subject timezone source, travel/day-boundary behavior, implausible entries, duplicate semantics, stale logs, and wearable/import consent. |
| Migration acceptance criteria | Approve parity threshold, shadow duration, rollback criteria, telemetry retention, and local-data reconciliation experience. |

## 8. Dependency-ordered Phase 1 tasks

These are planning units only. They must not start until this gate is explicitly approved.

| Order | Task | Engineering-safe work | Requires governance approval |
| --- | --- | --- | --- |
| 0 | Approve the implementation gate | Finalize source document, decisions, owner, and rollout/rollback acceptance. | **Yes — all unresolved decisions above.** |
| 1 | Freeze shared hydration domain contracts | Types, enum semantics, provenance/version interfaces, fixture shapes, and nonclinical invariants. | No clinical numeric/default values. |
| 2 | Create append-only hydration foundation schema | New tables/migrations for events, inputs, revisions, state, and audit; no destructive legacy migration. | Schema may be prepared; activating clinical directive types needs role policy. |
| 3 | Build event/audit service contract | Auth-derived ownership, conversion, idempotency, correction/void lineage, account-safe API tests. | No new recommendation logic. |
| 4 | Build resolver and state-projector harness | Pure resolver/state interfaces, `monitor_only`/`needs_review` handling, versioned snapshot generation, test fixtures. | Baseline and active modifier values cannot be enabled without approval. |
| 5 | Add role-scoped read APIs behind a feature flag | Plan/state/history projections, access gates, cache/version headers, audit events. | Professional fields/permissions must match approved authority model. |
| 6 | Run migration/shadow readiness review | Lossless water-log backfill plan, parity queries, no-destructive rollback plan, local-storage reconciliation specification. | Migration acceptance thresholds and user messaging require sign-off. |

## 9. Explicit Phase 1 exclusions

Phase 1 must not:

- build or redesign the Hydration Center/Biometrics UI;
- alter current hydration recommendations;
- replace or delete `water_logs`;
- silently import local storage as history;
- activate POTS/dysautonomia behavior;
- create a sodium/electrolyte calculator;
- alter GLP-1, performance, pregnancy, or beverage recommendations;
- let any client calculate the authoritative hydration plan;
- add a second plan calculator to Coach, Beverage Creator, ProCare, Nutrition Life Plan, or a meal builder.

## 10. Approval checklist

Implementation may begin only when all statements are affirmed:

- [ ] The Daily Hydration Plan service is the sole source of truth.
- [ ] The snapshot/revision/history contract is approved.
- [ ] Baseline and modifier policy owners are named.
- [ ] Clinical conflict precedence and escalation policy are approved.
- [ ] Clinician/ProCare permissions and audit scope are approved.
- [ ] Electrolyte data/claim semantics are approved.
- [ ] Migration, shadow, parity, and rollback acceptance criteria are approved.
- [ ] Phase 1 exclusions remain in place.

Until that point, the appropriate work remains architecture review and policy governance—not implementation.