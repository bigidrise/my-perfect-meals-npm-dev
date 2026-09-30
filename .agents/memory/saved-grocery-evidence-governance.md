---
name: Saved grocery evidence governance
description: Product-evidence priority and safety boundaries for permanent Saved Groceries and verified product discovery.
---

Saved Groceries is the permanent library shared by Product Scan and Grocery Coach. A saved product is a preference, not a permanent safety approval: every surface must revalidate it against the current authoritative profile before adding or recommending it.

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