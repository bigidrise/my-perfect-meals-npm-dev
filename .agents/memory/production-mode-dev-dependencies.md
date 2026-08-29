---
name: Production-mode development dependencies
description: Explains why declared TypeScript development dependencies may be absent from the workspace.
---

When the workspace runs with `NODE_ENV=production`, npm may omit declared development dependencies even when an explicit install reports that they are already current. Missing React declarations can then produce widespread false JSX and implicit-`any` diagnostics.

**Why:** A Hydration diagnostic pass showed hundreds of apparent source errors, but the declared React type packages were absent from `node_modules`; installing them with development dependencies available reduced the file to zero diagnostics.

**How to apply:** When an LSP cannot resolve a declaration already listed in `devDependencies`, verify its physical presence before editing source. Restore the declared package without permanently moving it into production dependencies, then rerun focused diagnostics.