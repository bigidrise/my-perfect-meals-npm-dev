# Isolated Ask Chef review — Development only

This tool calls the existing `runConciergeConversation` function. It does not
start the server, load an account, call the engine/persistence layer, change
workspace settings, or read/save/delete/archive member conversations.

## Default: offline, no paid calls

```sh
NODE_ENV=development npx tsx scripts/ask-chef-review.ts
NODE_ENV=development npx tsx scripts/ask-chef-review.ts --fixture vegetarian-logged --turn "I'm trying to get more protein." --turn "I don't know my intake."
```

Every invocation creates a new session with empty history, no rolling summary
and no pending recommendation. Repeated `--turn` arguments advance the same
session, retaining the actual selected/displayed reply, not raw rejected model
fields. History and pending state live only in that session's closure. There is
no session registry, database or file output. At most ten turns are allowed.

Fixtures: `vegan-soy-missing` (vegan, soy allergy, missing logs),
`vegetarian-logged` (vegetarian, peanut allergy, partial logs and differing
saved/dated protein targets), `unknown-allergies` (unknown, not explicit-none).
All include synthetic preferences, avoidances and qualified target evidence.

Offline replies are explicitly injected, not model coaching. The offline CLI
blocks fetch and TCP connections, including database connections. Synthetic
transcripts are printed to the terminal; never enter personal member data.

## Optional live review — incurs AI charges

Only after separate approval, add **both** flags:

```sh
NODE_ENV=development npx tsx scripts/ask-chef-review.ts --live --allow-paid-model-calls --fixture vegan-soy-missing --turn "I'm trying to get more protein."
```

The existing OpenAI configuration is used without printing credentials.
Retries are disabled. There is at most one foreground completion per ordinary
turn (the existing runner may answer a closing/safety turn without calling it).
No live calls are part of default verification. Production/published processes
are refused; this tool is not imported by either application entry point.

## Boundaries

- The existing input emergency gate, output food screening, care classification,
  and navigation validation run unchanged. No returned action is executed.
- The harness does not run real-account authorization, entitlement lookup,
  context retrieval, persistence, browser rendering, or long-thread summarization.
  Its synthetic base-member capabilities are not evidence of any real account's access.
- Feature Intelligence activation is not changed.
- Offline tests prove wiring/isolation, not actual model adherence or improved
  coaching. Fresh and continuing live quality still need separately approved review.

## Offline verification

```sh
npx jest --runInBand --globals='{"ts-jest":{"isolatedModules":true}}' server/tests/chefReviewHarness.test.ts
npx tsc -p scripts/ask-chef-review/tsconfig.json
```

The focused type check includes this script and its tests, which the root
application TypeScript include/exclude rules do not cover.
