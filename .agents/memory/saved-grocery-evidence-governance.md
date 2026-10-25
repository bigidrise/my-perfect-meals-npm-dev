---
name: Saved grocery evidence governance
description: Product-evidence priority and safety boundaries for permanent Saved Groceries and verified product discovery.
---

Saved Groceries is the permanent library shared by Product Scan and Grocery Coach. A saved product is a preference, not a permanent safety approval: every surface must revalidate it against the current authoritative profile before adding or recommending it.

## Unified customer experience

The user wants one Saved Groceries library across Product Scan, Grocery Coach, Find a Product, and Find Brands. Saved items should retain product name, known brand, original analysis or recommendation, personalized explanation, verification warnings, useful source information, and account ownership. Reopening existing saved analysis must not require another paid AI analysis.

**Why:** The user explicitly established this product expectation while requesting an investigation before further implementation.

**How to apply:** Treat analysis, recommendation, current-label evidence, and current-profile eligibility as separate concepts. Preserve genuine allergy and medical restrictions; never promote an unverified recommendation to verified-safe status. These requirements do not authorize implementation during an investigation-only request.

Every product shown by Find a Product should be individually saveable for future addition to the user's shopping list, retaining the specific product and brand rather than only a generic category such as "Juice".

**Why:** The user explicitly described this as the expected purpose of Saved Groceries after seeing a saved entry labeled only "Juice".

**How to apply:** Preserve the selected recommendation's identity through saving, library display, and later shopping-list addition. This expectation does not authorize implementation during a diagnosis-only request or imply verified product safety.

Evidence priority is:
1. User-photographed label.
2. USDA branded-product record.
3. Open Food Facts.
4. AI suggestion.

Evidence labels must distinguish label verified, source verified, incomplete, suggested, and needs rescan. When required ingredient, nutrition, certification, or profile evidence is unavailable, safety-sensitive use fails closed while the product remains saved and visible with a reason.

Eligibility thresholds are risk-based **per applicable restriction**, not a global photo-every-package rule. A complete, identifiable, current approved source record may qualify when the specific rule permits it; stronger protocols require their own stronger proof. Unknown precautionary allergen information remains unknown only for profiles whose allergy policy requires it. Hard restrictions decide eligibility, while nutrition optimizations and preferences rank only eligible candidates. Evidence assessments must be tied to the exact product evidence, current nutrition subject, context, and policy version; a candidate that needs verification can still be shown separately as “Check the Label,” never as “Safe for You.”

**Why:** The user approved this boundary for shared grocery discovery: do not make normal shopping impossible, and do not turn a plausible AI brand or a missing field into a safety claim.

**How to apply:** Keep the contract isolated until an authoritative profile-to-requirement resolver and trusted per-product validators are reviewed. One unverifiable product should prompt bounded discovery of other candidates, not fail the whole shopping intent.

**Why:** Product names and AI brand knowledge do not prove current ingredients, nutrition, certifications, or compatibility with allergies, avoidances, dietary identity, GLP-1 limits, and diabetes targets.

**How to apply:** Keep the Saved Grocery Library separate from verified discovery implementation. Use USDA first and Open Food Facts as a coverage/barcode fallback in discovery work; AI results must remain explicitly labeled suggestions.

For Find a Product, distinguish **missing verified product evidence** from a temporarily unavailable clinical resolver. Missing label evidence is a non-retryable limitation of brand-only advice; do not label it as a 503 outage or leak a raw HTTP response to the user.

**Why:** Repeating a brand-only lookup cannot establish complete ingredients for a protected profile, and describing the deliberate safety block as a server failure encourages futile retries.

**How to apply:** Keep the ingredient-evidence gate fail-closed, report a clear next action (checking a specific product's complete label), and reserve retryable 503s for genuinely unavailable context.

## Evidence replacement and historical viewing

Customers must be able to view original saved analysis independently of current eligibility. A saved recommendation, a photographed label, independent certification, and current-profile compatibility are different claims. Missing grades or scores must remain unavailable rather than being reconstructed as neutral or favorable judgments.

**Why:** The user explicitly required working View Analysis for blocked and legacy records, no invented evidence, and preservation of original explanations and warnings.

**How to apply:** Evidence replacement needs an explicit customer-initiated action for the exact same product and known brand/barcode, confirmation, ownership checks, stale-update protection, and retained previous evidence. Reapply existing server restrictions; a new ingredient photo alone does not prove independent certification.

## Unowned device history

Do not automatically assign old device-only scans without ownership information to whichever account signs in next. Keep temporary history separate from the permanent account-owned library.

**Why:** A shared browser cannot establish which account created an unscoped local scan. Hiding unowned history avoids disclosure without deleting a customer's old device data.

**How to apply:** Account-scope new temporary records and affected caches. Leave unowned historical storage untouched unless a separate, explicitly authorized recovery or deletion flow is requested.

## Preferred library selection experience

The founder prefers a clean, scrollable saved-product list with product/brand search, individual eligible-product checkboxes, and Add Selected as the primary bulk action, without an expanding category-button row or encouragement to add every saved brand.

**Why:** Customers should choose the specific products they intend to buy, not accidentally add multiple alternatives for the same grocery need.

**How to apply:** Preserve original analysis, permanent saved records, and server safety enforcement when simplifying the interface. Missing evidence, known incompatibility, and unavailable profile checks need clear explanations and distinct next actions rather than unexplained unusable selection controls.