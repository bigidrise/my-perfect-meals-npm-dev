---
name: Focused Jest execution
description: Avoid full-program ts-jest memory overhead for targeted regression checks.
---

Run focused Jest checks with isolated transpilation and perform TypeScript checking separately. Do not run full-program ts-jest alongside a project-wide TypeScript program.

**Why:** Disabling Jest diagnostics does not prevent ts-jest from loading the large TypeScript project. A focused run exhausted a 768 MB heap before executing tests; isolated transpilation completed the same checks quickly.

**How to apply:** Enable ts-jest's isolated compilation mode for the test invocation, without changing the app's TypeScript configuration. Keep the separate release type gate. On the current Jest setup, the invocation-level override `--globals='{"ts-jest":{"isolatedModules":true}}'` works, though ts-jest warns that this configuration form is deprecated.

Stream or save verification output while commands run, rather than buffering subprocess output and writing it only after completion.

**Why:** A parent timeout can discard all buffered child output, hiding which phase stalled and making a tooling timeout look like an application failure.

**How to apply:** Capture output as it arrives and check build/test phases separately when investigating a timeout. Do not treat a narrow passing check as proof that the full application is verified.

Avoid full-root compiler-host or filesystem-overlay comparisons as a quick way to prove a diagnostic mismatch predates a narrow change.

**Why:** Both comparison approaches stalled beyond multi-minute timeouts in this project, yielding no baseline proof.

**How to apply:** Inspect the complete current compiler output and keep an unexplained release fingerprint mismatch explicitly unresolved rather than repeatedly compiling synthetic before/after programs.

Run an in-memory PostgreSQL test engine in a Node worker when its Node dynamic imports are incompatible with Jest's VM.

**Why:** PGlite initialization failed under the existing Jest loader with a missing dynamic-import callback. A normal Node worker supports those imports without changing the project's global Jest module mode.

**How to apply:** Keep the engine entirely in memory and pass only synthetic SQL fixtures across the worker boundary. Do not substitute the application database or change global test-loader behavior to make these checks pass.
