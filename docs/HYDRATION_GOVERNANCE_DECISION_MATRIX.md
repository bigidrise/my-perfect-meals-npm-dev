# Hydration Governance Decision Matrix

**Purpose:** Resolve the remaining policy and authority decisions before starting Task #1470.  
**Status:** Decision document only — no Hydration Intelligence implementation is authorized.  
**Companion documents:**

- `docs/DAILY_HYDRATION_PLAN_ARCHITECTURE.md`
- `docs/DAILY_HYDRATION_IMPLEMENTATION_GATE_REVIEW.md`
- `docs/POTS_INTEGRATION_DIAGNOSTIC.md`

## How to read this matrix

- **Group A** decisions define the legal/product semantics of the domain and must be affirmed before backend foundation work begins.
- **Group B** decisions do **not** prevent building generic, inactive infrastructure after Group A approval. They do prevent rules from being activated for users.
- A proposed default is intentionally conservative. “No automated rule,” “unknown,” and `monitor_only` are valid defaults; they are safer than inventing a medical value.
- “Current evidence” describes the existing MPM code and architecture audit. It is not a substitute for clinical evidence review.

---

## Group A — approve before backend foundation work begins

| Decision | Why it matters | Current evidence | Safe proposed MPM default | Alternatives | Risk if wrong | Approval owner | Blocks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **A1. What counts as a hydration intake event?** | Determines the canonical event schema, history, and what users believe the app is tracking. | `water_logs` contains manually logged water only. No current system reliably records all beverages or food water. | Canonical v1 accepts declared beverage volume, with `water` as the only legacy-confirmed class; all other classes retain their stated type and are not silently counted as water. | Water-only forever; include all nonalcoholic drinks; include food water. | Misstating intake, misleading adherence, unsafe clinical interpretation. | Mixed — product/engineering + dietitian/clinical governance | **Both** |
| **A2. How is partial hydration contribution represented?** | Prevents volume, hydration effect, and nutrition data from being treated as the same fact. | Existing rows provide mL only; no contribution model exists. Architecture separates intake from contribution. | Persist beverage volume; report `contribution=unknown` unless a declared, versioned method supports an estimate. | Treat all volume equally; estimate all beverages; water-only contribution. | False precision and inaccurate progress/coaching. | Mixed — product/engineering + dietitian/clinical governance | **Both** |
| **A3. Electrolyte data semantics** | Defines fields, coverage, labels, and whether nutrient amounts are facts or guesses. | Athlete beverage UI uses electrolyte-oriented prompt language; no canonical ledger or complete source coverage exists. | Store only declared/validated electrolyte values with source and confidence; return `not_tracked`, `water_only`, or `partial` rather than zero. | Manual-only logging; validated recipe/label import; full food-and-beverage nutrition integration. | Unsafe implied supplementation or false “zero” values. | Mixed — dietitian/clinical governance + product/engineering | **Both** |
| **A4. Clinician directive authority** | Determines who may create floor, target, range, ceiling, timing, and electrolyte restrictions and what they may affect. | ProCare has relationship/organization gates; no hydration directive model exists. | Only an explicitly authorized, actively linked professional may create an effective-dated directive; every change is audited and may be more restrictive but cannot silently bypass a hard safety policy. | Physician-only; role-specific physician/dietitian/trainer scopes; read-only clinical view. | Unauthorized treatment-like instructions or unsafe override behavior. | Mixed — physician/clinical governance + product/engineering | **Both** |
| **A5. User override authority** | Defines whether a preference can override clinical or safety constraints. | Existing Biometrics goal is browser-local; no current override hierarchy exists. | Users may set a **preference proposal** only. It can never override a clinician directive, hard restriction, `needs_review`, or `blocked` state. | Fully user-controlled wellness target; clinician-approved exceptions; no user preference field. | Users unknowingly defeat a safe ceiling or restriction. | Mixed — product/engineering + physician/clinical governance | **Both** |
| **A6. Conflict precedence and composition** | The resolver needs approved behavior when inputs disagree. | Existing clinical mode ordering is meal-oriented, not a hydration conflict policy. The architecture requires typed claims and no array-order resolution. | Hard safety restriction → active clinician restriction → approved condition policy → compatible context modifier → user preference → baseline. Any incompatible hard claims do not compose. | Different clinician/policy ordering; manual-review-first model for all multi-condition users. | A lower-priority target silently defeats a safety constraint. | Physician/clinical governance, with engineering implementation review | **Both** |
| **A7. `needs_review` behavior** | Governs what a user sees when a valid plan cannot be safely resolved. | No current common hydration state/status exists. Architecture treats conflict as a first-class outcome. | Do not display a target/remaining amount; preserve event logging; show neutral “plan needs review” explanation and allowed next action. | Fall back to baseline; block all logging; route automatically to clinician. | Misleading target or unnecessary denial of harmless logging. | Mixed — physician/clinical governance + product/engineering | **Both** |
| **A8. `blocked` behavior** | Separates a high-risk action stop from uncertainty. | No canonical blocked hydration action contract exists. | Do not present a target, remaining amount, or hydration-oriented beverage action; preserve immutable event history and show approved escalation/care guidance. | Permit user logging only; clinician override only; emergency-only handling. | Encouraging a contraindicated action or hiding important history. | Physician/clinical governance | **Both** |
| **A9. Mid-day clinician change semantics** | Determines plan revision history and what “remaining” means after a change. | Architecture specifies immutable plan revisions; no current hydration revision model exists. | New effective-dated directive creates a superseding plan revision. Earlier events/revisions remain unchanged; current state uses the active revision. | Apply only next day; retroactively rewrite today; require manual review. | Loss of auditability or confusing historical adherence. | Mixed — physician/clinical governance + product/engineering | **Both** |
| **A10. Mid-day policy-change semantics** | Determines whether a clinical-rule update rewrites past explanations. | Existing GLP-1 daily tolerance uses mutable upserts; architecture requires policy-version history. | New policy version creates a new revision from its effective time. Past intervals stay pinned to their original policy manifest. | Apply policy next day; retrospectively re-evaluate history; manual correction workflow. | Historical records become unexplainable or misleading. | Mixed — physician/clinical governance + product/engineering | **Both** |
| **A11. ProCare hydration permissions and consent** | Determines role scope, professional/client visibility, directive rights, and audit requirements. | Existing delegated water-log access verifies physician-client relationship; broad hydration role policy does not exist. | Deny by default. Reuse active relationship and organization isolation; grant read/write/directive scopes only after role/consent approval and audit every professional read/change. | Physician-only; physician + dietitian; read-only trainer/coach views; client opt-in sharing. | Inappropriate disclosure or unauthorized clinical action. | Mixed — product/engineering + physician/clinical governance | **Both** |
| **A12. Legacy water-log migration acceptance** | Sets what proof is required before legacy data becomes canonical events. | `water_logs` is real user data but lacks beverage, contribution, timezone, correction, and plan metadata. | Lossless, repeatable event backfill only; preserve IDs/timestamps/mL; mark as `legacy_manual` water; no clinical inference. Require parity, rollback, and audit acceptance before cutover. | Keep permanent compatibility adapter; migration by date cohort; no historical backfill. | Data loss, duplicated intake, or invented clinical history. | Product/engineering, with clinical confirmation of non-inference rule | **Backend migration only** |

### Group A approval statement

Backend foundation work is safe to begin only when the owners affirm that:

1. the platform may preserve uncertainty rather than fabricate clinical meaning;
2. user/professional authority and conflict statuses behave as above or through an approved alternative;
3. legacy data will be migrated only as factual water events, not transformed into invented clinical history.

---

## Group B — infrastructure can be built, but these rules cannot activate without approval

| Decision | Why it matters | Current evidence | Safe proposed MPM default | Alternatives | Risk if wrong | Approval owner | Blocks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **B1. Baseline daily hydration policy** | Determines whether MPM can show an actionable target at all. | The coaching observer’s 2,000 mL value is explicitly investigation-only. Biometrics’ weight formula is browser-local, not clinically governed. | `monitor_only` unless an approved policy or clinician directive supplies a target/range. | Evidence-based universal wellness baseline; clinician-only target; user-selected wellness baseline. | Unsupported medical/wellness claim or unsafe default. | Physician/clinical governance + dietitian/nutrition governance | **Clinical activation only** |
| **B2. Body-size inputs** | Determines whether and how weight/height/body composition influence a baseline. | `latestWeight` is used only by a legacy local formula; no approved server calculation exists. | Store body size as optional provenance input; do not derive a target until a formula, population, units, validation, and review policy are approved. | Weight-only formula; body-surface-area approach; no body-size use. | Invalid targets for populations the formula does not fit. | Mixed — physician/clinical governance + dietitian/nutrition governance | **Clinical activation only** |
| **B3. Activity/performance adjustment** | Determines if workload/session data increases, times, or otherwise changes a plan. | MPM has a mature performance-demand engine but no approved hydration adjustment model. | Permit a structured performance-context record and explanation; do not change volume/electrolyte targets automatically. | Session-timed fluid guidance; validated wearable/exertion adjustment; clinician-defined athletes only. | Over/under hydration and inappropriate electrolyte advice. | Mixed — physician/clinical governance + dietitian/nutrition governance | **Clinical activation only** |
| **B4. Climate/heat adjustment** | Determines if temperature, humidity, elevation, or location alter a plan. | No approved climate data source, consent model, or MPM adjustment algorithm exists. | No automatic climate adjustment. Allow a future context input only after source-quality, privacy, and policy approval. | User-reported heat; weather API; wearable/environment source. | Location/privacy issues and false precision from poor environmental data. | Mixed — product/engineering + physician/clinical governance | **Clinical activation only** |
| **B5. Pregnancy modification** | Current pregnancy wording could be mistaken for an individualized plan. | Pregnancy generator includes fixed glass-range language; no hydration policy/revision source exists. | Do not change hydration target automatically. Preserve pregnancy context and require an approved pregnancy policy or clinician directive for activation. | Trimester-specific range; symptom-aware rule; clinician-only directives. | Harmful generic advice in a higher-risk population. | Physician/clinical governance + dietitian/nutrition governance | **Clinical activation only** |
| **B6. GLP-1 modification** | GLP-1 symptoms and tolerance are relevant but do not automatically define a general plan. | GLP-1 resolver already aggregates water rows and symptoms for safety overlays; it is condition-specific and mutable. | Keep existing safety workflow unchanged; expose GLP-1 as a typed observation/overlay candidate, not an automatic volume target. | Approved hydration floor; symptom-triggered escalation only; clinician-defined target. | Conflicting medication/symptom advice or unsafe target. | Physician/clinical governance | **Clinical activation only** |
| **B7. Future POTS/dysautonomia modification** | POTS is heterogeneous and can conflict with renal, cardiac, liver, pregnancy, diabetes, GLP-1, and GI contexts. | Diagnostic explicitly rejects a “high sodium” toggle or standalone builder; no approved policy exists. | No POTS rule, sodium target, or automatic modification. Support only future typed placeholders and clinician-governed directives. | Dysautonomia family policy; presentation-specific clinician parameters; no automated support. | Serious clinical harm from simplistic sodium/fluid advice. | Physician/clinical governance | **Clinical activation only** |
| **B8. Renal/cardiac/liver/fluid-restriction precedence** | Defines hard restriction behavior against baseline, performance, and other requests. | Beverage guardrails recognize condition families; no unified hydration restriction policy exists. | Treat approved restrictions as hard constraints and return `needs_review`/`blocked` when they conflict; activate no numeric rule until approved. | Condition-specific ceilings; clinician-only constraints; universal conservative block. | Direct contradiction of fluid/sodium restrictions. | Physician/clinical governance | **Clinical activation only** |
| **B9. Caffeine treatment** | Caffeinated drinks may be logged, but their contribution and safety meaning are policy questions. | No canonical beverage/contribution model or caffeine policy exists. | Record declared caffeine only when available; do not automatically add/subtract hydration contribution or modify plan. | Count all fluid; partial contribution model; exclude caffeinated beverages. | Misleading intake/progress or inappropriate advice. | Dietitian/nutrition governance + physician/clinical governance | **Clinical activation only** |
| **B10. Alcohol treatment** | Alcohol needs separate safety semantics and should not be hidden inside fluid totals. | Beverage medical guardrails treat alcohol conservatively; no hydration ledger policy exists. | Persist declared alcohol classification separately when logged; do not count it toward hydration contribution or use it to generate a hydration recommendation. | Exclude from tracking; record intake only; approved contribution model. | Normalizing alcohol as hydration or concealing relevant context. | Mixed — physician/clinical governance + dietitian/nutrition governance | **Clinical activation only** |
| **B11. Electrolyte target/limit activation** | The data model can record nutrients, but values/limits imply clinical advice. | Existing UI may request electrolytes; no approved target, ceiling, or coverage policy exists. | No numeric electrolyte target or recommendation. Show only declared amounts and coverage after Group A semantics are approved. | General wellness targets; performance-specific targets; clinician-only limits. | Unsafe supplementation or contraindicated recommendations. | Physician/clinical governance + dietitian/nutrition governance | **Clinical activation only** |
| **B12. User-facing explanation language** | “Goal,” “remaining,” “dehydrated,” and “hydration support” can be interpreted clinically. | Observer explicitly avoids diagnosing dehydration/causality; legacy UI says “goal reached.” | Use neutral language for `monitor_only`, uncertainty, and pending review. Display target/remaining only when a valid approved plan revision exists. | Wellness-first language; clinical-detail display; clinician-only detail. | Unsupported claim, unnecessary alarm, or unsafe reassurance. | Mixed — product + physician/clinical governance + dietitian/nutrition governance | **Clinical activation only** |

---

## Decisions already settled by the architecture

These are engineering invariants, not requests for medical threshold decisions:

1. **Immutable intake events:** corrections/voids create lineage; they do not erase facts.
2. **Immutable plan revisions:** mid-day input changes create superseding revisions.
3. **Versioned policy logic:** historic views retain their policy/version manifest.
4. **One server-resolved plan:** no feature gets an independent calculator.
5. **Authenticated ownership:** server routes derive the subject from authentication; ordinary self-service client requests do not select an account.
6. **Account-safe client rendering:** local account identity remains in cache keys and stale-response guards.
7. **No destructive migration:** preserve `water_logs`; backfill only factual water events.
8. **No silent local-storage import:** client-only totals require explicit current-day user confirmation.
9. **No false electrolyte precision:** unknown/partial coverage stays explicit.

## Recommended approval sequence

1. **Approve Group A** or amend its safe defaults. This authorizes the backend contract work, not clinical activation.
2. **Record Group B decisions individually** with owner, policy/version ID, effective date, evidence source, and review date.
3. Begin Task #1470 only after Group A approval.
4. Build Phase 1 as inactive/server-authoritative infrastructure first.
5. Activate a rule only after its corresponding Group B decision has clinical/nutrition sign-off.

## Decision record template

Use this compact record for every approved or rejected item:

```text
Decision ID:
Matrix row:
Decision:
Chosen option:
Owner(s):
Evidence reviewed:
Policy/version ID:
Effective date:
Review/expiry date:
Activation scope:
Risks accepted:
Audit/communication notes:
```

Until Group A is approved, Task #1470 remains on hold.