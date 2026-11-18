# Batch 1 correction review — Development only

**Batch 1 is not approved as complete. Batch 2 has not started.**

Passive browser review found two mobile clipping issues: the Spanish carb-preference Save label and the sick-day guide heading. Their wrapping styles were corrected in the November 18 screenshot follow-up. Authenticated visual acceptance and protected-wording approval remain open.

This report supersedes the earlier `.local/reports/spanish-batch-one-review.md`, which overstated readiness and classified ordinary labels too broadly as protected wording. Passing tests alone is not visual acceptance.

## Implemented corrections

The five approved areas still use the existing centralized EN/ES/Auto system. There are no separate Spanish pages, duplicate cards, new language selectors or new language engine.

- **Hydration:** four-door descriptions, all ten symptom labels, liquid-instruction types and field hints, review-status labels, ordinary guide instructions, policy headings, ordinary tracking descriptions and exact built-in everyday suggestions.
- **My Perfect Menu:** the known failed-generation message and every existing prior-choice availability notice now translate together. The actual GLP-1 preflight translates its heading, appetite summary, questions, symptom labels, options, load/retry states and Save/Continue/Cancel controls. Remaining ordinary glucose-refresh and Performance action labels are connected too.
- **Diabetic Hub:** the ordinary meal-generator headings and launch action, first-reading prompt and GLP-1 load/status interface copy are connected. Existing chart/history labels, translated glucose context labels and date formatting remain connected.
- **Shared Shot Tracker:** medication and dose labels in create/edit states, the medication-selection placeholder, empty scheduling message and interpolated estimated-next display are connected. Existing site, history, date and action translations remain.
- **Glucose-Based Carb Choices:** title, explanation heading, range headings, food-selection instructions, close accessibility label, Save control and success notification are connected. Existing Spanish food names and Select All behavior remain.
- The two My Perfect Menu entry labels shown on the parent GLP-1 Hub, and its return-to-Menu action, are connected. This is a bounded correction to the selected feature's entry/return labels, not localization of that whole parent page.
- Approved ordinary notification content remains connected while mounted, so switching language updates titles, owned fallback details and interpolated beverage labels rather than leaving a pretranslated English string in the toast.

Unknown service details, generated recipes, saved notes, medication names, original instructions and changed/unknown saved suggestions remain original. Everyday suggestions translate **only** when their built-in option identity and exact authored text match; clinical suffixes and Creator handoff text stay original.

## Classification and approval boundary

| Class | Treatment |
| --- | --- |
| Ordinary interface | Connected to existing resources: headings, labels, controls, choices, progress/errors and form-entry instructions. |
| Medical terminology used as interface | Connected without changing its identifier or meaning: Medication, Dose, symptom names, glucose-range headings and instruction-type labels. These are not dosing or treatment instructions. |
| Authored clinical explanation/guidance | English remains active. Source-faithful Spanish is drafted separately; no clinical translation was activated. |
| Medication/injection examples | English examples remain active. Drafts retain every dose number and the original **2 inches**, without conversion or added instructions. |
| Legal consent/attestation | Agreement bodies remain English pending review. Ordinary validation such as “Consent is required” is translated; this does not translate, bypass or modify the agreement itself. |
| User/clinician-entered records | Never automatically translated, rewritten or replaced. Original text remains visible. |
| Drug names, units, IDs and dates | Canonical values remain unchanged. Display localization does not change stored timestamps or identifiers. Native date-field hints are browser-owned, not application resource strings. |

The separate protected draft contains **63 entries: 55 within the five-area review and 8 clinical/performance excerpts from the adjacent Training screenshots**. Each entry identifies its source, display location, classification, exact English and proposed Spanish. It is a review document, not a runtime resource.

Draft source: `docs/localization/batch-one-protected-review.json`.

## Screenshot-by-screenshot reconciliation

All sixteen supplied screenshots were inspected. Times below identify their filenames; the images themselves are not post-fix screenshots. “Corrected” describes the implementation and component checks, not approval of the original screenshot.

| Screenshot time | Corrected ordinary English | Already translated / intentionally preserved | Remaining protected or out of scope |
| --- | --- | --- | --- |
| **16.01.27** | “Use Log a fluid…” instructions; “Return to My Perfect Hydration Center…” navigation/support description; ordinary “Considered for you” label. | Numbered step headings were already Spanish. | The descriptive-history clinical limitation is **H13**. The verified-consideration explanation and shared medical boundary are **H21–H23**. Their English remains; exact Spanish drafts are provided. |
| **16.01.44** | “Track without a formula”; “Small, nonnumeric strategies…”; “Fluid contribution is tracked separately…”; exact “Pair it with something you already do” and “Use a visible cue” cards and their ordinary descriptions. | Today, totals, water, beverage, log controls, barriers, strategy actions and units were already translated or canonical. | Numeric-policy body **H24**; physiological/optional-setup explanations **H33–H34**. No target or logged amount was changed. |
| **16.02.30** | “The Creator remains responsible for formulation and runs its normal safety checks.” | Approximate duration, environment, their field hints and the Athletic Beverage Creator action were already Spanish. | No additional English clinical paragraph is visible in this crop. The full Athletic panel's separate clinical limitation remains **H03**. |
| **16.02.43** | Athletic, sick-day and liquid-support door descriptions; Nausea, Vomiting, Diarrhea, Low appetite, Sore throat, Feeling unwell, Unable to keep fluids down, Fainting or confusion, Trouble breathing or chest pain, Blood in vomit or stool. | Four door titles and everyday door description were already Spanish. Checkbox values and escalation logic remain canonical. | Four-door medical-plan limitation **H01**, sick-day description **H04**, practical sipping/seek-care guidance **H06**. The conditional urgent warning **H05**, though not shown in this crop, is also drafted and unchanged. |
| **16.03.01** | Original-instruction placeholder; timing/frequency heading and hint; allowed/restricted-category headings and examples; texture heading and example. | Date labels and Review instructions were already Spanish. Entered instructions and native date values stay original; `mm/dd/yyyy` is a browser-owned date-field hint. | No entered medical record was translated. Other review/activation disclosures in this feature are **H07–H12**; they remain English pending approval. |
| **16.04.20** | The complete known generation failure plus the “Previously saved choices are withheld…” notice now render in Spanish together and switch back to English correctly. | Menu title, builder badge, explanatory text, Breakfast ideas, destination guidance, Clear, Try 3 More and the recipe-vs-idea notice were already Spanish. | Unknown backend/provider details remain original, not automatically translated. No clinical guidance appears in this error message. |
| **16.06.18** | Entire ordinary GLP-1 preflight: heading; appetite/tolerance prompt; shot-history maintenance note; Update how you're feeling; Full settings; all question labels, options, Cancel and Save & Continue. Loaded appetite values also have a closed display-label map. | The enclosing Menu headings, replacement controls and destination guidance were already Spanish. | Unrelated GLP-1 safety blocks remain **M02–M03**. No symptom value, safety signal, existing medication data or submit payload was translated. |
| **16.06.57** | Carb-choice modal title, explanation heading, food-selection instruction and Low Glucose Range heading. | Food chips and Select All were already Spanish. | Opening clinical explanation and three clinical bullets **G01–G04**; low-range recovery description **G05**. Exact source-faithful drafts are supplied. |
| **16.07.06** | In-Range Glucose and High Glucose Range headings; Save Glucose Carb Preferences. The associated success notification is connected too. | Food chips and Select All were already Spanish; saved food identifiers and selections remain canonical. | Range-specific effect claims **G06–G07** remain English. |
| **16.07.38** | Medication, Select medication…, Dose (mg), Estimated next date/time template. Equivalent edit labels and the empty-history scheduling message are connected too. | Tracker title, Close, date/site/notes labels, site choices, Save Shot, History and Edit were already Spanish. Drug names and original records remain unchanged. | Injection-note example **S02** remains English. Dose example **S01**, masked by the entered value in this screenshot, is drafted too. The seven-day estimate was not changed. |
| **16.08.07** | No new ordinary-English defect is visible in this crop. | The actual daily check-in title, explanation, symptom headings, symptom names and severity choices were already Spanish. | Existing translated content was not rewritten or treated as newly completed work. |
| **16.08.16** | No new ordinary-English defect is visible in this crop. | Fatigue/dizziness/headache, vomiting, fluid retention, eating-tolerance, urination and symptom-trend questions/options were already Spanish. | No change to symptom severity, warning triggers or values. |
| **16.08.28** | “Notify my physician”; the parent card's “My Perfect Menu” and “Create ideas for your GLP-1 Builder”. | Other notification choices, appetite choices, Cancel, Save check-in and surrounding Metabolic Hub text were already Spanish. | No automatic care-team message was sent. The next Training page is accounted for below, not silently implemented. |
| **16.08.41** | **No Training implementation change.** | The shared Clinical badge and tutorial's “Cómo funciona” were already Spanish. | Adjacent **Training Nutrition Schedule**, outside the approved five-area implementation. All ordinary labels are enumerated below. Training-phase subtitle **T07** and rest-day claims **T01–T03** have inactive drafts. |
| **16.08.50** | **No Training implementation change.** | Account/profile-derived numbers, plan data and values remain original. | Same adjacent page. Ordinary headings/labels are enumerated below; rest-day clinical claims **T01–T03** remain English with drafts. |
| **16.08.58** | **No Training implementation change.** | Account/profile-derived factor values and priorities remain original. | Same adjacent page. Ordinary factor/priority/launch labels are enumerated below. Clinical explanations **T04–T06** and launch-support claim **T08** have inactive drafts. |

### Every adjacent Training phrase accounted for

The following are not being claimed as fixed. They belong to `TrainingNutritionHub.tsx`, rendered through `GLP1TrainingPage.tsx`, rather than the five approved Batch 1 components.

| Screenshot | Ordinary labels / display values still English outside scope |
| --- | --- |
| 16.08.41 | Training Nutrition Schedule; Update Setup; Launch GLP-1 Meal Builder; WEEKLY COACHING SCHEDULE; Edit Schedule; Sun, Mon, Tue, Wed, Thu, Fri, Sat; Rest Day; Strength; Power; Endurance; TODAY'S TRAINING; the English month abbreviation in the displayed date. “Build meals calibrated for your training phase” is separately classified as the protected performance claim **T07**. |
| 16.08.50 | TODAY'S TRAINING; Rest Day; COACHING PLAN TARGETS; REMAINING TODAY; CALORIES; PROTEIN; STARCHY; FIBROUS; FAT; Log meals to see remaining; Athletic Protocol Active; Strength; Muscle Gain; In Season; 1–2 sessions/wk; Recovery Cardio; 60–90 min sessions; Good Recovery; Speed; My View; Pro View; Active Performance Factors. The three rest-day explanations are **T01–T03**. Numeric values are data, not untranslated prose. |
| 16.08.58 | Active Performance Factors; Fuel Demand; Low Demand; Recovery Demand; High; Adaptation Focus; Power Focused; Training Load; Moderate; Nutrition Priorities; Recovery support; Protein distribution; Explosive power nutrients; How This Influences Your Meals; Launch GLP-1 Meal Builder. The three meal-influence paragraphs are **T04–T06**; “Build sport-calibrated meals from this plan” is **T08**. These factor/priority values need closed canonical display maps if a later scope is authorized; unknown professional-entered values must remain original. |

No Training task, Batch 2 implementation, release, merge or Production action was created by this reconciliation.

## Verification evidence and limitations

- **182 focused assertions passed across 15 suites**, including the actual five areas, the actual preflight/daily check-in, all hydration doors, translated errors and open dialogs, English/Spanish/Auto preference handling, retained unsaved answers, live notification language changes and canonical mocked save/create/edit/delete payloads.
- The permanent localization checker tests pass: **27 tests**, with its scanner, registry and baseline unchanged.
- Safety type check passed. The release type gate matches the unchanged **109-diagnostic** reviewed baseline.
- A client build succeeded. Existing large-bundle notices remain.
- The permanent **new-interface localization guard is not green**: its conservative protected-wording review findings are intentionally not suppressed. Medical terminology and ordinary labels such as Medication, glucose headings and related form/status text trigger review heuristics. This is not represented as clinical approval or release clearance. A separate finding ledger records exact results.
- All legacy language JSON catalogs are unchanged. The previously reported inactive-language measurement-key gaps were not repaired, hidden or reclassified in this correction.
- Real-component unit tests use synthetic responses and mocked mutations; they do not prove live account persistence, authenticated generation or care-team delivery.
- Script-free HTML evidence is rendered from the actual components with compiled CSS. It excludes application startup, external assets, scripts and customer data. Passive browser layout evidence does not establish interactive browser behavior, authenticated flows or actual writes. Detailed browser findings are recorded with the final evidence.
- Native browser date controls and the full interactive Recharts plot require separate real-browser context; static component markup cannot certify their OS/browser behavior.
- No paid AI provider, customer-data mutation, migration, Production change, merge or deployment was performed.

## Remaining English and acceptance

All protected authored English is explicitly listed in the inactive draft. Original records, medication names, unit symbols and unknown service details remain original by design. Adjacent Training English is explicitly enumerated rather than presented as Batch 1 coverage.

The protected wording draft is prepared, and the two reported clipping styles have been corrected. **This is not final international clinical readiness or approval of Batch 1.** Authenticated visual acceptance and qualified approval of protected wording are still required before activation or any next batch. The separate screenshot-follow-up review accounts for the later journal and Nutrition Life Plan screenshots and the nine specific passages presented for approval.
