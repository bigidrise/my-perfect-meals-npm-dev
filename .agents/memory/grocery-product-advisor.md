---
name: Grocery Product Advisor — Find a Product mode
description: Clinical fail-closed and usualPick validation rules for the shared product-advisor engine
---

- All Grocery Coach product surfaces (Find a Product, Replace, meal-driven Smart Cart) share `buildGroceryCoachContext()` + `buildProtocolContextString()` in `productAdvisor.ts`. Never rebuild personalization from the raw envelope.
- **Fail-closed rule:** product advice for GLP-1 users must throw `ClinicalContextUnavailableError` (route → 503 `retryable: true`) when `ctx.glp1Failed` or `glp1Active && !glp1Targets` — same policy as `/recommend`. **Why:** a resolver outage must never let a GLP-1 user get recommendations without fat/calorie ceilings; code review rejected the fail-open version.
- **usualPick rule:** the model-asserted `usualPick` must be server-validated against `ctx.compliantSavedRows` (not `savedRows` — those are unfiltered) and deduplicated out of `recommended` via `sanitizeUsualPicks()`. The model can hallucinate "usual picks".
- **UI rule:** the Build a Meal | Find a Product mode tabs must render in ALL sheet states, including meal loading/result — review rejected tabs gated on `phase === "idle"` because Find a Product became unreachable after a meal result.
- Client product session persists under `grocery-coach-product-search:<userId>` (24h expiry), separate from the meal `grocery-coach-session:<userId>` key.
