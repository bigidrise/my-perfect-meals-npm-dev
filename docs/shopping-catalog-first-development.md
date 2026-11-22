# Development Shopping: catalog-first product options

## Confirmed cause

The previous composition displayed the by-name AI service's three suggestions
even when no usable catalog identity was attached. It also used those same
suggestions as search restrictions. Consequently a source search could succeed
without producing a usable action for any of the three displayed names. Save
was a separate bookmark operation and did not prove a selectable identity.

The observed Development request inspected eight records and returned two
catalog matches while the modal continued to display the AI recommendations.
The earlier isolated one-click check proved persistence for manufactured
matching records, not coverage of the real catalog's naming and missing facts.

The source transport also clipped each page to three references. A public
avocado-oil check found an oil spray and records missing ingredients or nutrition
among the early hits; a complete actual oil appeared later in the same page.
This is why changing only the button or tightening name matching was incomplete.

## Current correction

- Development Shopping searches the original ingredient directly through the
  established providers and product-governance pipeline. It does not generate
  speculative AI product names before finding actual products.
- Cards are constructed from exact catalog records with an existing permitted
  Shopping selection or unverified-reference action. No invented identity,
  unrelated fallback product or disabled filler card supplies the count.
- The bounded catalog-first transport considers up to eight references per page,
  retaining the existing two-read concurrency limit. It searches beyond
  incomplete records and prioritizes usable results before taking up to three.
- Culinary relevance excludes oil-containing sauces, mayonnaise, dressings and
  sprays from plain oil options. Source identity and safety checks remain
  separate and unchanged.
- Explanations contain the actual sourced ingredient declaration and nutrition.
  There is no AI claim of hormone, anti-inflammatory or clinical suitability.
  Retailer availability is explicitly unverified rather than invented.
- One click retains the previously verified compact list and persistence flow.
  Original quantities, units, ingredient, recipe and assessment data are not
  replaced by product nutrition.
- Source dates do not become formulation freshness; reference uncertainty is
  retained internally and is not promoted to eligibility or medical approval.
- The new path is restricted to non-deployed Development. Production continues
  through its previous recommendation composition.

## Verification

- **318 tests passed across nine suites**, including the six requested
  categories: avocado oil, tomato sauce, oatmeal, yogurt, seasoning blend and
  canned beans.
- Regression coverage includes a usable fourth record beyond buffalo sauce and
  an unverified identity, fewer-than-three results, missing facts, stale source
  identity, a known avoided ingredient, outages, and the unchanged deployed path.
- Existing source contracts, selection/reference parsers, persistence,
  independent Save, retailer identity and Production negatives passed.
- The release type gate passed against the unchanged 109-diagnostic baseline.
- A no-write public-catalog run used the real Open Food Facts adapter and the
  real discovery/composition pipeline with a synthetic profile, no customer
  account, no shared-database access and no AI call. It returned three actionable
  actual oils: **Iberia Avocado oil**, **Chosen Foods Avocado oil** and
  **International Collection Avocado Oil**. Sixteen exact-record leads were
  inspected; five unavailable exact reads remained failures rather than being
  fabricated. This proves that source-backed alternatives can be found, not
  retailer stock, physical-package freshness or compatibility for every profile.

Authenticated browser verification uses the existing isolated PostgreSQL and
synthetic provider fixture app, never a customer account. Its six category rows
retain the existing 2 tbsp quantity and recipe metadata. This remains distinct
from the public-catalog check above.

The completed isolated browser pass verified all six categories: each available
card selected in one click and persisted after reload with the exact chosen
name and unchanged 2 tbsp. Avocado displayed two supported products, both
actionable, with no Primal/buffalo-sauce filler. The other five categories
displayed three supported cards each. Change/Clear and restored generic state
passed; the mobile avocado journey had no horizontal overflow. Saved Groceries
remained at its one pre-existing bookmark.

Post-browser read-only SQL compared all nine original fixture rows with their
pre-run snapshots: ingredient, quantity, unit, checked state and original recipe
metadata were unchanged. Each newly selected product's assessment matched its
actual source decision, rather than being silently upgraded or stripped.
The unit suite separately verifies stored uncertainty for unresolved profiles.

Evidence screenshots: desktop source-backed avocado options `9dez0v`,
persisted row `cacgmr`, tomato options `1a89gc`, oatmeal options `pvez73`,
seasoning options `kh95n6`, yogurt options `nyxixf`, canned beans options
`ifx5lh`; mobile options `nrv5s8` and final compact row `s4qhf3`.
The fixture's “Synthetic offline fixture only” declaration is intentional and
does not attest to a real USDA record; the separate public-catalog run used
actual Open Food Facts records.

No push, merge, deployment or publication was performed.
