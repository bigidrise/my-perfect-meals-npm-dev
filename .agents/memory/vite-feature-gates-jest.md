---
name: Vite-only feature gates in Jest
description: Why client feature gates should be isolated from modules used by the CommonJS test runner.
---

Keep `import.meta.env` feature gates in a small browser-only module rather than a request helper that Jest imports. Mock the gate module in the helper test; leave Vite's own Dev/production replacement in control of browser behavior.

**Why:** CommonJS Jest cannot parse `import.meta` at all, even if the test only imports an unrelated function from the same module. This makes a valid request-helper test fail before it executes.

**How to apply:** When a client module must work under both Vite and Jest, separate environment gating from portable request logic. Do not replace the production fail-closed gate merely to make the test pass.