# POTS Integration Diagnostic — My Perfect Meals

**Status:** Research and architecture review only  
**Scope:** No product, database, or clinical-rule changes are proposed by this document.  
**Clinical boundary:** This is product-safety analysis, not medical advice or a substitute for an individual's care team.

## Executive recommendation

**Recommended architecture: C — a dysautonomia-family condition model that activates a constrained, POTS-specific protocol overlay.**

POTS should not be a dedicated meal builder or an automatic “high-sodium diet” mode. POTS is a form of dysautonomia, so MPM should represent **Dysautonomia / Autonomic Conditions** as the clinical family and **POTS** as a specific condition/presentation within it. MPM's existing architecture is already designed for a primary clinical mode plus additive protocol modifiers. A POTS overlay fits that additive pattern when, and only when, it uses clinician-defined instructions or conservative, non-prescriptive support.

The central safety rule is:

> A self-reported POTS diagnosis must never automatically create a sodium, fluid, electrolyte, caffeine, or carbohydrate target.

Clinical sources commonly include greater fluid and sodium intake among first-line non-pharmacologic POTS treatments, but POTS is heterogeneous and those changes can conflict directly with renal disease, cardiac disease or fluid restriction, hypertension, liver disease with fluid retention, pregnancy care, and individualized medication plans. A product cannot turn a general guideline into a universal prescription.

## 1. Current MPM architecture map

### Profile and onboarding

- `shared/types/profile.ts` holds the lightweight normalized medical-condition and dietary profile taxonomy.
- `ExtendedOnboarding.tsx` separately assigns a meal-builder experience (for example diabetic, GLP-1, anti-inflammatory, performance) rather than making every condition a standalone builder.
- `AuthContext.tsx` already transports richer clinical context, specialty conditions, and clinical categories than the lightweight profile type alone.

**Implication:** MPM should introduce a **Dysautonomia / Autonomic Conditions** family and display **“POTS — Postural Orthostatic Tachycardia Syndrome”** as a specific condition beneath it. It should not add a new main builder choice.

### Protocol and meal-generation layer

- `shared/clinical/clinicalModeResolver.ts` resolves a primary clinical mode and additive modifiers. Its stated priority is liver disease, renal disease, cardiac disease, liver support, and anti-inflammatory; diabetes, GLP-1, post-bariatric, low-sodium, and thyroid are additive rather than mode-replacing.
- `shared/clinical/guardrails.ts` supplies hard blocks, soft discouragements, and prompt guidance by clinical mode.
- `server/services/protocolEnvelope.ts` is the central assembly point that carries the applicable clinical identity and rules into generation.

**Implication:** POTS should be an additive overlay that can contribute only explicitly permitted guidance blocks. It should never become the primary clinical mode ahead of renal, cardiac, liver, or other organ-safety protocols.

### Hydration, coaching, professional controls, and persistence

- Hydration monitoring presently centers on water logs (`hydrationObserver.ts`) and does not infer electrolyte intake.
- Beverage generation already passes through medical beverage rules (`server/services/guardrails/beverageMedicalRules.ts`).
- Coach's Corner is structured to consume authoritative clinical direction rather than permit the model to invent medical advice (`server/routes/coachCorner.ts`).
- Professional macro/prescription targets have an established provenance-oriented path through `macroResolver.ts` and `prescriptionResolver.ts`.
- Saved meals and weekly boards retain clinical provenance through `meta.clinicalMode` and medical badges. Weekly-board metadata currently focuses on the primary clinical mode and can lose additive-modifier detail.

**Implication:** MPM has a viable path for professional-origin targets and meal-level explanations, but it does **not** have electrolyte tracking or a safe generic mechanism for auto-derived sodium/fluid targets. Persisted clinical metadata must be extended to record the applied POTS overlay and its source, without storing unnecessary health narrative.

## 2. Evidence-based POTS nutrition findings

### Well-supported clinical-management context

1. A 2022 CMAJ review lists water at **3 L/day** and salt at **5 mL/day (2 tsp/day)** among treatments started at an initial POTS visit, alongside compression; it also describes POTS as a heterogeneous syndrome with multiple causes.  
   Source: Raj et al., *Diagnosis and management of postural orthostatic tachycardia syndrome*, CMAJ 2022, doi:10.1503/cmaj.211373.
2. Cleveland Clinic's clinical review describes a graded treatment approach that begins with fluid/salt intake, exercise, and compression, and presents water/sodium amounts as clinical treatment guidance.  
   Source: Wells et al., *Evaluating and managing postural tachycardia syndrome*, Cleveland Clinic Journal of Medicine 2019.
3. A nutrition-focused review from Mayo Clinic authors documents that GI and systemic symptoms can interfere with meeting nutrition and hydration needs in POTS.  
   Source: Ganesh et al., *Postural Tachycardia Syndrome: Nutrition Implications*, Nutrition in Clinical Practice 2020, doi:10.1002/ncp.10564.

### What this means for product design

- These findings support **clinician-configured POTS hydration/sodium guidance**, not automatic MPM prescriptions.
- A patient may need support for hydration planning, nutrition adequacy, nausea, early satiety, food tolerance, or routine planning. Those needs should be represented as individual instructions or preferences, not inferred from the diagnosis.
- GI symptoms are common enough to justify a dedicated “symptom/tolerance context” in any future POTS protocol, but not to assume any individual has gastroparesis, IBS, malnutrition, or a food-trigger profile.

### Conditional, limited, or subtype-dependent areas

- **Meal size/frequency and carbohydrate load:** Post-prandial symptoms and carbohydrate-related symptom patterns are reported in POTS literature and practice discussions, but the evidence is not a basis for a universal low-carbohydrate or small-meals protocol. MPM may support a clinician-specified or user-selected meal-pattern preference; it should not impose one from diagnosis alone.
- **Electrolyte products:** Appropriate formulation, sodium quantity, sugar content, potassium content, and frequency depend on the clinical plan and coexisting conditions. MPM should not label a beverage “POTS-safe” or recommend a universal electrolyte product.
- **Caffeine and alcohol:** These may worsen symptoms for some people and are reasonable topics for individualized coaching, but MPM should not infer a blanket prohibition or treat either as a medical treatment.
- **Exercise/performance nutrition:** Exercise can be part of POTS management, but its modality, progression, and fueling plan must be individualized. Performance Mode must not treat a POTS diagnosis as a reason to raise fluids/electrolytes automatically.

## 3. POTS heterogeneity and what MPM may infer

MPM may infer only that a person has identified POTS as part of their health context. It may **not** infer:

- POTS subtype or severity;
- blood volume status;
- appropriate fluid, sodium, electrolyte, carbohydrate, or caffeine target;
- medication regimen or whether a medication should be changed;
- presence or absence of hypertension, fluid retention, renal dysfunction, cardiac disease, pregnancy complications, GI dysmotility, or exercise tolerance;
- that symptoms are caused by POTS rather than another condition.

The POTS overlay should have three operational states:

1. **Context only:** POTS is recorded, but no clinician-defined nutrition instructions exist. MPM can provide limited education, preserve the condition in coaching context, and ask the person to add instructions from their care team. It makes no POTS-specific numeric adjustment.
2. **Clinician-defined protocol:** A professional has entered approved fluid, sodium, electrolyte, restriction, and/or meal-pattern parameters. MPM can operationalize only those parameters and must label their source.
3. **Restricted / conflict review:** A higher-priority restriction or unresolved conflict exists. POTS-specific adjustments are disabled until a professional instruction resolves the conflict.

## 3A. Dysautonomia/POTS conditional decision tree

The governing architecture principle is:

> Conditions do not directly prescribe food. They activate a conditional decision tree that resolves the effective instruction before MPM generates a meal, beverage, recommendation, or coaching response.

Johns Hopkins identifies POTS as a form of dysautonomia and notes variation in presentation, including different blood-pressure responses on standing. Dysautonomia International likewise frames sodium/fluid changes as individualized rather than appropriate for every person or presentation. These sources reinforce that MPM must not treat “POTS” as a nutrition rule.

```text
Dysautonomia / autonomic-condition context
  → Is POTS the recorded condition/presentation?
     → Is there a clinician-approved, current nutrition/hydration plan?
        → No: context-only; no numeric sodium/fluid/electrolyte action
        → Yes: identify each typed instruction and its authority
           → Are organ-safety restrictions or clinician ceilings active?
              → Yes: restriction wins; withhold conflicting POTS adjustment
              → No: continue
           → Is there a pregnancy, medication, GI, metabolic, or performance interaction?
              → Unresolved: request clinician resolution / use conservative default
              → Resolved: apply only the compatible portion of the POTS plan
           → Generate/validate against the effective instruction set
           → Persist the applied or withheld rationale for patient and clinician
```

### Presentations and factors the engine must represent as unresolved context, not infer

- **POTS presentations:** literature often discusses neuropathic, hyperadrenergic, hypovolemic, and secondary/associated presentations. These labels can overlap and are not safe for MPM to assign from symptoms or a diagnosis alone.
- **Blood-pressure response:** a person may have low blood pressure, normal blood pressure, or increased blood pressure on standing. MPM must obtain any relevant treatment direction from the care team rather than deduce salt/fluid strategy.
- **Associated conditions:** POTS can coexist with GI disease/symptoms, autoimmune disease, asthma, migraine, connective-tissue conditions, diabetes, food allergy/intolerance, and other disorders. A co-occurrence is not permission to infer a diet, food restriction, or causal explanation.
- **Medication and treatment plan:** medication classes and clinician treatment instructions can materially alter fluid, sodium, blood-pressure, appetite, and exercise considerations. MPM must not interpret medication lists, recommend changes, or derive targets from them; the clinician plan is the only executable source.

## 4. Conflict hierarchy

The effective order should be:

1. **Emergency or red-flag safety:** Stop nutrition coaching and direct the person to appropriate urgent/emergency care messaging.
2. **Explicit clinician restrictions and individualized prescriptions:** These override every inferred or generalized POTS consideration.
3. **Organ-safety restrictions:** renal disease, heart failure/cardiac fluid restriction, clinically relevant hypertension/low-sodium plan, and liver disease with fluid-retention considerations block automatic sodium/fluid changes.
4. **Pregnancy and active treatment contexts:** pregnancy, oncology treatment, post-bariatric care, and significant GI/nutrition-support contexts require their protocol and care-team instructions to govern.
5. **Metabolic and medication overlays:** diabetes/prediabetes and GLP-1 retain their metabolic, glucose, nausea, and meal-tolerance rules. They do not authorize POTS sodium/fluid changes.
6. **POTS clinician-defined overlay:** Applies only the parameters explicitly supplied and only if no higher restriction conflicts.
7. **Preferences and optimization:** cuisine, meal timing, meal pattern, performance preferences, and ordinary personalization apply last.

### Required system behavior by situation

| Situation | MPM behavior |
| --- | --- |
| POTS only, no professional parameters | Context only; no numeric sodium/fluid/electrolyte adjustment. Invite the person to add care-team guidance. |
| POTS plus clinician-entered targets, no conflict | Apply only those targets and show the source/explanation. |
| POTS plus renal disease, heart failure, fluid restriction, low-sodium plan, uncontrolled blood pressure concern, or liver fluid-retention context | Do not add POTS sodium/fluid guidance. Mark as conflict review and require professional instructions. |
| POTS plus diabetes/prediabetes or GLP-1 | Preserve glucose and medication-tolerance rules. A clinician-defined POTS plan can operate only where it does not contradict them. |
| POTS plus pregnancy | No automatic protocol. Require obstetric/cardiology/autonomic-care instructions before nutritional adjustments. |
| POTS plus Crohn's/IBD, substantial nausea, vomiting, early satiety, or food intolerance | Do not infer a POTS diet. Use the GI protocol and professional/patient tolerance plan; POTS may remain explanatory context. |
| POTS plus food allergy/intolerance | Allergy protection remains non-negotiable and precedes all POTS behavior. |

Heart-failure literature itself emphasizes individualized sodium/fluid decisions rather than a universal target. That reinforces the product rule above.  
Source: Mullens et al., *Dietary sodium and fluid intake in heart failure*, European Journal of Heart Failure 2024, PMID 38606657.

## 5. Recommended POTS overlay data model

This is a conceptual model, not a schema proposal.

### Condition record

- condition: `pots`
- display category: `Autonomic / Circulatory Conditions`
- source: user-reported or professional-confirmed
- status: context-only, clinician-defined, conflict-review, inactive

### Professional instruction payload

All values are optional and must retain author, timestamp, status, and scope:

- daily fluid target or range;
- sodium target or range;
- electrolyte plan and relevant restrictions;
- meal-frequency / meal-size instruction;
- clinician-approved carbohydrate or post-prandial guidance, if any;
- caffeine/alcohol instruction, if any;
- GI/tolerance guidance;
- explicit contraindications or “do not optimize automatically” flag;
- free-text professional instruction, displayed as instruction rather than transformed into a new inferred rule.

### Provenance requirements

Every generated or recommended item influenced by this payload must retain:

- `POTS overlay applied: yes/no`;
- source: clinician-defined, user preference, or context-only;
- exact non-sensitive decision category, such as “meal pattern adjusted,” “beverage evaluated against clinician electrolyte guidance,” or “POTS adjustment withheld because of fluid/sodium restriction”;
- active conflicting protocol(s), when withholding an adjustment is the reason.

## 6. Professional / ProCare controls

ProCare should be the only place MPM permits actionable numeric POTS parameters. The professional control should:

- require an identified professional relationship and existing clinical access policy;
- display the competing conditions and current effective restrictions before enabling POTS targets;
- require a clinician to confirm or explicitly override a detected conflict;
- support review, expiration/review date, and deactivation;
- preserve who supplied each instruction and when;
- avoid medical diagnosis claims, medication management, or automated therapeutic recommendations.

User-entered data should remain visible to the user but be treated as **context or a request for review**, not as a numeric treatment order.

## 7. User onboarding and consent requirements

1. Add a **Dysautonomia / Autonomic Conditions** family with “POTS — Postural Orthostatic Tachycardia Syndrome” as a specific condition/presentation.
2. After selection, explain plainly that nutrition guidance for POTS varies and may conflict with other conditions.
3. Ask whether the person has written nutrition/hydration instructions from their care team.
4. If no instructions exist, record context only; do not ask MPM to calculate a sodium/fluid target.
5. If instructions exist, allow the user to store them as reference and invite clinician confirmation where ProCare is available.
6. Show a prominent conflict/review state if the profile includes a sodium/fluid-sensitive condition.

## 8. Integration matrix

| Surface | Recommended future behavior | Do not do |
| --- | --- | --- |
| Meal generation / Create With Chef / Recipe Maker | Consume only effective, conflict-resolved POTS guidance through the existing protocol envelope. | Invent a “POTS meal,” force sodium, or change macros from diagnosis alone. |
| Beverage creator | Evaluate against clinician-defined fluid/electrolyte and existing sugar/potassium/medical constraints. | Recommend electrolyte beverages by default or call products POTS-safe. |
| Grocery Store Coach | Explain whether an item fits a specific approved target or restriction. | Rank high-sodium products as broadly beneficial for POTS. |
| Weekly Meal Board | Persist applied overlay provenance and all effective additive modifiers. | Store only a primary mode and lose the POTS/conflict explanation. |
| Restaurant / fast-food tools | Preserve restrictions and explain when POTS optimization is withheld. | Make sodium-seeking recommendations without a resolved clinical plan. |
| Craving, dessert, beverage creators | Honor the same resolved envelope as core generation. | Bypass conflict controls because these are “lighter” tools. |
| Coach's Corner | Provide bounded education, prompt for care-team instructions, and use clinician-defined targets. | Diagnose, prescribe, manage emergency symptoms, or alter medication advice. |
| Nutrition Life Plan | Show context, care-team goals, and progress only against approved targets. | Create new targets from generic POTS guidance. |
| ProCare dashboard | Surface status, conflicts, author, review date, adherence/support signals, and provenance. | Turn MPM into autonomous clinical protocol management. |
| Saved Meals / Favorites | Store a concise explanation that a resolved POTS overlay affected the result. | Imply ongoing suitability after the clinical plan changes. |
| Image generation, generic discovery, allergy scanning | No POTS-specific behavior beyond inherited diet/ingredient constraints. | Create a separate POTS aesthetic, badge, or unsupported food claims. |

## 9. Safety boundaries and red flags

MPM must not:

- diagnose POTS or its subtype;
- prescribe sodium, fluid, electrolytes, caffeine changes, carbohydrate restrictions, or treatment;
- recommend medication changes, IV fluids, compression, exercise treatment, or emergency management;
- interpret a symptom flare as POTS;
- override a clinician restriction;
- claim that a meal, beverage, supplement, or grocery product treats POTS.

Coach's Corner should stop routine nutrition coaching and direct the user to appropriate medical care for emergency symptoms, severe or worsening symptoms, inability to keep fluids down, fainting/injury, chest pain, severe shortness of breath, new neurologic symptoms, signs of significant dehydration, or other explicit care-team red flags. Exact copy requires clinical/legal review.

## 10. Implementation phases — only after clinical approval

### Phase 0 — Clinical governance (required before production work)

- Obtain clinical review of the proposed hierarchy, onboarding wording, red flags, professional roles, and conflict gates.
- Define the legal/medical review standard for clinician-entered instructions and contraindication review.

### Phase 1 — Context-only support

- Add the condition taxonomy and transparent education.
- Introduce conflict detection and “no automatic adjustment” behavior.
- Do not add numeric targets or food-generation changes.

### Phase 2 — Professional-defined protocol

- Add scoped ProCare instructions, approval, provenance, review dates, and conflict resolution.
- Make the existing protocol envelope carry only resolved instructions.
- Persist explainability across saved meals and weekly boards.

### Phase 3 — Carefully bounded surface integration

- Connect resolved instructions to meal, beverage, grocery, board, restaurant, and coaching surfaces.
- Add scenario-based clinical safety tests for every conflict pair.

### Phase 4 — Outcomes and safety monitoring

- Audit withheld versus applied adjustments, professional overrides, user comprehension, and coaching red-flag routing.
- Re-evaluate whether hydration/electrolyte tracking is clinically appropriate before building it.

## 11. Open clinical and product questions

1. Which professional roles may enter or approve POTS nutrition parameters under MPM's ProCare policy?
2. What confirmation is necessary before user-entered care instructions become operational?
3. Which POTS-related symptom red flags should use urgent-care versus emergency-care wording, and what localization/legal review is required?
4. Should clinicians be able to define meal pattern guidance without a numeric fluid/sodium plan?
5. What data minimization, retention, and audit rules apply to these high-sensitivity clinical instructions?
6. Can weekly-board and saved-meal provenance retain all additive overlays without breaking existing clinical metadata consumers?
7. Is any future electrolyte tracking worthwhile, or does it create more clinical risk than product value?

## 12. Hydration architecture audit

### Current end-to-end flow

```text
General hydration target
  └─ My Biometrics calculates a weight-based target and stores target/progress locally
     (`client/src/pages/my-biometrics.tsx`)
       ├─ visible daily progress UI
       └─ local reset action

Water logging
  └─ My Biometrics POSTs additions to /api/water-logs
     └─ water_logs database rows (`shared/schema.ts`)
        ├─ seven-day history is fetched back to the Biometrics chart
        └─ hydrationObserver reads logs for coaching evidence
           └─ uses a fixed 2,000 mL investigation baseline

Separate GLP-1 path
  └─ GLP-1 Hub stores hydrationMinMl in GLP-1 guardrails
     └─ tolerance resolution can use symptoms/logs in the GLP-1 protocol path
```

### Where the chain breaks

| Intended link | Current result |
| --- | --- |
| Target → durable clinical profile | **Broken for general hydration.** The normal target is calculated and retained in local browser storage, not in a server-side target model. |
| Logged intake → target progress | **Partially broken.** Logs persist to `water_logs`, but the progress counter is local; resetting it does not reconcile or remove stored log rows. |
| Logged intake → cross-device experience | **Partial.** The history is server-backed, but the general target/current-counter state is browser-local and can differ by session/device. |
| Logged intake → recommendation engine | **Partial and non-clinical.** `hydrationObserver.ts` can inspect water logs, but uses a fixed 2,000 mL investigation baseline and explicitly is not a clinical prescription. |
| Logged intake → Coach's Corner / Life Plan | **Broken.** The audit found no reliable flow that gives those surfaces a resolved “today versus your target” hydration state. |
| Logged intake → Beverage Creator / meal generation | **Broken for general hydration.** Beverage rules can use medical guidance, but they do not receive current water intake or a unified hydration target. Meal generation does not consider hydration status. |
| Logged intake → ProCare | **Broken.** There is no clinician-facing hydration history/target/plan path in the general hydration architecture. |
| Electrolyte intake → daily state | **Absent.** Electrolyte language appears in some generation guidance, but intake is not durably measured or reconciled against a target. |

The current route implementation also takes `userId` from the request body/query rather than deriving it from the authenticated user (`server/routes/waterLogs.ts`). That is a data-isolation concern that must be resolved before water logs can participate in clinician-managed protocols.

### Classification

**B — partially connected, with a cosmetic/tracker-like general target experience.**

There is meaningful functionality: water events are persisted, seven-day history is available, and the coaching observer can read real logs. It is not merely a visual progress ring. However, the system lacks a durable general target, a server-authoritative daily state, clinician visibility, electrolyte accounting, and consistent recommendation consumption. The GLP-1 hydration path is materially more connected but is a separate protocol-specific design, not a reusable hydration layer.

### POTS consequence

MPM must not build a special POTS water tracker on top of this split architecture. It would duplicate the problem: a condition-specific target and UI with no reliable, shared intelligence path. The hydration foundation needs diagnosis-approved repair or replacement before numeric POTS hydration support is safe.

## 13. Clinician-defined POTS parameters

The appropriate comparison is not “POTS checkbox versus diabetes checkbox.” It is the existing pattern in which validated clinical parameters become resolved, explainable inputs to the nutrition system rather than passive dashboard information.

| Parameter | Product decision | Authority | Current feasibility |
| --- | --- | --- | --- |
| Daily fluid target and maximum/restriction | Include, but only as a typed clinician-defined instruction; target and ceiling must be distinct. | Clinician / authorized dietitian | Not safely operational today: no unified daily hydration state or conflict gate. |
| Dietary sodium target/range and maximum/restriction | Include only if the meaning, units, scope, and conflicts are explicit. Never calculate from POTS. | Clinician / authorized dietitian | Not safely operational today: no sodium target in the resolved prescription or post-generation nutrient gate. |
| Electrolyte guidance | Include as structured instruction/restriction, not a default product recommendation or generic supplement plan. | Clinician | Partially representable as guidance; not measurable or enforceable today. |
| Meal size/frequency | Include as a bounded directive or user preference, depending on its source. | Clinician for clinical directive; user for non-medical preference | Qualitative guidance can be propagated through the existing protocol envelope. |
| Carbohydrate/post-prandial guidance | Include only when clinician-provided and reconciled with diabetes/GLP-1/pregnancy protocols. | Clinician | Existing carb targets and guardrails offer a partial pattern; POTS should not independently calculate one. |
| Caffeine/alcohol guidance | Structured qualitative restriction/preference; no numeric dosing target. | Clinician for medical restriction; user for preference | Existing qualitative guardrails can support this, with clear limitations. |
| Exercise/training hydration | Defer numeric support until a daily hydration state and session-aware performance model exist. | POTS clinician defines ceilings; performance professional may supply session context | Performance has partial contextual support, but no session hydration accounting or validator. |
| Additional notes | Preserve as visible, versioned clinical context. Do not parse free text into hard generation rules. | Clinician | Appropriate for display/coaching context, not deterministic execution. |

### Authority and precedence

Every future parameter must identify its source:

1. **System safety rule:** can withhold or require review; it cannot create a POTS numeric target.
2. **Clinician-defined target or restriction:** the only source that may establish actionable POTS fluid, sodium, electrolyte, or maximum values.
3. **Calculated target:** may exist only for a non-clinical general-wellness experience and must never become a POTS protocol input.
4. **User preference or observation:** can affect reminders, meal timing, flavor, or a non-medical pattern preference; it cannot create clinical numbers or override restrictions.

Clinician restrictions and higher-priority organ-safety protocols must win over all lower sources, including POTS and performance defaults.

## 14. Required propagation path for an actionable POTS instruction

An effective clinician control panel must feed actual platform behavior through a single authoritative path:

```text
Authorized ProCare clinician
  → typed POTS plan, author, version, effective/review dates, and restrictions
  → patient clinical profile
  → conflict resolver (renal/cardiac/liver/hypertension/pregnancy/diabetes/GLP-1/etc.)
  → resolved daily hydration and nutrition state
     ├─ approved target/restriction
     ├─ today's authenticated intake events
     ├─ intake reliability/source
     └─ withheld reason, if a conflict applies
  → protocol envelope + generation context
  → server-side generation/food-nutrient validation for hard constraints
  → meal, beverage, grocery, and coaching response
  → patient explanation and saved-result provenance
  → ProCare monitoring, history, review, and escalation support
```

The current architecture has portions of this model:

- ProCare/clinical prescription patterns establish provenance for nutrition targets.
- The protocol envelope can distribute resolved qualitative guidance to generation surfaces.
- GLP-1 demonstrates a stronger symptom-to-adaptation pattern.
- Clinical macro gates show the correct direction for server-authoritative validation.

But it does **not** yet have the middle of the chain for general hydration: a unified plan, authenticated daily intake arithmetic, sodium/electrolyte accounting, nutrient-aware validation, clinician monitoring, or end-user explanations grounded in actual current intake. A future control panel must not ship before that chain is complete.

## 15. Recommended condition-neutral Hydration Intelligence architecture

If MPM later approves this work, the foundation should be one **Hydration Intelligence** layer, not separate POTS, pregnancy, performance, and GLP-1 water trackers.

Its conceptual responsibilities would be:

1. **Hydration plan:** a versioned, source-aware plan with clinician targets/restrictions, optional general-wellness targets, effective dates, and a clear precedence contract.
2. **Intake events:** authenticated, durable water/beverage events with units, time, source, and correction/audit behavior. Nutrition/electrolyte contribution can be counted only when it comes from reliable nutrition data; never guessed from vague beverage names.
3. **Resolved daily state:** one server-calculated view of target, applicable ceiling, intake to date, remaining amount, confidence/reliability, active conflicts, and withheld-adjustment reason.
4. **Protocol modifiers:** POTS, performance, pregnancy, GLP-1, illness/recovery, and other future protocols may contribute only appropriately authorized guidance to the same resolver.
5. **Downstream consumers:** Coach's Corner, Beverage Creator, meal generation, Nutrition Life Plan, reminders, and ProCare all consume the same resolved state rather than recreating their own counters.
6. **Safety and explainability:** hard clinician ceilings use server validation; recommendations explain source and reason; free-text instructions remain context unless translated into reviewed typed fields.
7. **Professional monitoring:** authorized clinicians can review trend/adherence signals and plan status, without MPM claiming to diagnose, treat, or determine symptom cause.

This is a **proposed architectural direction**, not a recommendation to begin rebuilding hydration now. It should be reviewed alongside the POTS clinical-governance decisions.

## Sources consulted

1. Raj SR, et al. *Diagnosis and management of postural orthostatic tachycardia syndrome.* CMAJ. 2022;194:E378-E385. https://pmc.ncbi.nlm.nih.gov/articles/PMC8920526/
2. Wells R, et al. *Evaluating and managing postural tachycardia syndrome.* Cleveland Clinic Journal of Medicine. 2019;86(5):333-344. https://www.ccjm.org/content/86/5/333
3. Ganesh R, Bonnes SL, DiBaise JK. *Postural Tachycardia Syndrome: Nutrition Implications.* Nutrition in Clinical Practice. 2020. doi:10.1002/ncp.10564. https://aspenjournals.onlinelibrary.wiley.com/doi/10.1002/ncp.10564
4. Mehr SE, et al. *Gastrointestinal symptoms in postural tachycardia syndrome: a systematic review.* Clin Auton Res. 2018. https://pubmed.ncbi.nlm.nih.gov/29549458/
5. Mullens W, et al. *Dietary sodium and fluid intake in heart failure.* European Journal of Heart Failure. 2024. PMID:38606657. https://pubmed.ncbi.nlm.nih.gov/38606657/
6. Johns Hopkins Medicine. *Postural Orthostatic Tachycardia Syndrome (POTS).* https://www.hopkinsmedicine.org/health/conditions-and-diseases/postural-orthostatic-tachycardia-syndrome-pots
7. Dysautonomia International. *Lifestyle Adaptations for POTS.* https://www.dysautonomiainternational.org/page.php?ID=44
