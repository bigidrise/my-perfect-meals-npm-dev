---
name: TypeScript check cache
description: Why the project-wide strict TypeScript check must run without incremental diagnostic reuse.
---

## Rule

Run the repository-wide strict TypeScript check without incremental build-info
reuse, and keep its compilation target explicitly modern (ES2022 or later).

**Why:** This codebase uses modern iterable APIs throughout. When an older
compiler target or cached build-info is present, TypeScript can replay obsolete
downlevel-iteration diagnostics after the configuration has changed, obscuring
the real current error baseline.

**How to apply:** Treat a clean check as the authority when assessing release
readiness. Do not suppress strict checking to hide the legacy error baseline;
track and remediate genuine contract failures in focused groups.