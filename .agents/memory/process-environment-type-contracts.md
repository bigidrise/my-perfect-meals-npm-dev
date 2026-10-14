---
name: Process environment type contracts
description: Index-signature environment types and why named-key narrowing can fail without a runtime problem.
---

Use the real `NodeJS.ProcessEnv` dictionary type when an optional helper argument accepts `process.env` directly. Read only the environment keys the helper needs, keeping runtime checks explicit.

**Why:** A required `Pick` demanded named properties that the dictionary does not declare. Making that `Pick` partial still triggered weak-type rejection because the source had no declared properties in common. The dictionary type passed a focused strict compiler check without assertions or runtime changes.

**How to apply:** Do not assume a `Partial<Pick<...>>` is assignable from an index-signature-only environment. Verify the helper and its fixtures with a focused strict compiler check. Keep test parameter types derived from the helper so optional keys and defaults remain consistent.
