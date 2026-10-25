---
name: Saved grocery evidence governance
description: Product-evidence priority and safety boundaries for permanent Saved Groceries and verified product discovery.
---

Saved Groceries is the permanent library shared by Product Scan and Grocery Coach. A saved product is a preference, not permanent safety approval. Library membership and shopping intent are separate from medical approval; changing existing server-side safety enforcement requires explicit approval.

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

## Account-scoped panel identity

Account isolation keys must distinguish sibling panel roles as well as the account. A user ID alone is not a unique sibling identity.

**Why:** Duplicate account-only keys allowed neighboring shopping panels to remount during updates, repeatedly fetching Saved Groceries and resetting its loading state. Tests mounting the sheet alone did not exercise the parent reconciliation boundary.

**How to apply:** Check panel identity and state retention under parent updates, not only standalone rendering. Keep account-change resets intact. A corrected Development module does not prove an already-open browser has loaded it; distinguish code verification from live-session recovery.

## Preferred library selection experience

Saved Groceries is a reusable product library, not a second nutrition-analysis or product-verification system. Product Scan and Grocery Store Coach analyze products before saving. The founder wants exact product identity (brand and package size when known), search, scrolling, individual shopping-intent checkboxes, Add Selected to Shopping List, and deletion. No category tabs, Add All Shown, caution triangles, restriction badges, evidence messages, or repeated verification messaging in the saved list. Original analysis may remain accessible separately.

**Why:** The founder explicitly corrected the previous verification-heavy design: customers are remembering specific products to buy later, not declaring them medically safe to consume.

**How to apply:** Selection represents shopping intent, never safety approval. Do not add analysis steps or automatic paid AI calls. Preserve the analysis workflow's allergy/medical protections. Inspect existing saved-to-list restrictions and report conflicts with the simple Save → Select → Add experience; obtain separate approval before changing server enforcement. Do not silently skip selected products or claim rejected additions succeeded.

## Approved Development shopping-intent boundary

The founder approved separating saved-product shopping-list transfers from compatibility approval in Development, including products with unknown or conflicting compatibility. This is not permission to change Production enforcement or make a safety claim.

**Why:** Adding a specific owned product to a shopping list records purchase intent; it does not certify that the customer should consume it.

**How to apply:** Preserve authenticated ownership, exact saved identity, duplicate prevention, atomic writes, and original evidence. Transferred evidence remains historical and review-required, never upgraded to medically eligible. Keep analysis and recommendation revalidation independent, including Grocery Coach's current-profile checks. The approved change concerns transfers, not the library-read compatibility contract or package-identity migrations. Production rollout requires separate approval.