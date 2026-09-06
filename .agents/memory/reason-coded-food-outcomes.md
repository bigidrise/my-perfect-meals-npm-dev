---
name: Reason-coded food outcomes
description: Product contract for explaining food recommendations that are adapted, blocked, or held for review.
---

Every understood food request must resolve to fulfilled, adapted, blocked-with-reason, or review-required-with-reason. Generic failure language is reserved for genuine technical failures.

When the platform changes the requested dish, primary protein, ingredients, or preparation, it must tell the user both what changed and which actual resolved rule required the change. Never infer a medical reason from a broad diagnosis when a specific sodium, saturated-fat, glucose, allergy, diet, avoidance, clinician, or other governing finding did not fire.

If no validated rule authorizes a primary dish or protein substitution, reject the substitution rather than silently presenting it.

**Why:** The product promise is a trustworthy chef that makes informed decisions and explains them. Silent substitutions and generic errors hide intelligence the safety and nutrition systems already possess and prevent users from understanding or evaluating a recommendation.

**How to apply:** Carry structured validator findings through server responses into approved user-facing banners, notices, or modals across every food surface. Preserve generic safe copy only for provider, network, malformed-response, and unexpected software failures.