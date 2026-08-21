# Daily Hydration Plan — Technical Architecture Proposal

**Status:** Design for approval only — no Hydration Intelligence implementation is authorized by this document.  
**Scope:** One server-authoritative hydration domain for MPM.  
**Non-goal:** This does not prescribe clinical fluid, sodium, electrolyte, POTS, pregnancy, or medication rules. Those require separately approved policies and clinical governance.

## 1. Decision summary

MPM should not add another hydration tracker or let each clinical feature calculate its own hydration target.

The proposed platform rule is:

> **Every feature reads the same authoritative Daily Hydration Plan. No builder, coach, or condition-specific workflow owns an independent hydration calculation.**

The Daily Hydration Plan is a server-resolved, date-specific snapshot that combines an approved baseline, valid modifiers, hard restrictions, clinician parameters, intake events, and provenance. It produces one effective plan plus an independently calculated current-day state:

```text
baseline
  → validated modifiers + restrictions
  → conflict resolution
  → Effective Daily Hydration Plan
  → immutable intake events
  → Daily Hydration State (consumed, remaining, coverage, explanations)
  → constrained actions in Biometrics, Coach, Beverage Creator, Life Plan, and ProCare
```

The browser is a client of that state. It is not its owner.

## 2. External architecture patterns being adapted

These are product-architecture analogues, not sources for MPM clinical thresholds or medical protocols.

| External pattern | Proven product behavior | MPM adaptation | Explicitly not copied |
| --- | --- | --- | --- |
| Garmin hydration | A baseline goal is adjusted for current activity/sweat-loss context, resulting in a same-day goal and progress loop. | `baseline → today's validated context → adjustment/restriction → effective plan → intake → remaining`. | Garmin’s calculation, device inputs, thresholds, UI, branding, or clinical claims. |
| WHOOP contextual coaching | Context and observations are assembled centrally before personalized coaching is generated. | Hydration state is resolved once on the server and supplied to coaching/generation as constrained context. | WHOOP’s models, biometric interpretations, coaching content, or medical positioning. |
| Hydration/electrolyte apps | Users can understand an explanation of why a goal changed and can distinguish water from electrolyte-related information. | Structured provenance, plain-language explanations, and explicit `coverage` for electrolyte data. | Treating any generic electrolyte target as safe for all users. |

### Sources

- Garmin, “Hydration | Health Science | Garmin Technology” — <https://www.garmin.com/en-US/garmin-technology/health-science/hydration/>
- WHOOP, “WHOOP expands health platform with on-demand clinician access and new AI features” — <https://www.whoop.com/us/en/press-center/whoop-expands-health-platform-with-on-demand-clinician-access-and-new-ai-features/>
- WHOOP, “How to build a better hydration strategy for training” — <https://www.whoop.com/us/en/thelocker/podcast-181-sports-scientist-andy-blow-hydration/>
- Brim listing, “Water & Electrolytes” — <https://play.google.com/store/apps/details?id=com.proapps.brim>

The transferable lesson is architectural: **centralize state, apply context deliberately, preserve the explanation, and have every consumer use the same resolved result.**

## 3. Current-state assessment

MPM already has useful components, but not a complete hydration domain.

| Current capability | Current source of truth | Reuse decision | Why it is insufficient alone |
| --- | --- | --- | --- |
| Water intake rows | `water_logs` | Reuse as the legacy source for canonical intake-event migration. | It records water volume but not an authoritative daily target, plan version, restrictions, provenance, or electrolyte coverage. |
| Biometrics water counter and goal | Client state/local storage plus a weight-derived display target | Replace as authority; preserve only as a temporary display/cache layer during migration. | Browser state cannot synchronize safely across devices or represent clinician restrictions/conflicts. |
| Water-log conversion/history route | Authenticated API, unit conversion, cursor-style history behavior | Reuse conversion and pagination patterns. | It is an event endpoint, not a plan/state resolver. |
| GLP-1 medication tolerance | GLP-1 daily resolver and safety/escalation records | Reuse rule provenance, adaptation, escalation, and approved/withheld rule patterns. | It currently performs hydration-related aggregation in a condition-specific path; that must become an adapter to shared state, not a competing system. |
| Hydration observer | Coaching evidence over recent water logging | Reuse evidence/trend patterns. | Its 2,000 mL comparison is an analytics reference, not a universal prescription. |
| Performance and pregnancy context | Performance demand, medical guidance, and profile/context services | Reuse validated context assembly. | They do not yet resolve structured hydration modifiers or hard constraints. |
| Protocol Envelope | Shared structured context propagation to generators | Reuse as the distribution path. | It needs a structured hydration projection, not only prose prompt guidance. |
| Beverage guardrails | Authenticated beverage context plus medical validation | Reuse as the action validation layer. | It must consume a plan; it must not invent targets or electrolyte rules. |
| ProCare provenance/authority patterns | Professional access, target provenance, relationship gating | Reuse role and authority patterns. | Hydration clinician parameters need their own auditable server-side model. |

### Current security baseline

The water-log API now derives ownership from `req.authUser.id`, requires authentication for reads and writes, and ignores caller-provided IDs. This remains a permanent invariant for the new domain:

> **No hydration plan, state, event, history, or professional projection may accept subject identity from a request body or query string.**

## 4. Domain boundaries and semantics

The architecture must keep four concepts separate. Combining them creates unsafe or misleading progress calculations.

| Concept | Meaning | Example | Must not be confused with |
| --- | --- | --- | --- |
| Fluid intake event | A user logged a beverage volume. | “16 oz water at 10:30.” | An approved target or electrolyte dose. |
| Hydration contribution | What portion of an event can responsibly contribute to a hydration calculation, with method/confidence. | Water is a direct contribution; a recipe may be derived; an unknown drink remains unknown. | Raw beverage volume in every case. |
| Electrolyte accounting | Measured/declared sodium, potassium, magnesium, etc., including coverage. | A labeled oral rehydration drink has declared sodium. | “Zero electrolytes” when information is simply unavailable. |
| Effective daily plan | The resolved target/range/ceiling/timing for one user and one local date, with authority and explanation. | “Target range X–Y; clinician ceiling Z; current session window.” | A static local preference or a condition-specific calculator. |

### Core safety semantics

- A **ceiling is never presented as an encouragement target**.
- Unknown beverages and unknown electrolyte content stay unknown; MPM must not relabel them as water or zero electrolyte intake.
- Food water is not added to measured fluid intake unless an explicit contribution method and confidence level support it.
- A generic hydration target is not medical advice and cannot override a condition policy or clinician restriction.
- `needs_review` and `blocked` are valid resolver outcomes. The resolver must not use array order or a “best guess” to silence a hard conflict.

## 5. Proposed canonical data contract

Entity names describe the contract. Physical storage can use normalized PostgreSQL tables plus materialized read models; the design must preserve the semantics below.

### 5.1 `HydrationBaseline`

A long-lived starting point. A baseline is lower authority than a restriction or an approved clinical parameter.

```ts
type HydrationBaseline = {
  id: string;
  subjectUserId: string;
  version: number;
  status: "draft" | "active" | "superseded" | "expired";

  mode: "weight_estimate" | "self_set" | "protocol_default" | "clinician_defined";
  targetMl?: number;
  minimumMl?: number;
  maximumMl?: number;

  weightKgAtCalculation?: number;
  formulaId?: string;
  formulaVersion?: string;
  timezone: string;
  effectiveAt: string;
  expiresAt?: string;

  setBy: "system" | "user" | "clinician";
  authorUserId?: string;
  sourceReference?: string;
  rationaleCode: string;
  explanationId: string;
  createdAt: string;
  updatedAt: string;
};
```

The current Biometrics weight-derived formula can become a low-authority baseline proposal. It must not be retained as a hidden authoritative clinical target.

### 5.2 `HydrationModifier`

A validated context contribution. It does not mutate the baseline record.

```ts
type HydrationModifier = {
  id: string;
  subjectUserId: string;
  type:
    | "performance"
    | "pregnancy"
    | "glp1"
    | "climate"
    | "medication"
    | "symptom"
    | "clinician_adjustment";

  deltaMl?: number;
  rangeDeltaMl?: { minimumMl?: number; maximumMl?: number };
  targetFloorMl?: number;
  targetCeilingMl?: number;
  timingPolicy: "all_day" | "pre_session" | "during_session" | "post_session" | "event_window";

  conditionKey?: string;
  sourceEventId?: string;
  effectiveDate: string;
  expiresAt?: string;
  priority: number;
  conflictGroup?: string;
  policyId: string;
  policyVersion: string;
  status: "active" | "withheld" | "expired";
  source: "system" | "profile" | "wearable" | "clinician" | "user";
  setBy: "system" | "user" | "clinician";
  rationaleCode: string;
  explanationId: string;
};
```

### 5.3 `HydrationRestriction`

A hard boundary. It is not merely a strongly worded target preference.

```ts
type HydrationRestriction = {
  id: string;
  subjectUserId: string;
  kind:
    | "fluid_ceiling"
    | "fluid_floor"
    | "timing_block"
    | "beverage_block"
    | "electrolyte_limit"
    | "sodium_limit"
    | "escalation_trigger";
  metric:
    | "total_fluid_ml"
    | "contribution_ml"
    | "sodium_mg"
    | "potassium_mg"
    | "magnesium_mg"
    | "caffeine_mg"
    | "alcohol_units";
  minimumValue?: number;
  maximumValue?: number;
  unit: string;
  scope: "daily" | "event" | "session" | "beverage";
  hardStop: boolean;
  severity: "advisory" | "guardrail" | "blocking";
  effectiveAt: string;
  expiresAt?: string;
  policyId: string;
  policyVersion: string;
  source: "policy" | "clinician";
  setBy: "system" | "clinician";
  rationaleCode: string;
  explanationId: string;
};
```

### 5.4 `EffectiveDailyHydrationPlan`

The immutable, versioned answer to “what plan applies to this person on this local date?”

```ts
type EffectiveDailyHydrationPlan = {
  id: string;
  subjectUserId: string;
  localDate: string; // ISO date in the subject's current plan timezone
  timezone: string;
  planVersion: number;
  status: "resolved" | "provisional" | "blocked" | "needs_review";

  targetKind: "point" | "range" | "floor" | "ceiling" | "monitor_only";
  targetMl?: number;
  minimumMl?: number;
  maximumMl?: number;
  timingWindows: Array<{
    id: string;
    start?: string;
    end?: string;
    targetMl?: number;
    minimumMl?: number;
    maximumMl?: number;
    rationaleCode: string;
  }>;

  baselineId?: string;
  modifierIds: string[];
  restrictionIds: string[];
  electrolytePolicyId?: string;
  authoritySource: "safety" | "clinician" | "policy" | "context" | "user" | "baseline";
  policyVersions: Record<string, string>;
  missingData: string[];
  rationaleCodes: string[];
  explanationIds: string[];
  effectiveAt: string;
  expiresAt?: string;
  createdAt: string;
};
```

### 5.5 `HydrationIntakeEvent`

The canonical append-only event. Corrections and voids retain auditability rather than silently changing history.

```ts
type HydrationIntakeEvent = {
  id: string;
  subjectUserId: string;
  occurredAt: string;
  timezone: string;
  volumeMl: number;
  originalAmount: number;
  originalUnit: "ml" | "oz" | "cup" | "l";

  beverageClass:
    | "water"
    | "oral_rehydration"
    | "electrolyte_drink"
    | "coffee"
    | "tea"
    | "juice"
    | "milk"
    | "alcohol"
    | "other"
    | "unknown";
  source: "manual" | "import" | "beverage_recipe" | "wearable" | "clinician_entry" | "legacy_manual";
  sourceEventId?: string;
  idempotencyKey: string;

  enteredAt: string;
  enteredByUserId: string;
  clientInstanceId?: string;
  status: "active" | "corrected" | "voided";
  correctionOfId?: string;
  note?: string;

  nutrients?: {
    sodiumMg?: number;
    potassiumMg?: number;
    magnesiumMg?: number;
    carbohydrateG?: number;
    caffeineMg?: number;
    alcoholUnits?: number;
    source: "label" | "recipe_nutrition" | "database" | "clinician" | "estimated";
    confidence: "high" | "medium" | "low";
  };
};
```

### 5.6 `HydrationContribution` and `ElectrolyteAccounting`

These are derived records/read models, not user-entered facts.

```ts
type HydrationContribution = {
  eventId: string;
  planId: string;
  contributionMl?: number;
  method: "direct_water" | "declared_beverage" | "recipe_derived" | "estimated" | "unknown";
  confidence: "high" | "medium" | "low" | "not_available";
  assumptions: string[];
  excludedReason?: string;
  algorithmVersion: string;
};

type ElectrolyteAccounting = {
  subjectUserId: string;
  localDate: string;
  planId: string;
  sodiumMg?: number;
  potassiumMg?: number;
  magnesiumMg?: number;
  coverage: "complete" | "partial" | "water_only" | "not_tracked";
  warningCodes: string[];
  policyId?: string;
  policyVersion?: string;
};
```

### 5.7 `HydrationDailyState`

The re-computable, cacheable read model used by product surfaces.

```ts
type HydrationDailyState = {
  subjectUserId: string;
  localDate: string;
  timezone: string;
  stateVersion: number;
  effectivePlanId: string;
  planStatus: EffectiveDailyHydrationPlan["status"];

  totalFluidMl: number;
  totalContributionMl?: number;
  unknownContributionEventCount: number;
  activeEventCount: number;
  lastEventAt?: string;

  remainingMl?: number;
  progressStatus: "below" | "within" | "above" | "unknown";
  electrolyte: ElectrolyteAccounting;
  safetyFlags: string[];
  escalationIds: string[];
  explanations: Array<{
    id: string;
    audience: "user" | "coach" | "clinician" | "internal";
    title: string;
    plainLanguage: string;
    limitations: string[];
  }>;

  inputWatermark: string;
  computedAt: string;
  staleAt?: string;
};
```

## 6. Resolver: one plan, explicit precedence, no silent conflict resolution

### Stage 0 — authenticate and establish scope

1. Derive the subject from authenticated server identity.
2. For professional access, verify the active ProCare/client relationship and the clinician’s permitted scope.
3. Apply least-privilege projection rules before returning events, plans, or explanations.

### Stage 1 — load effective inputs

Load only active/effective inputs for the subject and date:

- selected baseline;
- clinician parameters/restrictions;
- approved condition-policy adapters;
- performance/activity context;
- pregnancy context;
- GLP-1 safety/tolerance context;
- raw hydration events and their current watermark.

### Stage 2 — normalize and validate

- Normalize all volumes to mL while retaining the original unit/value.
- Use the plan timezone to establish a local date boundary.
- Reject implausible/negative values according to approved validation rules.
- Deduplicate writes through `idempotencyKey`.
- Preserve unknown beverage/nutrient data as unknown.
- Expire clinician or policy inputs at their effective boundary.

### Stage 3 — resolve authority and conflicts

The proposed authority order is:

1. **Approved immediate safety escalation or hard ceiling**
2. **Active, scoped, unexpired clinician parameter/restriction**
3. **Approved condition policy**
4. **Performance/pregnancy/time-bound context modifier**
5. **User-selected target**
6. **Weight-derived baseline**
7. **Analytics-only comparison baseline**

Rules:

- Higher authority may constrain a lower one; it cannot silently delete a hard restriction.
- A ceiling, floor, timing block, and point target are different semantics and can coexist.
- Conflicting hard inputs must result in `needs_review` or `blocked`, never a numeric compromise invented by the resolver.
- Missing essential information should produce `provisional` or `monitor_only`, not false precision.
- Every applied, withheld, expired, or conflicting input receives a machine-readable rationale and a user-facing explanation.

### Stage 4 — produce plan and timing

Resolve an effective target **only when it is valid to do so**. Otherwise return a range, floor, ceiling, monitor-only plan, or blocked result. Calculate “remaining” only when the plan semantics permit it.

### Stage 5 — fold events into state

Aggregate raw event volume, contribution estimates, and electrolyte accounting independently. The output includes known values, unknown coverage, and confidence limitations.

### Stage 6 — apply safety overlays

GLP-1 remains a safety adapter, not a separate hydration ledger. Its existing symptom/risk/escalation behavior can consume the shared daily state and attach approved overlays/explanations without rewriting raw events or recalculating a competing target.

### Stage 7 — version, publish, and invalidate

Persist the plan/state snapshot with an input watermark and version. Publish a `hydration.state.updated` domain event keyed by subject, date, and state version so consumers invalidate stale caches rather than recomputing on their own.

## 7. Condition and context adapters

Each contributor provides structured facts or approved constraints. No contributor gets a private “hydration target” calculator.

| Contributor | May provide | Must not do |
| --- | --- | --- |
| GLP-1 | Medication/tolerance signals, approved hydration guardrail inputs, symptom-related escalation overlays, rule provenance. | Maintain a competing daily hydration total or alter raw events. |
| Performance | Session demand/context, permitted timing emphasis, validated activity inputs. | Prescribe electrolyte/sodium amounts without an approved policy. |
| Pregnancy | Stage and approved pregnancy-context constraints/modifiers. | Turn generic guidance into an undocumented medical fluid target. |
| Future Dysautonomia/POTS | A specific presentation, clinician parameters, restrictions, and approved policy inputs when governance is complete. | Become a “high sodium” toggle, bypass conflict resolution, or ship before clinical review. |
| Climate/wearables | Evidence/context only where data quality and consent support it. | Override clinician restrictions or imply a clinical diagnosis. |
| User preferences | Preferred target or timing preference. | Override a restriction, clinician parameter, or policy hard stop. |

## 8. Consumer contracts

All consumers read a compact projection from the same server-resolved plan/state.

### Biometrics / future Hydration Center

- Reads `EffectiveDailyHydrationPlan` and `HydrationDailyState`.
- Writes authenticated intake events using an idempotency key.
- Displays rationale, coverage, plan status, and remaining amount only when valid.
- Uses local storage only for temporary cache/optimistic presentation; it reconciles to `stateVersion` and never wins against the server.

### Nutrition Life Plan

- Reads plan status, explanations, trend projection, and relevant constraints.
- Does not recompute targets or aggregate water rows directly.

### Beverage Creator

- Receives an action brief: valid timing window, remaining range where applicable, beverage restrictions, permitted electrolyte policy, and explanation/label requirements.
- Uses existing medical guardrails to validate generated output.
- Cannot claim electrolyte replacement or clinical benefit without declared inputs and a valid policy.

### Coach’s Corner

- Receives aggregate state and controlled recommended actions, not raw event history unless authorized and required.
- Quotes the server explanation; it does not diagnose dehydration or derive a target in the language model.
- Can route a user to a suitable beverage action only within the resolved constraints.

### Meal generation

- Receives structured hydration context through the Protocol Envelope where relevant.
- May prefer fluid-supportive preparation/timing only when the policy allows it.
- Does not count food water toward measured fluid intake without explicit contribution provenance.

### ProCare

- Uses existing relationship gates and role authorization.
- Can create scoped, effective-dated, auditable clinician parameters after policy/governance approval.
- Reads only the client projection necessary for care.
- Parameter creation, change, expiration, override, and view events are auditable.

## 9. Proposed API boundary

Names are illustrative and should be finalized during implementation design.

```text
GET  /api/hydration/plan?date=YYYY-MM-DD
GET  /api/hydration/state?date=YYYY-MM-DD
GET  /api/hydration/history?from=...&to=...&cursor=...
POST /api/hydration/events
POST /api/hydration/events/:id/correction
POST /api/hydration/plan/preview
```

Rules for every endpoint:

- Subject identity comes from the authenticated session/token.
- `POST /events` accepts only intake fields, original unit/value, timestamp, source metadata, and `idempotencyKey`; it never accepts `subjectUserId`.
- Event correction/void is auditable; no silent historical mutation.
- `preview` may evaluate a user preference but cannot activate clinician authority.
- Professional endpoints use separately scoped paths/handlers and existing access verification; they do not rely on caller-provided client IDs alone.
- Responses include `planVersion`, `stateVersion`, and `inputWatermark` so clients can reconcile deterministically.

## 10. Migration from the current hydration system

This is a staged migration, not a big-bang replacement.

| Phase | Deliverable | Compatibility/safety gate |
| --- | --- | --- |
| 0 — Architecture approval | Approve this domain contract, authority rules, governance matrix, and clinical review boundaries. | No behavior change. |
| 1 — Data foundation | Create canonical event/audit schema and baseline/plan/state contracts. | Existing water UI remains unchanged. |
| 2 — Lossless event migration | Backfill `water_logs` to canonical `HydrationIntakeEvent` rows using `source=legacy_manual`, retained IDs/timestamps, and `beverageClass=water`. | No inferred electrolyte data or retrospective clinical labeling. |
| 3 — Shadow resolver | Compute server plan/state in shadow mode; compare only safe aggregates and instrument mismatches. | No consumer sees or acts on it. |
| 4 — Biometrics cutover | Replace local target/counter authority with server plan/state behind a feature flag. | Local storage becomes cache only; reconciliation is versioned. |
| 5 — GLP-1 adapter | Make the GLP-1 safety path consume shared aggregates while preserving existing escalation/rule behavior. | Parity suite must pass before removing any independent aggregation. |
| 6 — Context adapters | Add approved performance/pregnancy adapters and structured Protocol Envelope hydration context. | Conflicts return `needs_review`; no auto electrolyte prescription. |
| 7 — Consumer migration | Migrate Coach, Beverage Creator, Life Plan, meal surfaces, and ProCare one consumer at a time. | No consumer can retain a direct calculator after its cutover. |
| 8 — Deprecation | Retire old target authority, duplicate water aggregation, and prompt-only hydration claims. | Migration/backfill, telemetry, and regression gates pass. |

### Explicit deprecations or containment targets

- Biometrics local storage hydration goal/total as source of truth.
- A hard-coded 2,000 mL observer comparator as a recommendation.
- GLP-1 hydration aggregation as a parallel general hydration system.
- Prompt-only electrolyte rules or claims.
- Direct hydration math in Coach, builders, or individual feature pages.
- Any attempt to hide hydration data inside `DailyNutritionPrescription`; the domains are related but distinct.

## 11. Persistence, synchronization, security, and observability

### Persistence and synchronization

- PostgreSQL is authoritative for active plan inputs, immutable events, audit records, plan snapshots, and read-model state.
- A client may cache the latest state projection, but it sends events upward and receives server state downward.
- Every create request uses an idempotency key.
- The server generates monotonic event/state versions and cursors; client wall-clock time never determines conflict resolution.
- Version conflict behavior is explicit: a stale client re-fetches the server snapshot and never overwrites the active plan.
- Offline-first synchronization is a future deliberate capability, not an implicit v1 promise. If added, it needs a durable local outbox, idempotent replay, and a documented correction policy.

### Privacy and authorization

- Derive identity from authentication for all routes; never trust a body/query account ID.
- Enforce user ownership on events, plans, state, and history.
- Require active verified relationships and role scope for ProCare access.
- Return least-privilege projections: users see their own state; Coach gets aggregate/action context; generators get only constraints; professionals get authorized client detail.
- Audit clinician plan changes, clinician reads, event corrections/voids, safety overrides, and denied cross-account attempts.
- Treat pregnancy, medication/tolerance, symptoms, clinician plans, and electrolyte details as sensitive data subject to appropriate retention/deletion and access policies.

### Observability

Emit structured, privacy-safe telemetry for:

- plan/state resolution status, policy version, authority source, and input watermark;
- modifier/restriction application, withholding, expiry, and conflict;
- event acceptance, rejection, deduplication, correction, and void;
- state recomputation time and stale-cache rate;
- electrolyte coverage quality, missing-data rate, and `needs_review` rate;
- safety escalation count and cache invalidation failures.

Do not log raw medical notes, full intake histories, or sensitive explanations in generic application logs.

## 12. Regression and release gates

### Identity and access

- Unauthenticated event/plan/state/history access returns `401`.
- A body/query user ID cannot read or write another account.
- A revoked ProCare relationship fails immediately.
- User, Coach, generator, and clinician projections each omit unauthorized fields.

### Event correctness

- mL/oz/cup/l conversion retains the original value/unit and produces correct canonical mL.
- Local-date/timezone boundaries are stable around midnight and travel scenarios.
- Duplicate idempotency keys apply once.
- Correction and void behavior recompute state while retaining history/auditability.
- Backfill from legacy water logs is lossless and repeatable.

### Plan resolution

- Authority precedence holds for ceiling, clinician parameter, policy, context, self-set target, and baseline.
- Expired inputs fall through correctly.
- Conflicting hard restrictions yield `needs_review` or `blocked`; no arbitrary numeric result.
- Every effective value identifies a source, effective period, policy version, and explanation.
- A ceiling is never rendered as a “drink this much” target.

### State and cross-device behavior

- The same inputs create the same plan/state version.
- Unknown electrolyte information yields an unknown/partial coverage state, not zeros.
- Historical trend logic distinguishes a missing day from confirmed zero intake.
- A local cache cannot overwrite a newer server plan/state.
- A second device converges through server state/cursor after an event is recorded.

### Existing clinical and product regressions

- GLP-1 low-intake and symptom escalation behavior retains parity with the currently approved path.
- Performance/pregnancy context creates only approved modifiers and explanation text.
- Protocol Envelope propagates structured hydration context to every intended generator.
- Coach reads state and uses controlled actions; it does not recompute or diagnose.
- Beverage Creator observes restrictions and validates nutrient/electrolyte claims.
- No meal surface counts food water as measured fluid without explicit contribution provenance.

## 13. Required approvals before implementation

Implementation should not begin until these are resolved:

1. **Clinical governance:** approved baseline methodology, valid condition policies, safety escalation rules, clinician authority, and red flags.
2. **Conflict policy:** exact semantics for floor/ceiling/range coexistence and when `needs_review` blocks action.
3. **Professional permissions:** which roles can view events, set parameters, set ceilings, or override defaults.
4. **Data governance:** retention, deletion, export, audit, consent, and wearable/import policy.
5. **Product claims:** the language allowed for hydration/electrolyte recommendations and constraints.
6. **Migration acceptance:** lossless backfill criteria, shadow-mode metrics, rollout flags, and rollback behavior.

## 14. Recommended next step

Approve or amend this architecture first. Then create a separate implementation plan with:

1. a clinical-policy migration matrix,
2. an exact schema/migration design,
3. consumer-by-consumer rollout sequencing,
4. test fixtures and release gates,
5. clinician/legal review artifacts.

Until then, hydration changes should remain limited to correctness and data-isolation repairs, such as the completed authenticated ownership fix for water-log access.