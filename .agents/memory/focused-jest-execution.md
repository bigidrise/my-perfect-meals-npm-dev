---
name: Focused Jest execution
description: Avoid full-program ts-jest memory overhead for targeted regression checks.
---

Run focused Jest checks with isolated transpilation and perform TypeScript checking separately. Do not run full-program ts-jest alongside a project-wide TypeScript program.

**Why:** Disabling Jest diagnostics does not prevent ts-jest from loading the large TypeScript project. A focused run exhausted a 768 MB heap before executing tests; isolated transpilation completed the same checks quickly.

**How to apply:** Enable ts-jest's isolated compilation mode for the test invocation, without changing the app's TypeScript configuration. Keep the separate release type gate. On the current Jest setup, the invocation-level override `--globals='{"ts-jest":{"isolatedModules":true}}'` works, though ts-jest warns that this configuration form is deprecated.

Temporary inline Jest configurations must preserve narrow test roots; explicit test-file arguments do not replace limiting discovery.

**Why:** A temporary configuration without roots spent its time before test results appeared. An inline configuration with bounded roots and transformer-level isolated compilation completed the regression checks without changing project configuration.

**How to apply:** Retain the relevant configured test roots in diagnostic overrides. If a run emits only configuration warnings, do not report tests as passed; preserve its log and use a bounded configuration.

Do not apply a focused-test heap limit to the root TypeScript release check.

**Why:** A 2 GB heap exhausted on both an untouched Production-source base and its isolated candidate before either produced diagnostics. That is an execution-resource failure, not evidence of changed TypeScript debt.

**How to apply:** Give the root compiler an adequate separate heap budget, such as 6 GB, and rerun only the failed type layer. Preserve valid build and safety-check results; never refresh a diagnostic baseline to address an out-of-memory failure.

Verify a nested worktree's actual repository root and revision before editing or using Git there.

**Why:** A restored nested worktree lost its `.git` link while its files and registration survived. `git -C` silently fell through to the parent repository instead of reporting the candidate revision.

**How to apply:** Check `rev-parse --show-toplevel` and the expected commit, not just directory existence. Repair the existing Development worktree registration before proceeding; never substitute edits or commits in the parent checkout.

Do not rely on a release-check wrapper's cleanup when an external shell deadline
can kill it during synchronous compilation. Preserve ignored generated build
metadata before imposing such a deadline; remove only a confirmed abandoned lock.

**Why:** An external timeout killed the wrapper before its cleanup ran, leaving
its temporary lock and Development build-metadata stub behind without compiler
output. A missing result must be reported as an incomplete check, not a pass.

**How to apply:** Prefer a sufficiently bounded background run with streamed
output and a saved metadata copy. Confirm the compiler and wrapper have exited
before cleaning up their temporary state; never overwrite another run's lock.

Stream or save verification output while commands run, rather than buffering subprocess output and writing it only after completion.

**Why:** A parent timeout can discard all buffered child output, hiding which phase stalled and making a tooling timeout look like an application failure.

**How to apply:** Capture output as it arrives and check build/test phases separately when investigating a timeout. Do not treat a narrow passing check as proof that the full application is verified.

Avoid full-root compiler-host or filesystem-overlay comparisons as a quick way to prove a diagnostic mismatch predates a narrow change.

**Why:** Both comparison approaches stalled beyond multi-minute timeouts in this project, yielding no baseline proof.

**How to apply:** Inspect the complete current compiler output and keep an unexplained release fingerprint mismatch explicitly unresolved rather than repeatedly compiling synthetic before/after programs.

Run an in-memory PostgreSQL test engine in a Node worker when its Node dynamic imports are incompatible with Jest's VM.

**Why:** PGlite initialization failed under the existing Jest loader with a missing dynamic-import callback. A normal Node worker supports those imports without changing the project's global Jest module mode.

**How to apply:** Keep the engine entirely in memory and pass only synthetic SQL fixtures across the worker boundary. Do not substitute the application database or change global test-loader behavior to make these checks pass.

## Provider and database isolation

Synthetic identities and a test's description do not establish isolation. Mock database and paid-provider modules before importing routes, including pre-existing regression suites.

**Why:** An existing paywall suite used synthetic identities but still executed live conversation reads/writes and text-coaching calls. Pure summary imports also initialized the real database transitively.

**How to apply:** Inspect dependency mocks before running a no-save/no-paid check. Make unexpected external calls fail locally. If a boundary is crossed, disclose it, inspect only synthetic metadata with a read-only transaction, and obtain permission before shared-record cleanup.

Database fixtures must respect the query's selected columns rather than returning the entire fixture.

**Why:** A stage-propagation test passed while the real query omitted the saved stage and due date, because the fixture supplied fields that PostgreSQL would not return.

**How to apply:** Project fixtures using the requested selection and assert that required fields map to their actual schema columns.
