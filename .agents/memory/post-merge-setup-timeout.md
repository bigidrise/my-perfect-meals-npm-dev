---
name: Post-merge setup timeout
description: The repository post-merge script runs install, integrity checks, and production builds sequentially.
---

The post-merge setup timeout must allow for the full sequential script, not just the fastest individual build. A 120-second limit was too short; a 240-second limit completed successfully.

**Why:** The script performs dependency installation, route integrity checks, a server TypeScript scan, and client/server production builds before workflow reconciliation. Build output can look complete while the wrapper is still inside the timeout window.

**How to apply:** If the script remains unchanged and a merge reports a timeout, inspect the full log first and prefer a bounded timeout increase over removing safety checks. Re-measure after script changes.