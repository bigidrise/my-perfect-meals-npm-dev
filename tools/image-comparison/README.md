# Offline OpenAI image comparison harness

Development tooling only. **There is no live adapter, credential loading, or
paid-execution flag.** This tool cannot execute even one real API request.
Adding a live transport requires a separate code review and explicit approval.
It is not imported by the application and is excluded from deployment files.

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

Arguments, including `--live`, are rejected. No SDK or HTTP implementation is
present. Only declarative fixture responses can be simulated. The runtime import
graph is restricted to this directory and built-in hashing; the CLI alone reads
the committed manifest. There are no application registry, database, storage,
saved-meal, recovery, or publication imports. Prompt generation is a separate
Jest test with application IO dependencies replaced by throwing mocks.

## Frozen evidence

`recipes.mjs` preserves the eight Phase 2A finalized synthetic recipes, including
quantities, preparation, servings and review criteria.
`frozen-prompts.json` contains the exact existing application generation and
verification prompts, per-prompt SHA-256 hashes, source-file fingerprints and an
aggregate manifest digest. Each recipe's two candidate requests use identical
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
* At most 16 generations and 16 verifications; one simulated call at a time.
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

## Review issues before paid execution

1. The existing prompt builder accepts name, ingredient strings and source type;
   it does **not** accept method or servings. These remain fixture evidence;
   they were not silently appended, inferred or introduced as new parameters.
2. Exact existing prompts can contradict their fixtures: the salad identity
   calls for fresh salad while the generic meal anchor demands a hot/warm dish.
   The breakfast anchor also mentions eggs/proteins generically.
   Review frozen text before treating output differences as model failures.
3. No pediatric age/clinical context was invented for the pancake fixture.
   This is not a clinical or actual-child validation.
4. No documented hard all-in upper charge is established, nor an image output
   token cap. The $0.25 reservation is a proposed risk allowance only. Explicit
   approval of this risk and actual usage reconciliation is still required.
5. Both candidates and the verifier remain untested on real paid execution.
   Older web/iOS behavior and application activation are unchanged and untested
   by this isolated tooling.
6. A paid adapter must preserve all these guards, isolate review-only image
   handling without application uploads, and obtain approval for any local
   image-file output. Blind quality review is not implemented by the offline
   metadata runner. Nothing in this package is an authorization to run it live.
