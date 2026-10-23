# Phase 2D — controlled image comparison results

Date: 2026-10-23. Development only. One authorized run completed.

Approved and independently recomputed manifest SHA-256:
`69b99fc4364adb7d5f4e04e5c9969620ecc8e554f42a5acb3f8886ea5090f181`

Run ID: `phase2d-20261023-d8ae2f13`.

## Recommendation

**Provisionally prefer `gpt-image-2.5-flare-2026-09-08`.** It matched Sunburst's
observed generation success, automated verification results and estimated cost,
while generation was approximately 34.25% faster on average and faster for all
eight matched recipes. Visual fidelity was broadly comparable. Flare's pancakes
looked somewhat puffier; this is a visual impression, not proof of texture.

This is one image per recipe/model, not a statistical reliability study or proof
of clinical/allergen safety. No model was activated. Every further paid request,
model switch or application integration requires separate approval.

## Execution and reliability

| Measure | Flare | Sunburst |
|---|---:|---:|
| Generations succeeded / failed | 8 / 0 | 8 / 0 |
| GPT-4o checks passed / failed / unavailable | 8 / 0 / 0 | 8 / 0 / 0 |
| Mean generation latency | 6.926 s | 10.533 s |
| Median generation latency | 6.918 s | 10.327 s |
| Generation latency range | 5.413–9.161 s | 9.075–12.950 s |
| Mean verification latency | 1.625 s | 1.568 s |
| Verification latency range | 1.154–2.334 s | 1.202–2.322 s |
| Estimated generation charges | $0.06573 | $0.06573 |
| Estimated verification charges | $0.01268 | $0.01268 |
| Estimated total charges | $0.07841 | $0.07841 |

Exactly 16 generation requests and 16 verification requests; maximum one in
flight. No retries, failover, timeouts, cancellation requests, accounting
uncertainty or provider errors were observed. All 32 responses were HTTP 200.
All 16 original images decoded as opaque 1024×1024 PNGs and matched their recorded
SHA-256 digests. Request IDs, stage usage, latency, settings and results are
preserved in the private machine-readable report.

Settings remained: low quality, one image, PNG, opaque, default/auto moderation,
nonstreaming. The approved 150 s generation, 20 s verification and 180 s overall
pair deadlines were retained; no pair approached those deadlines.

## Side-by-side visual fidelity

The agent inspected all 16 images in locally composed A/B sheets before decoding
their model mapping. This is agent visual review, not independent human review.
No additional vision/API calls were made for this inspection.

| Recipe | Flare observation | Sunburst observation |
|---|---|---|
| Berry Coconut Chia Parfait | Hydrated chia base, berries and coconut flakes in one glass. | Same visible components and glass presentation; slightly different layering. |
| Cocoa Oat Brownies | One dark cooled brownie square; somewhat rougher top. | One dark cooled brownie square; smoother cracked top. Neither shows frosting, cream or added nuts. |
| Spinach Berry Smoothie | One blended mauve drink; no separate spinach leaves. | One blended, more purple drink; no separate leaves. Color alone cannot establish spinach content. |
| Lemon Chicken Quinoa Plate | Cooked-looking sliced chicken, cooked quinoa and broccoli. | Same components, with stronger browning and different arrangement. Both have ambiguous dark seasoning/browning specks. |
| Red Lentil Carrot Soup | Thick orange soup, relatively smooth with visible texture. | Thick orange soup with more obvious softened carrot/lentil texture. Neither adds a bread side or cream garnish. |
| Salmon Nori Rice Bowl | Cooked-looking flaked salmon, rice, cucumber, avocado and nori; arranged in sections. | Same components, with more mixed topping placement. Neither clearly adds sesame, egg or mayonnaise. |
| Egg-Free Chicken Cobb-Style Salad | Fresh-looking greens, tomato, avocado and sliced cooked-looking chicken. | Same components with more cubed chicken and a more mixed arrangement. Neither clearly adds egg, bacon or cheese; both have pepper-like specks. |
| Soft Banana Oat Pancakes | Small cooked pancakes appearing somewhat thicker/puffier; no syrup, butter or side egg. | Small cooked pancakes appearing somewhat flatter/browner; no syrup, butter or side egg. Neither displays raw banana separately. |

**Unwanted ingredients / presentation:** No clear extra major food items or
wrong dish formats were identified. Pepper-like dark specks in the chicken and
salad images are a review caveat: pixels cannot reliably distinguish unlisted
seasoning from browning. They are not confirmed ingredient violations, nor
should they be silently certified as authorized. All automated checks returned
PASS despite this ambiguity.

Hidden ingredients, exact grams, portion nutrition, internal cooking temperature,
allergen absence and clinical suitability cannot be established from photographs.
The photographed portions look compatible with the requested serving format;
their actual recipe fractions cannot be verified visually.

## Per-recipe latency

Seconds. G = generation; V = GPT-4o verification.

| Recipe | Flare G | Flare V | Sunburst G | Sunburst V |
|---|---:|---:|---:|---:|
| Parfait | 9.161 | 2.334 | 10.380 | 1.627 |
| Brownies | 7.490 | 2.241 | 9.075 | 1.634 |
| Smoothie | 6.818 | 1.154 | 9.619 | 1.864 |
| Chicken quinoa | 7.017 | 1.597 | 12.950 | 1.202 |
| Lentil soup | 5.413 | 1.479 | 10.047 | 1.236 |
| Salmon bowl | 6.714 | 1.646 | 11.509 | 1.256 |
| Egg-free Cobb | 7.133 | 1.252 | 10.412 | 2.322 |
| Banana pancakes | 5.660 | 1.300 | 10.274 | 1.400 |

## Actual reported usage and estimated charges

| Reported usage, per model's eight-image set | Flare | Sunburst |
|---|---:|---:|
| Generation text-input tokens | 3,738 | 3,738 |
| Generation image-input tokens | 0 | 0 |
| Generation image-output tokens | 1,568 | 1,568 |
| Generation text-output tokens | 0 | 0 |
| GPT-4o verification input tokens | 5,040 | 5,040 |
| GPT-4o verification output tokens | 8 | 8 |

Every generated image reported 196 image-output tokens. Each verification
reported one output token. The paired prompts produced identical reported token
counts for each recipe across the two candidates.

Charges were estimated from those actual usage counts at the reviewed Standard
rates: $5/M generation text input, $8/M image input, $30/M image output;
$2.50/M GPT-4o input and $10/M output. No caching or Batch discount was assumed.

**Combined estimated charges: $0.15682**, comprising $0.13146 generation and
$0.02536 verification. These are token-based estimates, not a provider invoice
or independently reconciled account billing. The consumed marker retains the
full **$4 risk reservation**; it is not a $4 charge and was not refunded/reused.
The $5 planning allowance was not a guaranteed provider billing cap.

## Evidence, retention and safety boundary

Private evidence directory:
`generated-artifacts/image-comparison/private-runs/phase2d-20261023-d8ae2f13/`

The original report and image-audit metadata preserve all image digests and all
32 request IDs, usage objects, outcomes and latencies. Review observations and
the A/B mapping are retained separately. Temporary original PNGs and derived
review sheets are deleted after the completed review; no photographs are placed
in this report, Library, public paths, application storage or saved meals.
The authorization and its `.consumed` marker are retained with private permissions.
Image deletion is not provider-side deletion or a guarantee of provider retention.

No application registry/generator changes, application database/object-storage
writes, meal associations, recovery images, restart, publish, deploy or Production
changes occurred. The run is finished and is not authorized to resume or repeat.
