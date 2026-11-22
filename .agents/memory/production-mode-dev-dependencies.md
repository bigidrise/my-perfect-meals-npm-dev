---
name: Production-mode development dependencies
description: Explains why declared TypeScript development dependencies may be absent from the workspace.
---

When the workspace runs with `NODE_ENV=production`, npm may omit declared development dependencies even when an explicit install reports that they are already current. Missing React declarations can then produce widespread false JSX and implicit-`any` diagnostics.

**Why:** A Hydration diagnostic pass showed hundreds of apparent source errors, but the declared React type packages were absent from `node_modules`; installing them with development dependencies available reduced the file to zero diagnostics.

**How to apply:** When an LSP cannot resolve a declaration already listed in `devDependencies`, verify its physical presence before editing source. Restore the declared package without permanently moving it into production dependencies, then rerun focused diagnostics.

An explicit package-install request does not override npm's production-mode
omission. For a controlled validation repair, explicitly include development
dependencies during installation and verify the declaration and test-environment
files exist afterward. Restore any temporary npm configuration and unrelated
manifest edits before delivery.

**Why:** Installation reported success while React declarations and the jsdom
Jest environment remained absent; explicitly including development dependencies
restored both and allowed the regression suites to execute.

**How to apply:** Do not repeat an unchanged install after a false-success result.
Keep the existing dependency categories and compiler baseline. Respect package
firewall blocks; use a compatible allowed patch rather than bypassing security.