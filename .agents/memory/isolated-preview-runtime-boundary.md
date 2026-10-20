---
name: Isolated preview runtime boundary
description: Keep private Vite preview approval and React test execution separate from the main application's runtime configuration.
---

A private Development preview must use its own explicit preview approval rather than relying on the main application's inherited runtime mode or changing environment variables to make it render.

**Why:** An independently running Vite preview can inherit application settings that make a generic development flag false even while Vite is serving an undeployed development preview. This produced a blank synthetic advisor despite successful module discovery. The user explicitly prohibited environment changes.

**How to apply:** Determine private preview approval from the preview server's actual command, mode, preview-serving status and deployment status. Use the same decision for discovery, direct-source denial and the compiled entry guard. Do not relax the frozen application authority gate.

Isolated React UI tests must not require changing application environment settings.

**Why:** The inherited React runtime did not support test actions. Selecting a development React fixture runtime inside the isolated test transform preserved the no-environment-change requirement and the existing no-network/provider guards.

**How to apply:** Keep this test-only runtime selection confined to the isolated UI suite. Do not alter application dependencies, global environment variables or the offline I/O guards to make component tests pass.
