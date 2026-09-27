---
name: One-Touch Creator authority
description: Why delegated Creator generation needs both canonical meal validation and a supported request-scoped dietary choice.
---

One-Touch is a delegated food request, not permission to invent compliance evidence. Completed meals need safety-equivalent authority checks, including protocol, diabetes, GLP-1, dish identity, serving normalization, and post-format validation. The Menu-owned path is deliberately separate from the live manual Creator routes; a direct generator plus a generic output scan is not an equivalent substitute.

**Why:** The canonical Create a Dish path intentionally ignores ordinary dietary override input. A separate One-Touch modal's explicit eating-style choice would be silently lost even if its recipes were generated through that handler. A generic scan also cannot attest numeric diabetes or GLP-1 compliance. The user clarified that MPM's temporary choices are not restricted to a newly invented “more restrictive only” hierarchy.

**How to apply:** Reuse MPM-style one-generation cuisine and dietary choices; the saved profile resumes afterward. Keep existing food-conflict and allergy acknowledgements separate, exact, and authorized through their existing UX, never a new One-Touch waiver. Both Menus expose servings, cuisine, and dietary preference; Craving Menu alone also exposes independent culinary Type and Feel. Preserve religious/specialty protections, allergies, avoidances, and clinical rules; do not broaden manual Creator defaults as a shortcut.

Menu-owned flows must not modify the existing manual Craving Creator or Create a Dish behavior just to gain a one-candidate mode. An internal count parameter threaded through their shared generator and live route is still a change to those originals, even if the manual default stays at three.

**Why:** The user requires the Menu options to be independently owned and does not accept regression risk in the working manual Creators for Menu optimization.

**How to apply:** Reuse lower-level policy and validation primitives where safely possible, but do not claim that a separate Menu path has the exact canonical safety sequence until that parity is established and verified. If zero changes to the active route and generator are a hard boundary, the existing three-candidate route cannot simply be made one-candidate by configuration.

The accepted Creator Menu architecture lets the Menu own three concepts and a trusted selection; the established manual Creator generation and final-validation primitives own completion. This supersedes treating the legacy Menu-only exact-evidence engine as the active completion contract. Simply passing a title to a general generator is still insufficient because the generator permits alternate meals.

**Why:** The user chose alignment with the working manual Creator completion behavior, while insisting that a selected concept must never silently become another dish or bypass the current user's protections. The older Menu-specific exact gate produced frequent safe-but-unusable rejections.

**How to apply:** Use a server-stored concept and current account authority; require its identity and defining ingredients before and after completion. Pass only authorized request-scoped diet replacement to shared generation, retain clinical and protocol checks, normalize per-serving evidence before validating a scaled card, and reject unsupported specialist directives. The legacy engine stays intact until live provider and authenticated acceptance verify the handoff. Do not describe shared primitives as full manual route parity while route-only allergy/glucose adaptation is absent.

A passed negative protocol scan cannot serve as positive evidence of a compositional diet or a numeric clinical limit, and model-estimated macros are not independently verified nutrition. Unsupported evidence must stay review-required or be rejected, even if this reduces the number of concepts that can finish automatically.

**Why:** A scan can miss a high-risk diabetic macro excess or an unmeasured specialty limit; labeling either as compliant would make an apparently finished card unsafe.

**How to apply:** Require the actual state-aware diabetic and GLP-1 validators for those conditions; never derive keto/specialty compliance flags solely from a clean text scan. Keep unavailable dietary and clinical evidence fail-closed until a trustworthy positive validator exists.

For Menu recipe completion, the shared compound-aware classifier can substantiate bounded vegan, vegetarian, pescatarian, and carnivore ingredient identities from explicit final ingredients; it cannot substantiate a keto meal's numeric or full composition claim. Beverage-specific keto limits and Chef prompt guidance are not product-wide finished-meal thresholds.

**Why:** Reusing a beverage ceiling or model-estimated macros as independently verified keto composition would invent a meal policy. The existing identity classifier has a narrower, ingredient-based authority.

**How to apply:** Recheck supported identity classification after final serving formatting. Keep keto, paleo, Mediterranean, and other unsupported composition identities review-required until a shared authoritative meal rule and suitable evidence source exist.

The positive-evidence contract must distinguish each active requirement and its producer. Legacy Creator booleans retain their historical meaning for manual-style completion, but they must not become proof for a separate strict Menu claim.

**Why:** A single true dietary flag can otherwise certify unrelated nutrition, clinical, and program rules that were never checked. The user wants eventual support for more identities without inventing their policies first.

**How to apply:** When using an exact-evidence policy, resolve each requirement separately. Do not promote a passed protocol scan or model nutrition estimate to independently verified composition or specialist clinical proof merely because the selected concept was trusted.

The user accepted a shared culinary concept engine for MPM and Creator Menus, with separate destinations. Each Creator Menu presents exactly three governed concepts before any finished recipe is requested; only the selected server-owned concept is completed.

**Why:** Sharing creative direction avoids divergent generation rules, but a concept is never evidence of safety or nutrition. Completing all three before selection wastes work and misrepresents a conceptual choice as a validated meal. Browser-restored concepts become unsafe when authoritative food protections change.

**How to apply:** Keep concept and completed-meal gates distinct. Re-resolve authority for restoration and again on selection; the browser stores only request choices, not concept text or IDs. The server stores one current set per Creator and only current, exact IDs can be selected. Suppress stale ideas rather than trusting a browser marker.

Creator Menu restoration should display the existing bouncing-dot progress immediately while server authority is checked, even if that check takes several seconds. Never make it appear instant by showing cached concepts before validation.

**Why:** The user confirmed that waiting is acceptable when it protects against changed diet, allergy, avoidance, or other authority; the problem was an unexplained blank state, not the verification itself.

**How to apply:** Keep restoration, new-concept generation, and selected-recipe completion as separate visible states on both Creator Menus. End the restoration indicator on valid, empty, or failed responses without changing server verification.

Concept rejection and unsupported completed-recipe evidence must have distinct outcomes.

**Why:** A concept can be replaced before display while preserving safe siblings, but a completed recipe's failed safety check must not silently substitute a different meal for the user's choice. A clinical directive with no positive evidence cannot be made safe by another recipe.

**How to apply:** Use bounded refill for rejected concepts before presenting exactly three. On Choose This, complete only that concept; if final safety fails, show an explicit failure without serving a sibling or claiming unsupported evidence.

Do not let legacy finished-card markers authorize the concept menu.

**Why:** A previous generation of the Creator Menu stored completed-card markers, but the new concept-stage authority lives on the server and must not be inferred from old client caches.

**How to apply:** Restore only from the Creator-owned server set and its current context fingerprint. Clear legacy finished-card markers when a new concept set is created; keep manual Creator caches isolated.

Fingerprint authority must include the substance of daily nutrition and its provenance, but not the provenance calculation timestamp. This applies both to general food-context nutrition and the separately resolved GLP-1 daily nutrition state. Two consecutive resolutions of unchanged Dev nutrition data produced different fingerprints solely because that timestamp records each calculation time.

**Why:** Including computation time invalidates newly generated and restored cards even when no food protections changed. The GLP-1 state is a separate branch, so normalizing the food-context timestamp alone does not prevent this failure. Excluding the entire provenance would incorrectly hide a real classification or source change.

**How to apply:** Canonicalize only non-authoritative calculation-time fields; retain status, nutrition values, provenance sources, and fail-closed comparison for meaningful changes. Diagnose future mismatches with field names only, never raw profile or clinical values.