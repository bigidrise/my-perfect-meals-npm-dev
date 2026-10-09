---
name: Focused Jest execution
description: Avoid full-program ts-jest memory overhead for targeted regression checks.
---

Run focused Jest checks with isolated transpilation and perform TypeScript checking separately. Do not run full-program ts-jest alongside a project-wide TypeScript program.

**Why:** Disabling Jest diagnostics does not prevent ts-jest from loading the large TypeScript project. A focused run exhausted a 768 MB heap before executing tests; isolated transpilation completed the same checks quickly.

**How to apply:** Enable ts-jest's isolated compilation mode for the test invocation, without changing the app's TypeScript configuration. Keep the separate release type gate. On the current Jest setup, the invocation-level override `--globals='{"ts-jest":{"isolatedModules":true}}'` works, though ts-jest warns that this configuration form is deprecated.
