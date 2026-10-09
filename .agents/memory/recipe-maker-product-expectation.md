---
name: Recipe Maker product expectation
description: User-stated requirement for Recipe Maker generation reliability.
---

The user stated: “Recipe Maker needs to make recipes no matter what,” including with GLP-1.

**Why:** The user stated this requirement after two failed Recipe Maker attempts.

**How to apply:** Use this as the product expectation when assessing Recipe Maker generation and recovery behavior.

The user also requires preserving the requested food identity while adapting ingredients and portions to the selected nutrition plan, without weakening applicable medical, allergy, or dietary restrictions.

**Why:** The user supplied this direction and confirmed that the identity-preserving correction, with safeguards retained, was the correction they wanted.

**How to apply:** Do not replace a named pastry with a generic protein bowl merely to produce an option. Report a genuine unresolved restriction rather than claiming every food can be generated.

Category recognition and numeric compliance alone do not prove that a recipe passes its complete clinical validation.

**Why:** A low-fat pastry fixture still failed an established ingredient rule. A mocked category handoff would have missed that limitation.

**How to apply:** Test representative ingredients with the actual clinical validator and negative controls. Do not rename ingredients or mock acceptance just to make a recovery test pass.

GLP-1 medication use alone should not universally prohibit a requested pastry; assess portions, ingredients, composition, individual tolerability, and applicable clinical restrictions.

**Why:** The user explicitly stated this product requirement when asking for a separate review of the existing pastry restriction.

**How to apply:** Verify the clinical basis of a restriction before recommending a policy change. Keep that review separate from recipe-formatting corrections, and preserve genuine safety requirements.
