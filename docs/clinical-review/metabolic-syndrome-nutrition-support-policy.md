Clinical review draft — not approved or implemented

# Metabolic Syndrome Nutrition Support Policy

My Perfect Meals • Policy, supporting references, proposed implementation map, and validation plan

Prepared and sources checked: October 14, 2026. Intended reviewers: the product owner and Dr. Eric. Draft identifier: MS-NUTRITION-2026-10-14.

**Approval boundary:** This document proposes future behavior. It does not activate a condition, change onboarding, modify the Sources interface, alter GLP-1 functionality, update any database or account, or authorize a Production release. Clinical policy approval, software implementation, and release approval are separate steps.

<a id="inspection"></a>

## 1. Existing Sources interface: inspected findings

The inspected Sources experience is a reusable bottom-sheet panel titled **“Sources & Medical Information”**, implemented in `client/src/components/MedicalSourcesInfo.tsx`. It is not a standalone `/sources` page in the inspected routing. Dashboard and Macro Calculator call sites open the same component; other call sites include Hydration Center, pregnancy, guest, and clinical-builder pages.

- **Organization:** condition- and topic-oriented sections, explanatory paragraphs, and source cards within the existing dark, vertically scrollable sheet.

- **Most storage:** references are directly authored in the component as `SourceItem` properties: `title`, `description`, and `url`. These static entries are not fetched from a clinical-reference database by this component.

- **Display:** cards show title and description with an external-link control. Links open a new tab with `noopener noreferrer` and a title-based accessible label.

- **Structured precedent:** `HydrationEvidenceSection` requests `/api/hydration/evidence` when the panel is open. Its record includes source identity, organization/author, publication date, citation, evidence type/level, population, and supported rule. That section is explicitly Development-only, and its endpoint requires authentication. This precedent is not proof that every clinical section already has equivalent traceability.

- **Missing addition:** no dedicated metabolic-syndrome section was found. Existing source cards do not structurally require publication dates, review dates, or rule IDs.

- **Separate unrelated registry:** `client/src/lib/macroSourcesConfig.ts` lists food-entry destinations for macro logging; it is not the clinical bibliography.

**Inspection limit:** these are code-inspection findings. The sheet was not opened in an authenticated browser during this drafting exercise; no Sources UI changes or new display tests have been executed.

The nutrition envelope recognizes the text “metabolic syndrome” as a general medical-optimization condition, but this is not a dedicated, evidence-linked policy with demonstrated all-surface coverage. The onboarding option currently labeled “Metabolic Medication” stores `glp1`. Neither recognition nor relabeling is sufficient implementation.

<a id="profile-inspection"></a>

## 1A. Additional inspection: onboarding and Edit Profile

**Requirement under review:** users must be able to maintain their medical-condition information after onboarding, not only select it once. The design must cover all relevant medical conditions, not a one-off metabolic-syndrome toggle. No new application controls have been created.

| Area inspected | Observed behavior | Gap or verification still required |
| --- | --- | --- |
| Onboarding | `OnboardingV3.tsx` owns a medical-condition list on Step 3, restores saved `user.medicalConditions`, and saves that array. Its “Metabolic Medication” option has identity `glp1`. It has no distinct metabolic-syndrome option. | Do not relabel or migrate that identity. A distinct option and an approved shared condition catalogue are future work, after policy approval. |
| Edit Profile | `client/src/pages/profile/EditProfilePage.tsx` reads specialty-support selections and GLP-1 information. Its inspected UI does not render onboarding's general list of Type 1 Diabetes, Type 2 Diabetes, Prediabetes, and the other medical-condition choices. | The inspected page is not a complete general medical-condition editor equivalent to onboarding. This does not mean every condition is uneditable everywhere: specialized controls exist and other clinical paths have not been exhaustively audited. |
| Environment-specific saving | Edit Profile's general save does not write `medicalConditions` in Development. Its non-Development branch updates only the `glp1` membership while preserving other entries. Specialty supports have separate saving and ownership behavior. | A general add/remove condition change cannot be assumed to persist through this form today. Do not equate the existing specialty-support “Clear All” control with clearing every medical condition. |
| Storage and readers | Inspected profile-update code accepts `medicalConditions` and `healthConditions` separately. Shared nutrition readers use these fields in different paths. | Audit identity normalization, reader authority, aliases, and cache refresh before claiming all-surface consistency. Separate writable arrays are not proof that removing a condition removes all stale representations. Do not blindly merge or erase them. |
| Runtime acceptance | These findings come from code inspection only. | No save, database write, re-login, live food generation, or clinical-access test was performed. Current persistence and final recommendations have not been demonstrated end to end for the proposed edit workflow. |

### Proposed lifecycle behavior, subject to approval

- Reuse the existing Edit Profile experience; do not add a duplicate medical-condition screen. Use one approved condition identity/display catalogue in onboarding and Edit Profile, with explicit compatibility mappings for legacy entries.

- Display the authorized subject's saved choices accurately, including unknown/custom legacy entries. An unresolved profile read must not become an empty list that overwrites stored information.

- Allow additions and removals of the user's own reported condition information after onboarding, including selecting metabolic syndrome later or deselecting it when updating their status. Explain that an edit does not confirm resolution of a diagnosis or authorize stopping treatment.

- Preserve unrelated medical conditions, allergies, dietary identity, servings, saved macros, targets, onboarding completion, and historical food records. Adding or removing metabolic syndrome must not change GLP-1 information, and vice versa.

- Do not silently remove clinician-owned protocols, prescriptions, lab evidence, or verified care-team instructions through a self-report edit. Define how such information is displayed and how a correction/review request works; legitimate safety authority and user preferences are different sources.

- After a successful save, refresh the canonical condition context and invalidate affected recommendation caches. Subsequent food recommendations must reflect current applicable authority. Failed saves must not claim success or prematurely apply a condition change. Previously saved recipes are not silently rewritten or deleted.

- Clarify how an existing explicitly selected Builder and independent clinical instructions interact with condition removal. A removed self-reported tag alone is not permission to reassign the Builder, erase medical evidence, or declare that every clinical restriction has ended.

**Approval scope:** Dr. Eric reviews nutrition applicability and clinical conflict handling. The product owner approves editability, experience, identity compatibility, preservation behavior, implementation scope, and release. Neither approval substitutes for the other.

<a id="scope"></a>

## 2. Scope, identity, and non-negotiable boundaries

**Core proposal:** metabolic syndrome should improve food quality and personalization across human food tools. It must not introduce a GLP-1 overlay, automatic portion reduction, or a universal forbidden-food list.

Metabolic syndrome is a clinical cluster involving abdominal adiposity, blood pressure, glucose, triglycerides, and HDL cholesterol. It does not establish that every component is present, diagnose diabetes, prove medication use, or prescribe a particular macronutrient ratio. Diagnostic background is supported by [S8](#S8); this policy does not implement diagnostic criteria.

- Proposed independent condition identity: `metabolic-syndrome`, with display label “Metabolic Syndrome.” The final identifier and normalization rules require review. Never reuse `glp1` or automatically reinterpret existing GLP-1 records.

- Record user-reported condition information as user-reported. Do not label it clinician-verified without genuine verification. Do not infer a diagnosis from measurements, medication, appearance, or the selected Builder.

- Preserve saved calorie and macro targets, explicit recipe-design instructions, serving count, serving preferences, dietary identity, allergy rules, cultural preferences, and legitimate medical care plans. Recommendations must not silently save replacement targets.

- Do not force weight loss, high protein, low carbohydrate, a GLP-1 Builder assignment, a smaller meal, or a new mandatory onboarding stage.

- Scope is human food personalization. Pet nutrition, medication prescribing, diagnosis, exercise prescriptions, supplements as treatment, and emergency treatment design are outside this policy.

- For professional workflows, use the exact authorized client and organization/Location context, not the practitioner's personal profile. Household subjects need their own authorized context.

- Adults are the proposed initial evidence population. Pediatric, pregnancy, frailty, eating-disorder, undernutrition, and other medically complex cases require their established specialized policies and clinical review; do not extrapolate an adult weight-loss pattern.

### Enforcement classes

- **Prefer:** rank or generate suitable choices consistent with the approved dietary pattern.

- **Limit:** propose a reasonable reduction or substitution and explain it. This does not mean “never eat.”

- **Independent safety constraint:** enforce a genuine allergy, dietary identity, authorized patient-specific clinical restriction, or established safety rule. The metabolic-syndrome label alone creates none of these hard stops.

- **Uncertain:** identify missing composition or clinical evidence. Do not claim exact nutrient compliance from a dish name, model estimate, or unverified product record.

Rules operate on the whole eating pattern where evidence is available. A single food is not equivalent to an entire diet. Clinical recommendations and product-preservation requirements must remain visibly distinguishable in the implementation.

<a id="rules"></a>

## 3. Proposed nutrition rules and source traceability

Each clinical rule below has a source ID and a bounded interpretation. Quantities and exceptions must be reviewed before any numeric implementation. Preserving an established preference does not guarantee that every dietary pattern optimally manages metabolic syndrome; explain genuine tradeoffs without silently changing the person's diet.

| Rule | Preferred choices / limits | Application and boundaries | Supporting sources |
| --- | --- | --- | --- |
| **MS-01; Overall food pattern** | Offer DASH- or Mediterranean-compatible choices: vegetables, appropriate fruit, higher-quality carbohydrates, suitable protein, and unsaturated fats. | Food-pattern guidance, not a required diet identity. Apply within vegan, vegetarian, gluten-free, kosher, halal, and other established constraints. No claim that a recipe cures the syndrome. | [S1](#S1), [S2](#S2), [S3](#S3), [S4](#S4), [S7](#S7) |
| **MS-02; Carbohydrate quality and fiber** | Favor suitable whole grains, legumes, whole fruit, vegetables, nuts, and seeds over lower-fiber refined alternatives. | Respect carbohydrate allowances, intolerances, active glucose-related policies, and kidney constraints. “Whole grain” is not automatically gluten-free or low carbohydrate. Never ban all carbohydrates. Do not convert ADA's diabetes-specific fiber guidance into an unreviewed universal metabolic-syndrome threshold. | [S1](#S1), [S3](#S3); [S5](#S5) recommendations 5.14 and 5.24 where diabetes/prediabetes guidance is applicable. |
| **MS-03; Added sugars and drinks** | Favor unsweetened beverages and reduce avoidable added sugar in recipes. Offer water or an appropriate low/no-calorie alternative to sugar-sweetened drinks. | Distinguish added sugar from total sugar and whole-fruit ingredients. Do not impose a zero-sugar rule, erase desserts, or override established hypoglycemia-care instructions. Use explicit sweetener preferences and evidence; no automatic ban on all nonnutritive sweeteners. | [S1](#S1), [S2](#S2), [S3](#S3), [S4](#S4); [S5](#S5) 5.21, 5.22, and 5.25 for relevant diabetes contexts. |
| **MS-04; Fat quality** | Favor sources of unsaturated fat in place of saturated-fat-heavy choices; minimize dietary patterns high in saturated/trans fats. | Examples include an appropriate liquid plant oil instead of some butter or coconut oil, subject to recipe function and preferences. Do not use GLP-1 per-meal fat ceilings. Nuts, oils, and avocado are not automatically disallowed because they contain fat; all allergy and renal rules still apply. | [S1](#S1) feature 5; [S2](#S2), [S3](#S3), [S4](#S4). |
| **MS-05; Sodium-aware preparation** | Favor lower-sodium products, unsalted or reduced-sodium ingredients, and seasoning with suitable herbs, spices, and acid. | Do not prescribe a new daily or per-meal sodium limit from this condition alone. Quantitative claims require a reviewed, applicable limit and adequate ingredient evidence. Do not automatically substitute potassium-based salt, especially when kidney disease, hyperkalemia, or relevant medication concerns are unresolved. | [S1](#S1) feature 8; [S2](#S2), [S3](#S3), [S4](#S4); [S6](#S6) practice point 3.3.2 for renal personalization. |
| **MS-06; Protein-source quality** | Offer suitable plant proteins, fish, lean poultry, or other compatible lower-saturated-fat protein choices. Favor plant proteins for vegan/vegetarian identities. | No automatic protein increase or replacement of the user's saved protein target. Kidney disease, dialysis, undernutrition, allergies, religious identity, and clinician instructions determine whether a source and quantity are suitable. | [S1](#S1) feature 4; [S3](#S3), [S4](#S4); [S6](#S6) for renal conflicts. |
| **MS-07; Processing and product quality** | Favor minimally processed choices and reduce avoidable sodium, added sugar, and less favorable fat sources in packaged selections. | Judge actual formulation and preparation where known. Do not ban all packaged foods, erase an entire requested category, or classify a homemade shake as a processed supplement merely from its name. Keep usefulness, cost, availability, and current dietary identity in view. | [S1](#S1) feature 6; [S4](#S4); [S5](#S5) 5.14 where applicable. |
| **MS-08; Alcohol-related food guidance** | Do not encourage a nondrinker to start; offer alcohol-free alternatives and lower-added-sugar options when appropriate. | No claim that wine treats the syndrome and no new drinking allowance. Pregnancy, liver disease, diabetes medication, and other established restrictions retain their own authority. Medication advice and alcohol-treatment services are outside this policy. | [S1](#S1) feature 9; [S2](#S2); [S5](#S5) 5.18–5.19 for relevant diabetes contexts. |

### Product-preservation requirements, not new clinical thresholds

**MS-P1:** portion sizes, servings, and saved nutrition targets remain governed by the user's established setup and individual circumstances. **MS-P2:** preserve the requested dish's identity and make suitable substitutions instead of default rejection. **MS-P3:** keep clinical and dietary safety independent. **MS-P4:** disclose what changed and why, with rule/source traceability. These are explicit product requirements; their implementation must not be presented as a newly discovered medical guideline.

### Substitution examples

- **Shake:** use a compatible unsweetened milk or plant alternative and suitable fruit/fiber ingredients, rather than adding avoidable syrup. Preserve serving size and protein target; no rule requiring every shake to be small.

- **Soup:** offer reduced-sodium broth and suitable herbs rather than rejecting soup. Do not claim compliance with a numeric limit if product sodium is unknown.

- **Dessert:** reduce avoidable added sugar or replace some saturated fat only when the recipe remains workable and recognizable. Do not replace a requested cake with fruit and call that equivalent.

- **Restaurant:** suggest an available preparation or sauce adjustment when supported by the menu. State that sodium/composition are uncertain when no nutrition or ingredient evidence is available; do not invent numbers.

- **Restrictive dietary identity:** use compatible choices first. If the diet meaningfully conflicts with the recommended pattern, disclose the tradeoff and offer optional clinical discussion rather than covertly switching diets.

<a id="conflicts"></a>

## 4. Conflict-resolution approach

This is proposed precedence for the new support layer, not permission to rewrite established clinical policies. Conflicting clinical instructions require clarification; “the most restrictive rule wins” is not a safe universal strategy.

- Resolve the exact authorized food subject and applicable care context. Never borrow the practitioner's targets or another household member's condition.

- Preserve genuine allergy/food-safety requirements and established acute-care exceptions.

- Apply current, authorized patient-specific clinical instructions with known provenance. If instructions conflict, identify the conflict and avoid claiming clinical compliance; request qualified review where needed.

- Apply existing dietary identity and explicit meal/recipe intent within those safety boundaries.

- Apply metabolic-syndrome preferences and substitutions where compatible. Keep portion count and saved targets unchanged.

| Coexisting context | Required handling |
| --- | --- |
| Type 1 or Type 2 diabetes / prediabetes | Keep the person's actual diabetes and glucose-related policies intact. Do not invent an insulin plan or assume diabetes from metabolic syndrome. Higher-fiber choices still need to fit applicable carbohydrate/produce rules. Existing clinician-directed hypoglycemia care takes precedence over a general “less added sugar” preference. ADA S5 informs individualized nutrition, not replacement of diabetes management. |
| Kidney disease / dialysis / potassium concerns | Do not automatically increase protein, legumes, nuts, whole grains, or potassium salt substitutes without checking existing renal guidance. Use the applicable stage, clinical context, and authorized instructions. Unknown evidence cannot support a claim of renal clearance. KDIGO S6 requires individualized sodium, phosphorus, potassium, and protein adaptations. |
| Cardiovascular disease / hypertension / heart failure | Favor suitable fat quality and sodium-aware choices, while preserving established individualized sodium or fluid restrictions. Do not infer a fluid limit or weight-loss prescription from metabolic syndrome. |
| Vegan / vegetarian / low carb / carnivore / religious identity | Stay inside the dietary identity. A vegan recipe cannot acquire fish or dairy to satisfy generic guidance. A low-carbohydrate recipe must not be repaired by indiscriminately adding whole grains. Disclose meaningful nutritional tradeoffs; do not promise every identity provides equivalent cardiometabolic benefit. |
| Allergies, celiac, intolerances | Approved substitutions must pass existing ingredient and preparation checks. “Whole grain” never proves gluten-free. Soy, nuts, legumes, dairy, and alternatives require their own suitability checks. |
| GLP-1 medication / GLP-1 Builder | The conditions remain separate. This metabolic-syndrome policy must neither activate, disable, broaden, nor refactor existing GLP-1 behavior. Any independently approved GLP-1 Builder/Menu support is composed only under its own authority. The separately requested narrowing of global GLP-1 overlays needs its own reviewed change. |
| Pregnancy, children, frailty, malnutrition, eating-disorder concerns | Preserve specialized nutrition authority and adequate intake. No automatic calorie reduction, weight-loss goal, or adult-protocol extrapolation. Clinically review applicability before personalized therapeutic claims. |

**Missing evidence:** absence of laboratory data alone should not prevent ordinary heart-healthy suggestions. It does prevent inventing individualized restrictions. Missing composition must be disclosed; existing high-risk safety policies determine whether an item can be offered, needs clarification, or cannot be cleared.

<a id="surfaces"></a>

## 5. Consistent application across food tools

Coverage must include every relevant route and fallback, not just a prominent page. Food creation, recommendation, saving, and actual consumption are different actions; a generated or saved item does not mean it was consumed.

| Surface | Expected application | Final check |
| --- | --- | --- |
| Meal Builders and Weekly Board | Generate/select appropriate food quality within the established targets, portions, and Builder context. | Actual ingredients, stated servings, preserved targets, and selected subject. No hidden reassignment to GLP-1. |
| My Perfect Menu | Rank and generate ideas using the same policy; pass it through selection and completed recipe creation. | Concept is not proof of final recipe suitability. Validate selected/completed results and restored/cached choices. |
| Create a Dish / Chef / Fridge Rescue / Craving tools | Preserve requested food identity, explicit recipe instructions, cuisine, and available ingredients; make suitable adaptations. | Recheck original, repaired, retried, and fallback outputs. No automatic rejection based on an ordinary daily-budget overage. |
| Snacks and desserts | Prefer workable lower-added-sugar / more favorable fat choices where appropriate. | Keep desserts available, respect recipe size and serving count, and distinguish per-serving from whole-recipe nutrition. |
| Beverages, homemade shakes, smoothies | Favor compatible unsweetened ingredients and nutrient quality. | Same clinical and dietary checks as food. Do not infer a processed-product restriction from the word “shake.” |
| Grocery Coach, packaged-product suggestions, barcode and saved picks | Compare actual label evidence within the requested category; offer preferable options without category erasure. | Product identity, serving basis, source date, and known ingredients/nutrients. Do not claim “metabolic-syndrome approved” from an unverified brand name. |
| Restaurants, fast food, buffet, eating out | Offer available choices and practical adjustments without GLP-1 portion caps. | Separate verified menu/label facts from estimates. Explain missing information and maintain existing serious-risk protections. |
| Meal swaps, refinements, alternatives, favorites, caches, assistants | Apply the same context to a new recommendation or meaningful transformation. | Do not duplicate saves, rewrite historical recipes, or treat an old saved/cached item as newly verified. Recheck relevant authority before a new recommendation. |

<a id="references"></a>

## 6. Verified reference register

Technical source review date for all records below: **October 14, 2026**. Original content was retrieved or verified through the publisher/institution and, for the trial metadata, NCBI PubMed. Clinical review is still pending. Access at review time is not a guarantee of perpetual link availability.

**Evidence interpretation:** scientific statements and guidelines support a dietary pattern. The trial supports the studied intervention in its specific population. None establishes universal food bans, an app-prescribed portion size, a guaranteed clinical outcome, or a new medication indication.

<a id="S1"></a>

### S1 — Primary current dietary-pattern guidance

**Organization/authorship:** American Heart Association; Lichtenstein et al. **Title:** *2026 Dietary Guidance to Improve Cardiovascular Health: A Scientific Statement From the American Heart Association.* **Publication:** Circulation, May 5, 2026, 153:e1285–e1295; ahead of print March 31, 2026.

[Original publisher](https://www.ahajournals.org/doi/full/10.1161/CIR.0000000000001435) • DOI: [10.1161/CIR.0000000000001435](https://doi.org/10.1161/CIR.0000000000001435).

**Supports:** MS-01–MS-08: whole dietary patterns; varied vegetables/fruits; whole grains; suitable protein; replacing saturated-fat sources with unsaturated-fat sources; minimally processed foods; less added sugar and sodium; no encouragement to start alcohol. General cardiovascular-risk population, not a metabolic-syndrome-specific numeric prescription.

**Currency:** explicitly supersedes the AHA 2021 dietary-guidance statement. Use 2026 as the proposed primary citation. Do not silently delete or replace any historical reference already displayed in the app.

**Independent verification for S1:** the original publisher text states: “This scientific statement supersedes the ‘2021 Dietary Guidance to Improve Cardiovascular Health: A Scientific Statement from the American Heart Association’.” The independent [NCBI PubMed record, PMID 41914202](https://pubmed.ncbi.nlm.nih.gov/41914202/), confirms the exact 2026 title, journal, DOI, and March 31, 2026 electronic publication date. The publisher identifies the final issue as May 5, 2026. These are different publication stages, not conflicting dates. Its nine food-pattern features directly support the bounded recommendations listed in MS-01–MS-08; they do not establish individual portion caps or universal food bans.

<a id="S2"></a>

### S2 — Condition-specific institutional guidance

**Organization:** National Heart, Lung, and Blood Institute, NIH. **Title:** *Metabolic Syndrome — Treatment.* **Last updated:** May 27, 2022.

[Original source](https://www.nhlbi.nih.gov/health/metabolic-syndrome/treatment).

**Supports:** MS-01, MS-03–MS-05, MS-08. Heart-healthy lifestyle is first-line; DASH may be appropriate; fruits, vegetables, and whole grains are emphasized, with limits on saturated fats, sodium, added sugars, and alcohol. Does not authorize the app to prescribe medication or universally reduce portions.

<a id="S3"></a>

### S3 — DASH food-pattern reference

**Organization:** NHLBI, NIH. **Title:** *DASH — DASH Eating Plan.* **Last updated:** February 25, 2026.

[Original source](https://www.nhlbi.nih.gov/health/dash-eating-plan).

**Supports:** MS-01–MS-07: vegetables, fruit, whole grains, compatible lean/plant protein sources, lower saturated fat, and fewer sugar-sweetened beverages; lower-sodium preparation. Its illustrative calorie-level servings and sodium examples are educational, not automatically assigned targets for this protocol.

<a id="S4"></a>

### S4 — Metabolic-syndrome food-choice guidance

**Organization:** American Heart Association. **Title:** *Prevention and Treatment of Metabolic Syndrome.* **Last reviewed:** October 17, 2023.

[Original source](https://www.heart.org/en/health-topics/metabolic-syndrome/prevention-and-treatment-of-metabolic-syndrome).

**Supports:** MS-01, MS-03–MS-07: whole grains, fruits, vegetables, suitable lean and plant protein sources; limits on processed foods, saturated/trans fats, red meat, sodium, and added sugar. Practical institutional guidance, not a hard prohibition of every named food.

<a id="S5"></a>

### S5 — Diabetes/prediabetes conflict and personalization guidance

**Organization/authorship:** American Diabetes Association Professional Practice Committee for Diabetes. **Title:** *5. Facilitating Positive Health Behaviors and Well-being to Improve Health Outcomes: Standards of Care in Diabetes—2026.* **Published online:** December 8, 2025; 2026 January collection, Diabetes Care 49(Suppl 1):S89–S131.

[Original article, open full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC12690188/) • DOI: [10.2337/dc26-S005](https://doi.org/10.2337/dc26-S005).

**Supports:** individualized nutrition therapy and meal plans (5.10, 5.13); food quality (5.14); context-dependent carbohydrate reduction (5.15); alcohol counseling (5.18–5.19); clinically appropriate sodium guidance (5.20); water and conditional sweetener substitution (5.21–5.22); adequate intake during weight loss (5.23); fiber quality (5.24); less sugar-sweetened beverage intake (5.25). Applicable to diabetes/prediabetes/risk contexts specified by each recommendation, not proof that all metabolic-syndrome users have diabetes.

<a id="S6"></a>

### S6 — Kidney-disease conflict guidance

**Organization:** Kidney Disease: Improving Global Outcomes (KDIGO). **Title:** *KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease.* **Publication:** March 2024. The linked recommendations document is a summary of the final 2024 guideline, not a new 2026 guideline.

[Original guideline](https://kdigo.org/wp-content/uploads/2024/03/KDIGO-2024-CKD-Guideline.pdf) • [Official recommendations/practice-points summary inspected](https://kdigo.org/wp-content/uploads/2026/05/KDIGO-2024-CKD-Guideline-Summary-Recommendations-and-Practice-Points.pdf).

**Supports:** practice point 3.3.2 calls for renal-dietitian/provider guidance on sodium, phosphorus, potassium, and protein tailored to individual needs, CKD severity, and comorbidities. MS-02, MS-05, and MS-06 must not blindly override renal care. No universal low-potassium or high-protein prescription is inferred. The KDIGO 2026 diabetes/CKD public-review draft is not treated as finalized policy.

<a id="S7"></a>

### S7 — Peer-reviewed intervention evidence

**Authors:** Filippou CD, Thomopoulos CG, Konstantinidis DG, et al. **Title:** *Effect of DASH vs. mediterranean diet accompanied by a salt restriction on metabolic syndrome and cardiometabolic risk factors in adults with high normal blood pressure or grade 1 hypertension: secondary analyses of a randomized controlled trial.* **Journal/publication:** Hellenic Journal of Cardiology, September–October 2025; electronic publication May 21, 2024.

[PubMed record and abstract](https://pubmed.ncbi.nlm.nih.gov/38777087/) • DOI: [10.1016/j.hjc.2024.05.006](https://doi.org/10.1016/j.hjc.2024.05.006).

**Supports:** MS-01 and MS-05 as dietary-pattern interventions. Secondary analyses of a three-month randomized trial in 240 never-drug-treated adults with high-normal blood pressure or grade 1 hypertension found lower odds of metabolic syndrome in the DASH-plus-salt-restriction and Mediterranean-plus-salt-restriction groups compared with control.

**Limits:** short-term, specific population and intervention; does not isolate the effect of every ingredient, prove long-term outcomes for every user, or support guaranteed reversal/cure. Abstract and original PubMed citation metadata were checked; this draft does not claim an independent full-methods appraisal of the publisher's complete trial report.

<a id="S8"></a>

### S8 — Diagnostic background only

**Organization:** NHLBI, NIH. **Title:** *Metabolic Syndrome — What Is Metabolic Syndrome?* **Last updated:** May 18, 2022.

[Original source](https://www.nhlbi.nih.gov/health/metabolic-syndrome).

**Supports:** the distinction between a clinical risk-factor cluster and GLP-1 medication use. Not a citation for food restrictions or a platform diagnostic algorithm.

<a id="sources-plan"></a>

## 7. Proposed additions to the existing Sources panel

- Add an identifiable **“Metabolic Syndrome — Nutrition Support & Evidence”** section to the existing shared panel, retaining its dark section/card design. Do not create a replacement Sources experience.

- Display S1–S7 with organization/author, full title, publication/update date, link/DOI, supported rule IDs, population, and evidence limitation. Put S8 under “Condition background,” separate from nutrition-decision evidence.

- Distinguish **source reviewed date** from **clinical approval date/status**. Retrieving an article does not mean Dr. Eric approved the policy.

- Use an additive, typed reference registry shared with the future rule implementation. Proposed fields: source ID, organization/authors, title, publication date, update date if available, URL, DOI if available, evidence type, population, locator/recommendation numbers, supported rule IDs, access date, review status, and supersession links.

- Reuse existing `SourceItem` visual conventions or extend them additively with optional metadata. Keep current cards intact. Avoid a database migration solely to display this static reference set unless a separate reviewed need emerges.

- Do not copy the hydration section's Development-only visibility accidentally into the intended final clinical-reference display. Public metadata access and production mounting/visibility must be explicit review decisions.

- Provide an explanation such as: “These references support food-pattern personalization. They do not establish a diagnosis, medication need, universal food ban, or automatic change to your portions or saved targets.”

**Illustrative card copy:** “AHA 2026 Dietary Guidance — Supports carbohydrate quality, healthier fat sources, less added sugar, and sodium-aware preparation (MS-01–MS-08). Published May 5, 2026; source checked October 14, 2026. General cardiovascular dietary guidance; individualized clinical restrictions remain separate.” This is proposed content, not text already added to the app.

### Reference maintenance

Proposed review: at least every six months and sooner after an authoritative guideline update, correction/retraction, or new safety issue. Next scheduled review would be April 14, 2027, subject to approval. Do not silently update live rules from a web search. Retain a source-change record, assess superseded recommendations, obtain clinical approval for changed decisions, and verify links again before release. A broken URL is not proof that the underlying clinical rule is invalid; supply a verified canonical alternative rather than fabricating a replacement.

<a id="implementation"></a>

## 8. Proposed implementation map — only after approval

The following files are starting points observed in the current project. This is not a complete route-coverage audit. Exact types, registrations, aliases, cache boundaries, and all food-tool paths require implementation-time inspection.

| Layer | Current starting points | Proposed responsibility |
| --- | --- | --- |
| Condition identity, onboarding, and Edit Profile | `client/src/pages/OnboardingV3.tsx`; `client/src/pages/profile/EditProfilePage.tsx`; existing health-information persistence and profile validation | After approval, use a shared condition catalogue and the existing profile editor for all relevant medical-condition edits. Add a separate metabolic-syndrome option only when behavior is ready. Preserve `glp1`, other conditions, saved targets, and clinical ownership. Audit `medicalConditions`/`healthConditions` authority and refresh/invalidation rather than assuming both fields are equivalent; review any storage need separately. |
| Canonical subject/context | `server/services/humanFoodContext/resolveHumanFoodContext.ts`; `shared/humanFoodContext.ts` | Resolve metabolic-syndrome support from the exact authorized subject, not request overrides or the actor's profile. Include approved policy version, applicable rule IDs, conflicts, and evidence gaps. |
| Shared policy/envelope | `server/services/protocolEnvelope.ts`; `server/services/universalMedicalGuidance.ts` | Replace generic-name reliance with one typed metabolic-syndrome policy. Separate guidance from patient-specific hard constraints. Do not modify the GLP-1 resolver as part of this policy. |
| Generation and final validation | `server/services/humanFoodContext/buildHumanFoodPromptBlock.ts`; `validateHumanFoodResult.ts`; `finalValidation.ts`; protocol output scan | Provide bounded substitutions to generation and validate the actual final candidate, including repaired/retried/alternative outputs. Keep recipe-serving normalization and requested dish identity intact. |
| Food-tool adapters | `server/routes/myPerfectMenu.ts`, `groceryCoach.ts`, `restaurants.ts`, `beverage-creator.ts`, `dessert-creator.ts`, and other food routes | Build a complete surface matrix and ensure the shared policy reaches each relevant entry point and its fallback. Imports alone do not prove coverage. |
| References and explanations | `client/src/components/MedicalSourcesInfo.tsx`; proposed typed evidence registry | Use the same approved source/rule IDs for Sources cards and action explanations. Localize meaningful copy without changing clinical meaning. |
| Release and cache controls | Existing development/production route wiring and relevant food-context caches | Keep the draft inactive. After implementation, verify explicit production route parity and versioned cache compatibility. Do not reclassify legacy GLP-1 users, alter historical food records, or enable a new condition through deployment alone without review. |

### Proposed decision contract

A future decision should carry the authorized subject/context, policy version, applicable rule IDs, source IDs, enforcement class, concrete proposed change, known nutrition/ingredient evidence, evidence gaps, preserved serving/target facts, and a reason-coded user explanation. Structured audit data should be minimized and avoid raw clinical values. A Boolean “metabolic-syndrome approved” is insufficient.

**Safe flow:** resolve subject → establish applicable existing constraints → select compatible policy guidance → generate/rank/adapt → validate final ingredients and serving basis → explain verified changes and uncertainty. If an independent serious-risk rule rejects a candidate, report that exact reason; do not disguise it as a universal metabolic-syndrome ban.

<a id="tests"></a>

## 9. Proposed validation and release tests

**Status:** none of these proposed protocol or Sources-display tests has been implemented or executed. This draft specifies acceptance criteria, not passing results.

| Test group | Required cases and pass criteria |
| --- | --- |
| T01 — Identity separation and editable lifecycle | A new metabolic-syndrome choice stores its own identity, with the same identity/display catalogue in onboarding and Edit Profile. After implementation approval, use synthetic accounts and an isolated test database to prove onboarding selection → persisted profile → re-login → displayed selection → actual meal and beverage outputs; then removal in Edit Profile → persistence → re-login → subsequent outputs without the removed syndrome-only guidance. Also test a later addition when absent at onboarding, unrelated condition edits, legacy/custom entries, failed saves, and stale reads. Never write real patient/shared-account data for this acceptance test. No change may write `glp1`, invent medication status or clinical verification, assign a GLP-1 Builder, or silently migrate legacy records. |
| T02 — Preserved setup and collateral settings | Compare persisted before/after records for onboarding and Edit Profile additions/removals. Macro targets, serving count, portion preferences, explicit recipe-design instructions, allergies, dietary identity, unrelated medical conditions, onboarding completion, and saved plans remain unchanged. Metabolic-syndrome support never silently recalculates/saves targets, clears an unresolved list, or uses specialty-support “Clear All” as a general diagnosis reset. |
| T03 — Actual final rule outcomes | For each MS-01–MS-08, inspect final structured recipe/recommendation output for positive adaptation, already-suitable food, incompatible substitution, and missing composition. Assert real ingredient identity/quantity and preparation, stated serving count, evidence-supported nutrition where available, and correct rule/source IDs—not prompt text or a “metabolic syndrome” label. Compare matched supported/unsupported-condition contexts for meals and beverages. For example, a lower-added-sugar shake must actually omit/reduce the avoidable syrup while preserving its requested serving count; a fat substitution must change the actual suitable fat source; a soup's numeric sodium claim needs matched ingredient/serving evidence. Unchanged safe food is a valid outcome. Capture representative real generator results for review; canned/mock outputs prove validation wiring only, not model or clinical acceptance. |
| T04 — Food identity and availability | Ordinary desserts, homemade shakes, snacks, and restaurant choices remain available when otherwise safe. A cake stays a recognizable cake. No category-level ban, mandatory small portion, zero-carbohydrate rule, or daily-budget refusal is introduced. |
| T05 — Dietary identities and allergies | Vegan, vegetarian, celiac/gluten-free, low carb, carnivore, kosher/halal, and allergy cases preserve their actual rules. A whole-grain substitution cannot introduce gluten; a protein substitution cannot introduce dairy/fish into vegan food; an unsaturated-fat substitution cannot introduce a known allergen. |
| T06 — Clinical coexistence | Exercise Type 1/Type 2 diabetes, prediabetes, current glucose-dependent constraints, existing hypoglycemia-care exceptions, CKD stages/dialysis, cardiovascular restrictions, pregnancy, pediatric and undernutrition contexts. No inferred diagnoses, high-protein defaults, potassium-salt defaults, unsupported limits, or conflicting instructions hidden behind “approved.” |
| T07 — Subject isolation and clinical ownership | Personal, household, and authorized professional client paths use the correct subject. Client/org/Location switches discard stale evidence and late responses. Unauthorized client access remains denied; no actor-to-client target copying. Self-reported condition removal must not erase clinician-owned protocols or lab evidence. Verify current authority after save and reject stale-context results without granting new clinical access. |
| T08 — Whole-surface final-output coverage | For every surface in section 5, prove context threading and inspect final-result validation. Include actual meal ingredients/preparation, completed beverage/shake ingredients and serving basis, Menu concepts and completed recipes, dessert branches, grocery alternatives, restaurant estimates, retries, repair, fallback, cached/restored candidates, and newly recommended saved items. After an authorized profile change, repeat representative meal and beverage operations and verify the refreshed condition context rather than an old cached choice. Imports or prompt keywords are not sufficient. |
| T09 — Nutrition evidence and uncertainty | Distinguish whole-recipe from per-serving quantities, added sugar from total sugar, ingredient evidence from dish names, and label facts from estimates. Unknown sodium cannot pass an exact sodium-compliance assertion. Product facts remain bound to exact brand/variant, serving basis, source, and date. |
| T10 — GLP-1 non-regression | Metabolic syndrome alone does not activate GLP-1 targets, tolerance, fat ceilings, or portion caps. Existing GLP-1 code/records are not altered. When both contexts are legitimately present, independent authorized Builder/Menu support and other clinical rules compose without spreading new quantity restrictions. |
| T11 — Citation integrity | Every clinical rule references an existing approved source and locator. Verify original title, organization/authors, publication versus update date, DOI/URL, supported population, and review status. No invented citations or applicability claims. Confirm AHA 2026 supersession is represented without deleting existing sources. |
| T12 — Sources UI | From the real Dashboard and Macro Calculator entry points, open the existing panel; verify the new section, complete reference cards, rule links, external URLs, keyboard/screen-reader labels, mobile scrolling, no horizontal overflow, and accurate approval wording. Preserve all existing references. Test link failures without replacing citations silently. |
| T13 — Source accessibility | Check canonical links with bounded requests, redirects, DOI resolution, and content/title identity—not HTTP status alone. Distinguish transient network failure, access restrictions, and genuinely unavailable content. A publicly accessible abstract is not a full-methods review. |
| T14 — Release boundary | Draft remains inactive until review. Verify intended API registration and frontend visibility in the actual production build before release; confirm no Development-only guard silently removes approved references. Confirm no account/data backfill, payment, entitlement, or historical-recipe mutation is introduced. |

Unit and contract tests should establish deterministic behavior and provenance. A single focused browser pass should cover the eventual changed onboarding/Sources flow and representative final food output. Authenticated clinical acceptance must use authorized evidence; fixtures may demonstrate wiring but cannot be described as live patient-data verification. Nutrition-therapy claims require clinical review in addition to software tests.

<a id="approval"></a>

## 10. Review decisions and approval gates

| Decision | Proposed position | Review status |
| --- | --- | --- |
| Initial population | Adults; specialized populations defer to their own reviewed guidance. | Pending Dr. Eric and product owner |
| Nutrition scope | Pattern-based preferred/limited choices, not universal bans or new portion caps. | Pending |
| Identity and onboarding | Independent condition; no relabeling or migration of `glp1`. | Pending |
| Edit Profile and condition lifecycle | One compatible identity catalogue; maintain reported conditions after onboarding in the existing editor, preserve unrelated settings and clinician-owned authority, and prove save/re-login/current-food behavior. | Pending product-owner approval; clinical handling pending Dr. Eric |
| Quantitative limits | No new syndrome-only numeric enforcement. Any later threshold needs source, population, authoritative individual basis, and separate approval. | Pending |
| Sources additions | Append the identifiable section and traceable records to the existing panel; preserve existing references. | Pending |
| Conflicts and substitutions | Review all examples, precedence, evidence gaps, dietary tradeoffs, and serious-risk handling. | Pending |
| Evidence appraisal | Approve S1–S8 and the source-to-rule interpretation. Review full trial methods if stronger efficacy claims are proposed. | Pending |
| Implementation authorization | Requires Dr. Eric's clinical-policy/reference review and the product owner's approval of platform behavior, user experience, onboarding/Edit Profile, and implementation scope. Neither reviewer substitutes for the other. Begin only in Development with the proposed test matrix. | Not authorized |
| Production release | Separate authorization after implementation, clinical review, route/visibility verification, tests, and release review. | Not authorized |

**Requested review output:** approved rules and evidence, corrections or exclusions, selected population, accepted conflict handling, approved Sources copy, and explicit authorization—or refusal—to implement. No implementation should be inferred from receiving this document.

---

Prepared as a technical and evidence review draft for My Perfect Meals. This is not medical advice for an individual, a diagnosis, a signed clinical protocol, or proof that the platform already implements the proposed behavior. No app, onboarding, database, GLP-1, Sources-interface, or Production changes were made in preparing it.
