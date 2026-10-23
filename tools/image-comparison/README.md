# Isolated OpenAI image comparison tooling

Development tooling only. The default tool is still **offline only**. A separate
live adapter completed one explicitly authorized Phase 2D comparison on 2026-10-23;
see `phase2d-results.md`. That authorization is consumed, not reusable. The offline
CLI cannot enable it with flags or environment settings. The live CLI requires
all of the one-shot authorization gates below. Every additional paid run requires
new explicit user approval. No application activation was authorized or performed.
Nothing here is imported by the application; all tooling is excluded from deployment.

## Run offline

```sh
node tools/image-comparison/offline.mjs
node --test tools/image-comparison/runner.test.mjs
NODE_OPTIONS=--max-old-space-size=2048 npx jest --runInBand \
  --globals='{"ts-jest":{"isolatedModules":true}}' \
  server/tests/imageComparisonPromptFreeze.test.ts
```

The first command writes a JSON simulation report to stdout, not to application
storage. All images are the same built-in one-pixel PNG fixture. Offline results
are **not** evidence about either candidate model's quality, access, latency,
verification accuracy, or real token consumption.

Offline arguments, including `--live`, are rejected. The offline CLI has no SDK
or HTTP implementation. Only declarative fixture responses can be simulated. Its import
graph is restricted to this directory and built-in hashing; the CLI alone reads
the committed manifest. There are no application registry, database, storage,
saved-meal, recovery, or publication imports. Prompt generation is a separate
Jest test with application IO dependencies replaced by throwing mocks.

## Frozen evidence

`recipes.mjs` preserves the eight Phase 2A finalized synthetic recipes, including
quantities, preparation, servings and review criteria.
`frozen-prompts.json` contains the exact existing application generation and
verification prompts, per-prompt SHA-256 hashes, source-file fingerprints and an
aggregate manifest digest. The original builder outputs and Phase 2B hashes
are retained alongside the comparison-only corrected text and per-recipe change
records. `phase2b-prompts.json` is the unchanged historical baseline. The pure
`prompt-review.mjs` corrects presentation, incorporates the unchanged method and
yield, and adds explicit visible requirements/exclusions without changing the
application builder. Each recipe's two candidate requests use identical
prompt bytes. Candidate order alternates by recipe; outputs are not selectively
retried. The manifest is validated and cloned/frozen before use.

Normal tests compare against the committed artifact; they never update it.
Intentional artifact regeneration is a separately named, offline action:

```sh
IMAGE_COMPARISON_FREEZE=1 NODE_OPTIONS=--max-old-space-size=2048 npx jest \
  --runInBand --globals='{"ts-jest":{"isolatedModules":true}}' \
  server/tests/imageComparisonPromptFreeze.test.ts
```

This generates the manifest and a self-contained review document at
`generated-artifacts/image-comparison/frozen-prompts.html`. It does not generate
images. Generated documents/results are ignored by Git and deployment.
The committed manifest is source evidence, not a generated-image asset.

## Prepared request and deadline policy

* Snapshots: `gpt-image-2.5-flare-2026-09-08` and
  `gpt-image-2.5-sunburst-2026-09-08`.
* Only `POST https://api.openai.com/v1/images/generations` is allowed for
  generation, with `n: 1`, `1024x1024`, `quality: low`, `output_format: png`,
  `background: opaque`, `moderation: auto`, and `stream: false`.
* Never send the legacy `response_format` or image-edit/reference/partial-image
  parameters. Do not use Batch or Responses orchestration for this comparison.
* Generation: 150 seconds; verification: 20 seconds; overall pair: 180 seconds.
  Each stage receives the lesser of its own deadline and the remaining overall
  time. No automatic generation, validation, network, or SDK retries.
* Verification is separately allowlisted to
  `POST https://api.openai.com/v1/chat/completions`, model `gpt-4o`,
  `max_tokens: 60`, low image detail and the frozen existing validation prompt.
  Only a strict `PASS` or `FAIL:` is accepted. Unlike the legacy application
  parser, unexpected output is unavailable, not implicitly passed.
* At most 16 generations and 16 verifications; one call at a time.
  A harness instance is single-use, including after failure. No resume,
  regeneration, recovery, automatic replacement, failover or model selection.
* On uncertain timeout or transport failure: stop the whole run, request abort
  when the deadline expires, keep reservations, record cancellation as
  unconfirmed, and ignore late output. Do not dispatch the next cell.

## Spending-risk accounting

The proposed **$5 allowance is not a guaranteed provider billing cap**.
Reservations are $0.25 per recipe/model operation, covering generation and
verification together. Sixteen dispatches reserve $4, leaving $1 of the
allowance unused. Reservations are not automatically refunded, including on
errors, known completions, missing usage and uncertain timeouts.
The retained $0.50 per-operation ceiling is separate; this comparison permits
one attempt, not three. There is no shared ledger across OS processes.

Observed usage is calculated at full Standard rates:

* Generation: $5/M text-input, $8/M image-input, $30/M image-output tokens.
* GPT-4o verification: $2.50/M input and $10/M output tokens.
* No cached-input discount or Batch discount is inferred.
* Missing, inconsistent or invalid usage stops further dispatch and marks
  accounting uncertain. Partially known costs remain explicitly incomplete.
* If observed cost exceeds the reservation, stop and report it; a local
  reservation cannot retroactively stop provider charges.
* Reports retain sanitized `req_...` or UUID provider request IDs, per-stage
  latency, HTTP status, usage, estimated costs, verification outcomes and image
  digests. Reports contain no image bytes, credentials or raw provider errors.

The default synthetic usage produces $0.6496 in **fixture arithmetic**, not a
prediction. A 4,000-image-output-token scenario with the same assumed inputs and
verifier would cost $2.0896 for 16 pairs. Neither is a bound.

Documentation reviewed during Phase 2A:
https://developers.openai.com/api/docs/pricing
https://developers.openai.com/api/docs/guides/image-generation
https://developers.openai.com/api/docs/models/gpt-image-2.5-flare
https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst

## Comparison-only prompt corrections

All eight prompts replace generic presentation instructions with the finalized
method, original recipe yield, one-serving presentation and explicit exclusions.
The original ingredient strings/quantities and authorization/identity rules
remain unchanged. The misleading "required visible" heading is relabeled as
authorized ingredients: incorporated water/oil/flour/egg need not be shown as
separate raw food. The salad is fresh rather than hot/warm; chicken remains
cooked. Pancake egg and banana are incorporated rather than side dishes.
Verification retains the original fidelity checks and adds only observable
preparation/presentation requirements, not gram/nutrition/clinical inference.
The original and corrected bytes, old/new hashes and change explanations are
in the manifest and generated review document.

## Exact authorization requirements for a future paid test

**Do not create approval files or execute the live CLI until the user separately
approves paid execution of the corrected manifest.** Preparation approval is not
execution approval. No npm script, workflow, server route or test activates it.

After that explicit approval, create ONE private (mode 0600) JSON file at
`generated-artifacts/image-comparison/authorizations/<run-id>.json`. It must contain:

* `kind`: `explicit-image-comparison-authorization`
* `context`: `development`
* `manifestSha256`: the exact current corrected manifest digest
* `models`, `settings`, `limits`: exact copies of the frozen models/settings and
  LIMITS in `recipes.mjs`, with no broadened scope
* `verifier`: `gpt-4o`
* `acceptsNonGuaranteedBillingCap`: `true`
* `allowTemporaryPrivateArtifacts`: `true`
* A unique lowercase alphanumeric/hyphen `runId` (8–64 characters)
* `expiresAt`: a valid timestamp after execution start and at most one hour away

No API key goes in that file. The credential is loaded from the existing
`OPENAI_API_KEY` only at validated dispatch and never reported or logged.
No secret values were accessed during preparation.

Direct invocation additionally requires the process-only
`IMAGE_COMPARISON_CONTEXT=development`, a non-production/non-test process, no
deployment/test-runner marker, and the exact CLI arguments:

```text
node tools/image-comparison/live-cli.mjs \
  --execute-explicitly-authorized-comparison \
  generated-artifacts/image-comparison/authorizations/<run-id>.json
```

This is documentation, not an instruction or authorization to execute now.
The CLI atomically writes a `.consumed` marker before credential loading or
dispatch. It remains after rejection, errors, unknown billing or crashes.
It conservatively retains the full $4 risk claim; it does not assert a $4 charge.
No resume, automatic retry or reuse is permitted. Any replacement authorization
requires renewed user approval, not merely changing the run ID.

`live-adapter.mjs` requires explicit dependency injection, has no default fetch or
credential source, allows only the two fixed HTTPS POST endpoints, disables
redirect following, validates exact request bytes/settings/order, caps response
size and validates PNG dimensions/container/checksums and bounded decompression.
Its in-flight and dispatch counters are independent of the engine's counters.
Uncertain transport/abort stops the whole run; no late artifact writes occur.
The Phase 2D run accepted actual usage from all 32 approved requests. This is
evidence for that run only, not a guarantee of future provider compatibility.

## Temporary review artifacts

The authorized live CLI alone can create:
`generated-artifacts/image-comparison/private-runs/<run-id>/`
with private 0700 directories, 0600 PNGs/report, exclusive creation/no overwrites
and no symlink traversal. No URLs, app uploads, saved-meal associations or
application persistence APIs exist. No images were created by this preparation
except synthetic test fixtures in temporary directories, removed after tests.
Review deletion is manual, recommended within 24 hours. Preserve authorization
consumed markers even after deleting images. No scheduler or release changes
were added. Disk/process failure can leave partial artifacts; there is no
automatic resumption or claim of distributed billing enforcement.

## Remaining boundaries

* No pediatric clinical/age context was invented. No clinical certification.
* No documented hard all-in cost bound or image output-token cap was established.
  $0.25 is an acknowledged risk allowance; $5 is not a guaranteed billing cap.
* One eight-recipe paired run is documented in `phase2d-results.md`. Broader
  reliability, generation variability and clinical/allergen safety are not proven.
  Provider billing reconciliation remains separate from estimated token charges.
* Installed web/iOS compatibility and application activation remain separate.
* The corrected prompts are comparison-only. Nothing changes the application
  image generator, active registry, nutrition calculations or saved photographs.
