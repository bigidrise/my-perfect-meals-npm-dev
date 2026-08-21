# Daily Hydration Plan — Technical Architecture Proposal

**Status:** Architecture review in progress — no Hydration Intelligence implementation is authorized by this document.  
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
  planRevision: number;
  supersedesPlanId?: string;
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
  calculationPolicyVersion: string;
  policyVersionManifest: Record<string, string>;
  inputSnapshotHash: string;
  missingData: string[];
  rationaleCodes: string[];
  explanationIds: string[];
  effectiveAt: string;
  supersededAt?: string;
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
  observedPlanId?: string; // What was active when the event was accepted; never changes event ownership.
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
  planTimeline: Array<{
    planId: string;
    planRevision: number;
    effectiveAt: string;
    supersededAt?: string;
    status: EffectiveDailyHydrationPlan["status"];
  }>;

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

## 7. Contract validation review — explicit answers before implementation

This section is the implementation gate. The rules below make plan behavior, history, and mid-day changes explicit.

### 1. What is persisted as the authoritative daily snapshot?

The server persists **three different authoritative records**, each for a different purpose:

1. **Immutable `HydrationIntakeEvent` rows** — the actual facts a user or authorized source logged, including original unit/value, occurred time, source, correction/void lineage, and idempotency key.
2. **Immutable `EffectiveDailyHydrationPlan` revisions** — the resolved plan facts for a user/date: target/range/ceiling semantics, timing windows, active input references, applied/withheld restrictions, policy-version manifest, calculation-policy version, explanation IDs, input snapshot hash, and effective/superseded times.
3. **Versioned `HydrationDailyState` read models** — current aggregate intake, remaining amount where valid, coverage, warnings, and plan timeline. These are persisted for efficient reads but are always reproducible from the event and plan-revision records.

The authoritative server history is therefore not one mutable “daily water total.” It is an event ledger plus an explainable plan-revision timeline.

### 2. What is dynamic versus frozen for the day?

| Frozen / append-only | Dynamically recalculated |
| --- | --- |
| Intake event facts and correction/void lineage | Current-day total intake from active events |
| Each resolved plan revision and its input/policy snapshot | Current remaining amount, only under the currently active plan revision |
| The plan revision effective interval | Current state projection, electrolyte coverage, and trend projection |
| The plan/policy version that governed a historical interval | Which revision is now active after a valid new input |
| The explanation available at the time of a historical decision | Cache/read-model state from the immutable ledger and timeline |

The implementation must **create a new plan revision**, never overwrite an earlier revision, when an input changes after a plan exists.

### 3. How are clinician-defined ceilings and ranges represented?

An active clinician instruction is stored as an effective-dated, auditable source input with:

- a target kind (`point`, `range`, `floor`, or `ceiling`);
- normalized `minimumMl`, `targetMl`, and/or `maximumMl`;
- timing scope (`daily`, `session`, `event`, or beverage);
- authority/source (`clinician`), author, rationale, review date, effective time, and expiration;
- any structured electrolyte/sodium limit only when an approved clinical policy and professional permission support it.

The resolver emits that instruction into the final plan as a structured restriction or target source. A clinician ceiling is not converted into an aspirational daily target.

### 4. How are conflicting modifiers resolved and explained?

The resolver first normalizes every contributor into a typed claim: target, range, floor, ceiling, timing rule, beverage block, electrolyte limit, or escalation trigger. It then:

1. applies hard safety restrictions;
2. applies active, scoped clinician restrictions;
3. applies approved condition policies;
4. applies compatible context modifiers;
5. applies preferences/baseline only inside the resulting safe envelope.

Every claim has an authority rank, effective interval, conflict group, policy version, and rationale code. Compatible claims are composed. Incompatible hard claims produce `needs_review` or `blocked` with an explanation that names the **kind of conflict** and the authority source; the resolver never silently averages, discards, or chooses by registration order.

### 5. What happens when a condition policy changes mid-day?

A policy change has a named version and an effective timestamp. If the change applies to an in-progress local day:

- the resolver creates a **new plan revision** effective at that timestamp;
- the previous revision remains immutable and visible in the plan timeline;
- the current state reprojects against the newly active revision;
- consumers receive a state-version invalidation and display the updated explanation;
- historical events remain unchanged and retain their `observedPlanId` where one was captured.

A policy update cannot retroactively rewrite an already-resolved plan interval. A true retrospective correction requires an explicit privileged correction workflow, audit record, correction reason, and a clearly labeled revised-history view.

### 6. What happens when a clinician updates a target mid-day?

The same revision rule applies, with stronger authority:

- the original clinician instruction and its resulting plan revision retain their effective interval;
- the new instruction creates a new effective-dated clinician input and a superseding plan revision;
- the current remaining value changes only from the new revision’s effective time forward;
- both the clinician-defined target and the effective resolved plan remain visible to the authorized professional;
- the user receives an explanation that their plan was updated, without exposing clinician-only detail.

No existing intake event is reassigned, deleted, or rewritten because a target changed.

### 7. How is historical hydration preserved when today’s rules differ?

History is queried by local date and plan-revision interval, not recalculated using today’s policy. A yesterday view shows:

- the event ledger as it existed after corrections/voids;
- the exact plan revision(s) active yesterday;
- the calculation-policy and contributor policy versions used;
- the target/range/ceiling semantics that actually applied;
- the adherence/progress interpretation valid for that historical interval.

This supports a future explanation such as: **“This state was resolved with Hydration Plan Policy v1.3 and clinician plan revision 4.”**

### 8. How does Beverage Creator consume current state without recalculating it?

The Beverage Creator calls/receives a server-produced **hydration action brief** derived from the current plan/state. It includes only:

- current plan/state IDs and versions;
- permitted timing/use window;
- remaining range when one is valid;
- applicable beverage blocks and nutrient/electrolyte constraints;
- electrolyte coverage limitations;
- approved explanation/label requirements.

The creator chooses and validates a beverage within that brief using its existing medical guardrails. It does not read raw events to calculate totals, select a hydration target, infer an electrolyte requirement, or override the resolver.

### 9. How does Coach’s Corner read the same state?

Coach’s Corner receives a compact, role-scoped projection of the same `HydrationDailyState` and action brief. It can cite approved plain-language explanations and offer controlled actions, such as opening Beverage Creator, but it cannot:

- calculate fluid remaining independently;
- infer hydration from unrelated behavior;
- diagnose dehydration;
- turn missing electrolyte data into an electrolyte recommendation.

Its response records the plan/state version it used for traceability.

### 10. How does ProCare see prescribed targets and actual adherence?

An authorized professional gets a dedicated, relationship-scoped projection containing:

1. **Clinician-defined inputs** — their effective-dated target/range/ceiling, rationale, review date, and status.
2. **Effective plan timeline** — what the resolver actually applied after all valid restrictions/conflicts.
3. **Actual intake/adherence** — event aggregate, correction status, coverage limitations, and adherence interpretation for each plan interval.

ProCare therefore never conflates “what was prescribed,” “what could safely be applied,” and “what was actually logged.”

### 11. How is electrolyte data handled honestly?

Electrolytes use a separate accounting projection. A beverage event contributes sodium, potassium, magnesium, or other nutrient values only when their source is declared (`label`, validated recipe nutrition, database, clinician entry, or explicitly labeled estimate) and its confidence is recorded.

The state returns `complete`, `partial`, `water_only`, or `not_tracked` coverage. It never represents unlogged or unknown electrolyte content as zero, and it never assumes equal hydration/electrolyte contribution from every beverage.

### 12. How do existing water logs and local-only targets migrate?

**Existing water logs**

- Backfill each row losslessly into a canonical event with original ID/timestamp, `source=legacy_manual`, `beverageClass=water`, and its exact normalized volume.
- Do not infer electrolytes, food contribution, or historical clinical context.
- Maintain temporary read compatibility while parity tests verify the new history projection.

**Local-only hydration totals and targets**

- Local storage is not silently imported as medical or historical fact.
- At cutover, the client reads the server plan/state first.
- If a current-day local total is higher than server-recorded intake, the user may confirm a single auditable manual adjustment; otherwise it remains only a discarded client cache.
- A local target becomes an optional user preference proposal only after user confirmation. It never overrides an active plan restriction or clinician instruction.
- After reconciliation, local storage can cache the latest server projection but cannot become authoritative again.

## 8. Condition and context adapters

Each contributor provides structured facts or approved constraints. No contributor gets a private “hydration target” calculator.

| Contributor | May provide | Must not do |
| --- | --- | --- |
| GLP-1 | Medication/tolerance signals, approved hydration guardrail inputs, symptom-related escalation overlays, rule provenance. | Maintain a competing daily hydration total or alter raw events. |
| Performance | Session demand/context, permitted timing emphasis, validated activity inputs. | Prescribe electrolyte/sodium amounts without an approved policy. |
| Pregnancy | Stage and approved pregnancy-context constraints/modifiers. | Turn generic guidance into an undocumented medical fluid target. |
| Future Dysautonomia/POTS | A specific presentation, clinician parameters, restrictions, and approved policy inputs when governance is complete. | Become a “high sodium” toggle, bypass conflict resolution, or ship before clinical review. |
| Climate/wearables | Evidence/context only where data quality and consent support it. | Override clinician restrictions or imply a clinical diagnosis. |
| User preferences | Preferred target or timing preference. | Override a restriction, clinician parameter, or policy hard stop. |

## 9. Consumer contracts

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

## 10. Proposed API boundary

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
- Responses include `planRevision`, `stateVersion`, `inputWatermark`, and the applicable calculation-policy version so clients can reconcile deterministically.

## 11. Migration from the current hydration system

This is a staged migration, not a big-bang replacement.

| Phase | Deliverable | Compatibility/safety gate |
| --- | --- | --- |
| 0 — Architecture approval | Approve this domain contract, authority rules, governance matrix, and clinical review boundaries. | No behavior change. |
| 1 — Data foundation | Create canonical event/audit schema and baseline/plan/state contracts. | Existing water UI remains unchanged. |
| 2 — Lossless event migration | Backfill `water_logs` to canonical `HydrationIntakeEvent` rows using `source=legacy_manual`, retained IDs/timestamps, and `beverageClass=water`. | No inferred electrolyte data or retrospective clinical labeling. |
| 3 — Shadow resolver | Compute server plan/state in shadow mode; compare only safe aggregates and instrument mismatches. | No consumer sees or acts on it. |
| 4 — Biometrics cutover | Replace local target/counter authority with server plan/state behind a feature flag. | Local storage becomes cache only; any current-day local total needs an explicit, auditable user-confirmed adjustment rather than a silent import. |
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

## 12. Persistence, synchronization, security, and observability

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

## 13. Regression and release gates

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
- A policy or clinician update mid-day creates a superseding revision and leaves the earlier revision explainable.
- Historical days remain pinned to their original plan-revision timeline and calculation-policy version.

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

## 14. Required approvals before implementation

Implementation should not begin until these are resolved:

1. **Clinical governance:** approved baseline methodology, valid condition policies, safety escalation rules, clinician authority, and red flags.
2. **Conflict policy:** exact semantics for floor/ceiling/range coexistence and when `needs_review` blocks action.
3. **Professional permissions:** which roles can view events, set parameters, set ceilings, or override defaults.
4. **Data governance:** retention, deletion, export, audit, consent, and wearable/import policy.
5. **Product claims:** the language allowed for hydration/electrolyte recommendations and constraints.
6. **Migration acceptance:** lossless backfill criteria, shadow-mode metrics, rollout flags, and rollback behavior.

## 15. Recommended next step

Approve or amend this architecture first. Then create a separate implementation plan with:

1. a clinical-policy migration matrix,
2. an exact schema/migration design,
3. consumer-by-consumer rollout sequencing,
4. test fixtures and release gates,
5. clinician/legal review artifacts.

Until then, hydration changes should remain limited to correctness and data-isolation repairs, such as the completed authenticated ownership fix for water-log access.