# Phase 2C — Development-only human-food enforcement audit

Scope: active generation and food recommendations, not CRUD, barcode identification, image-only endpoints, or nearby-venue discovery. “Context” below means the server-resolved nutrition subject’s protocol envelope/Human Food scope, not a request-body badge. “Scan” means the actual post-output check, not a prompt promise. An output scan is not proof of nutrient arithmetic or of an unknown packaged product’s composition.

## A. Food-surface coverage matrix

| Active surface | Actual input to generation or deterministic logic | Post-output check and violation outcome | Numeric evidence / limitation |
|---|---|---|---|
| Create a Dish / Create with Chef | Craving route’s Human Food context + creator intent and unified route’s resolved envelope | Shared protocol scan, dish identity and final Human Food checks; repair/fallback or 422 | Diabetic carb/starch caps on covered branches; no universal ingredient-derived macro proof |
| Craving Creator | Resolved creator context, envelope, GLP-1 and applicable clinical rules | Shared scan, diabetic/GLP-1 checks; same-dish repair or 422 | Diabetic carb and starch gates, not all clinical nutrients |
| Sushi Pro | Same active Craving service with sushi creator intent | Same scan and failure path | Same partial nutrition gates; not a separate sushi numeric validator |
| Fridge Rescue (main + unified dispatch) | Main route’s Human Food context and unified service’s resolved generation context | Shared scan/clinical checks and final rejection on exhausted candidates | GLP-1 and starch gates on covered branches; the two entry paths are not identical |
| Dessert Creator | Dedicated protocol/Human Food/GLP-1 prompt | Protocol scan, dish identity, final repair and rejection | Total/per-serving/servings arithmetic and GLP-1/diabetes checks |
| Beverage Creator | Dedicated protocol/Human Food and resolved GLP-1 targets | Beverage medical scan, universal final check; repair or reject | Keto carbs and GLP-1 calories/fat/protein checks; no general ingredient-derived arithmetic |
| Recipe Scan | Capture delegates to the active Craving endpoint | Downstream scan/rejection; no separate unsafe result returned by capture | Inherits Craving’s partial gates |
| Restaurant Assistant / Fast Food | Resolved menu/clinical context in verified-menu or AI fallback prompt | Structured menu compatibility + protocol scan; invalid options dropped or request fails | Menu composition can be unverified; no universal sodium/potassium/saturated-fat proof |
| Weekly Meal Board generate / regenerate / reroll | Deterministic template selector, **not an AI prompt**. Existing diet/medical flags enter selection; subject envelope now enters post-selection common validation | Every selected meal scanned before save/return; unknown ingredients under active ingredient-dependent restrictions or a conflict rejects the request (422), with no silent serve | Template nutrition is not independently reconciled; unavailable safe template causes a whole-plan failure |
| My Perfect Menu | Subject envelope, Human Food scope, GLP-1 and Builder context in concept prompt | Concept validator calls Human Food and protocol scan; rejects/retries | Concepts do not require quantified nutrition; completed meals need their own checks |
| One-Touch directions + completion | Resolved envelope/GLP-1 in concept prompt; completion re-resolves authority | Shared directions service runs `validateOneTouchDirectionSafety` including protocol scan; completion validates recipe; rejects on exhausted repair | Clinical completion can fail closed on unprovable numbers; concept text is not a quantified meal |
| Grocery Coach meal recommendation | Shared subject context in prompt | Initial scan, bounded retry, final Human Food validation; 422 on failure | Clinical constraints applied where known; not a universal numeric proof |
| Grocery Coach ingredient swap | Same shared context and Product Advisor selection | Primary, alternatives and usual picks scanned; conflicts 422; unavailable GLP-1/envelope context now 503 before generation | Brand/product quantities do not establish complete composition |
| Product Advisor / Find a Product | Shared context in provider prompt | Each AI candidate now scanned for obvious contradictions; all rejected yields unavailable result. Alpha-gal, trimester pregnancy or any food allergy with brand-only candidates fails closed (503) | Brand names are not ingredient labels; no composition claim is made for these high-risk profiles |
| Getaway | Envelope in prompt | Choices scanned and Whole-Food classified; empty set 503 | Venue suggestions lack verified ingredient lists; active Alpha-gal/pregnancy choices fail closed |
| Gatherings | Envelope in prompt | Per-course scan, bounded regeneration and fallback handling | No general clinical nutrient arithmetic proven for every fallback |
| Pairings (AI) | Envelope in prompt | Each pairing, its name/category and alternatives scanned before image/return; empty set errors | Pairing labels are not complete packaged-product evidence |
| Legacy alcohol/beer/wine/bourbon/meal pairings | Resolved authenticated envelope or guest context in prompt | Output scanned; protocol conflict 400, no success payload | No nutrition proof; guest recommendations have no personal protocol |
| Chef chat | Authenticated subject envelope in prompt | Recommendation-like answers scanned; conflict 422; non-recommendation Q&A retained | Free-form answer has no reliable ingredient/nutrition evidence |
| Buffet | Resolved Human Food, protocol and clinical context | GLP-1 numeric filter + final Human Food validation; reject on no safe plates | Fat and calorie bounds where targets exist; no universal specialty nutrient proof |

The shared scan now adds conditional Alpha-gal, trimester pregnancy and thyroid hard-stop checks wherever the envelope scanner is actually called. Performance remains separate from personal protocol activation and keeps its Builder/dated demand controls.

Condition-by-condition interpretation: Hashimoto's, hypothyroid and hyperthyroid keys activate Thyroid Support’s shared hard-stop validator. Oncology has an additional dedicated hard-block in the unified generator, but equivalent deterministic coverage is not established for every independent route. Hormone Optimization, Menopause, Perimenopause and Metabolic Recovery travel as resolved guidance into prompt-backed routes; they are not separate universal numerical validators. Cardiac, renal, Liver Support and Liver Disease likewise cannot be certified by a prompt or ingredient scan alone where patient-specific numeric limits are required. Diabetes has dedicated numeric gates on named creator paths but not a single proven every-route nutrition proof. No claim that Performance is a medical safety override is made.

## B. Gaps found

The common scan previously omitted Alpha-gal, pregnancy, and thyroid. The unified thyroid loop could serve a known hard violation after exhausted regeneration. Pairings, Product Advisor, Chef chat and legacy pairing endpoints had prompt-only or incomplete post-output checks; Grocery Coach swap could proceed after GLP-1 resolver failure. The Weekly Board was a deterministic selector and did not post-scan its selected templates. Packaged brands without ingredient labels and unknown clinical numeric composition remain fundamentally unprovable from a name or an LLM assertion.

## C. Shared fixes implemented

The canonical envelope retains subject-owned Alpha-gal answers and its common post-generation scan now invokes the existing thyroid and pregnancy validators and a bounded mammalian meat/fat, gelatin and profile-dependent dairy check. The same scan now catches obvious animal ingredients for vegan/vegetarian/pescatarian identities, not just hidden derivatives; a live Chef route test exposed the previous chicken-under-vegan bypass. Thyroid advisory notes remain advisory, not hard stops. A missing ingredient list fails closed for active Alpha-gal or pregnancy trimester. Weekly Board’s shared service scans selected templates across generation, day regeneration and reroll without inventing an unused prompt parameter.

## D. Route-specific fixes implemented

Pairings checks every item including its name and alternatives; Product Advisor filters obvious provider contradictions, refuses unavailable protocol context, and refuses brand-only output for active Alpha-gal, trimester pregnancy or food allergies; Chef chat injects the protocol and rejects conflicting recommendations; legacy pairings resolve server identity, include the protocol and reject conflicts; Grocery Coach swap refuses unavailable clinical targets. A plural-peanuts avoidance no longer misses a singular peanut in a brand name. No new activation badge or performance behavior was added.

## E. Thyroid serve-as-is status

The verified `unifiedMealPipeline` final-attempt thyroid branch now returns `success: false` on a hard violation. The common scan blocks the same hard findings on other routes that call it. Advisory findings are not converted to failures. This does **not** prove that an unscanned, independently written generator cannot bypass thyroid rules.

## F. Alpha-gal coverage

Saved active Alpha-gal profile reaches the envelope and prompt; the common scan blocks named mammalian ingredients and fats, gelatin when restricted/uncertain, and dairy only on the saved `no` tolerance. It does not infer allergy from a UI badge. Ingredient-less choices reject, not pass by omission. Incomplete or undisclosed packaged-product ingredients cannot be certified safe.

## G. Pregnancy coverage

The saved stage reaches prompt guidance. For trimester stages, the existing pregnancy validator runs inside the common scan and an absent ingredient list rejects. Trying-to-conceive, breastfeeding and postpartum retain their distinct guidance rather than receiving every trimester hard block. Unknown restaurant/product preparation and stage-specific numeric goals still need structured evidence.

## H. Anti-Inflammatory coverage

Non-native active personal support enters `enforceBeforeGenerate` once; the native Builder remains responsible for its own guidance, so no second personal block is appended. The shared test checks actual composed prompt text. This is an optimization, not a fabricated numerical hard limit. A deterministic Weekly Board template selector does not yet positively select anti-inflammatory templates from that support state.

## I. GLP-1 coverage

Personal support ON without medication claim, native Builder without duplicate personal block, and support OFF are tested at shared prompt composition. Medication-specific targets still use the separate authoritative GLP-1 resolver; a resolver outage now blocks Grocery Coach swaps. Covered creator paths have numeric meal/fat/carb checks, but a brand-only recommendation or an unquantified concept is not a verified GLP-1 meal.

## J. Liver Support versus Liver Disease

Both stored conditions reach distinct composed prompt guidance; Liver Disease retains its stronger raw-shellfish rule. The common scan is not a general liver-specific sodium/protein/alcohol quantitative validator, so prompts alone cannot certify a generated meal against all liver protocols.

## K. Cardiac and Renal

Saved conditions appear in composed generation guidance. Numeric sodium, saturated fat, potassium, phosphorus and protein limits require authoritative patient-specific values and verified candidate nutrition; the common ingredient-text scan cannot establish these. Existing One-Touch completion has a stricter unknown-clinical-directive path, but equivalent proof is **not demonstrated across all surfaces**. Do not claim Production-ready all-surface cardiac/renal enforcement.

## L. Tests and controlled Development generation

Focused tests exercise actual resolved prompt composition (Anti-Inflammatory, GLP-1 ON/OFF/native, distinct liver, cardiac/renal), clinical hard-stop scanning, thyroid exhausted-repair contract, Pairings, Product Advisor, Chef chat, legacy pairings, Grocery swap resolver outage, and weekly deterministic rejection. Seven focused suites passed (47 tests); the separate Grocery swap resolver-outage test also passed. Safety typecheck and server build passed. The controlled, synthetic Alpha-gal OpenAI generation included the actual protocol block; its JSON response was scanned and passed without querying a user account. The shell process timed out afterward because imported server modules kept an open handle, **not** because generation failed; no live authenticated customer journey is claimed. No Production deployment or account was accessed for the controlled check.

Development restart served HTTP 200 and showed the logged-out app. Its *existing automatic startup migrations* ran against the configured database; a Stripe billing ownership migration check failed after retries while the server continued running. We did not request a migration or execute a manual migration. This automatic startup behavior matters because this workspace's Development and Production runtimes share a database; do not interpret “Development-only workflow” as proof of database isolation.

Two unrelated pre-existing-looking saved-option assertions in the broad Grocery Coach swap suite fail when run alone (a valid usual pick returns `null`); the new GLP-1 outage assertion passes. Treat this as unresolved test evidence, not an all-green suite.

## M. Not safe to claim for Production cutover

Do not claim universal protocol or numerical enforcement from these tests. Cardiac/renal/liver and other specialty numeric ceilings are still prompt-heavy without consistent quantified final proof; some recommendation and concept surfaces lack trustworthy ingredient or preparation evidence. Weekly Board templates with generic ingredient placeholders fail closed under ingredient-dependent restrictions instead of producing a usable plan, and personal Anti-Inflammatory/GLP-1 optimization is not positively applied by its deterministic selector. Getaway and other venue-like suggestions may have to return no choice under trimester pregnancy or Alpha-gal until verified menu composition exists. Legacy guest recommendations have no saved personal protocol. These are explicit cutover blockers or availability limitations, not evidence of a safe result silently passing.