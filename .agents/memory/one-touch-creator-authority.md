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

A passed negative protocol scan cannot serve as positive evidence of a compositional diet or a numeric clinical limit, and model-estimated macros are not independently verified nutrition. Unsupported evidence must stay review-required or be rejected, even if this reduces the number of concepts that can finish automatically.

**Why:** A scan can miss a high-risk diabetic macro excess or an unmeasured specialty limit; labeling either as compliant would make an apparently finished card unsafe.

**How to apply:** Require the actual state-aware diabetic and GLP-1 validators for those conditions; never derive keto/specialty compliance flags solely from a clean text scan. Keep unavailable dietary and clinical evidence fail-closed until a trustworthy positive validator exists.

For Menu recipe completion, the shared compound-aware classifier can substantiate bounded vegan, vegetarian, pescatarian, and carnivore ingredient identities from explicit final ingredients; it cannot substantiate a keto meal's numeric or full composition claim. Beverage-specific keto limits and Chef prompt guidance are not product-wide finished-meal thresholds.

**Why:** Reusing a beverage ceiling or model-estimated macros as independently verified keto composition would invent a meal policy. The existing identity classifier has a narrower, ingredient-based authority.

**How to apply:** Recheck supported identity classification after final serving formatting. Keep keto, paleo, Mediterranean, and other unsupported composition identities review-required until a shared authoritative meal rule and suitable evidence source exist.

The positive-evidence contract must distinguish each active requirement and its producer. Legacy Creator booleans may retain their historical meaning for unchanged callers, but they must not become proof for new strict Menu claims.

**Why:** A single true dietary flag can otherwise certify unrelated nutrition, clinical, and program rules that were never checked. The user wants eventual support for more identities without inventing their policies first.

**How to apply:** Resolve exact evidence separately for every active Menu requirement; keep unproven identities unavailable while allowing a future limited Menu rollout for independently supported identities. Do not interpret a passed protocol scan or a model nutrition estimate as verified composition.

The user accepted a shared culinary concept engine for MPM and Creator Menus, with separate destinations. Each Creator Menu presents exactly three governed concepts before any finished recipe is requested; only the selected server-owned concept is completed.

**Why:** Sharing creative direction avoids divergent generation rules, but a concept is never evidence of safety or nutrition. Completing all three before selection wastes work and misrepresents a conceptual choice as a validated meal. Browser-restored concepts become unsafe when authoritative food protections change.

**How to apply:** Keep concept and completed-meal gates distinct. Re-resolve authority for restoration and again on selection; the browser stores only request choices, not concept text or IDs. The server stores one current set per Creator and only current, exact IDs can be selected. Suppress stale ideas rather than trusting a browser marker.

Concept rejection and unsupported completed-recipe evidence must have distinct outcomes.

**Why:** A concept can be replaced before display while preserving safe siblings, but a completed recipe's failed safety check must not silently substitute a different meal for the user's choice. A clinical directive with no positive evidence cannot be made safe by another recipe.

**How to apply:** Use bounded refill for rejected concepts before presenting exactly three. On Choose This, complete only that concept; if final safety fails, show an explicit failure without serving a sibling or claiming unsupported evidence.

Do not let legacy finished-card markers authorize the concept menu.

**Why:** A previous generation of the Creator Menu stored completed-card markers, but the new concept-stage authority lives on the server and must not be inferred from old client caches.

**How to apply:** Restore only from the Creator-owned server set and its current context fingerprint. Clear legacy finished-card markers when a new concept set is created; keep manual Creator caches isolated.

Fingerprint authority must include the substance of daily nutrition and its provenance, but not the provenance calculation timestamp. Two consecutive resolutions of unchanged Dev nutrition data produced different fingerprints solely because that timestamp records each calculation time.

**Why:** Including computation time invalidates newly generated and restored cards even when no food protections changed; excluding the entire provenance would incorrectly hide a real classification or source change.

**How to apply:** Canonicalize only non-authoritative calculation-time fields; retain status, nutrition values, provenance sources, and fail-closed comparison for meaningful changes. Diagnose future mismatches with field names only, never raw profile or clinical values.