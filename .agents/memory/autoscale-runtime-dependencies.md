---
name: Autoscale runtime dependencies
description: Replit publish-bundle constraint for production runtime packages in this application.
---

Do not exclude `node_modules` from this application's `.replitignore`.

**Why:** Replit's Autoscale build environment may still compile successfully from installed or cached packages, while the final runtime image lacks externalized server dependencies. This creates a misleading build-success/startup-failure sequence.

**How to apply:** When reducing publish-bundle size, exclude development caches, source media, native projects, and test output, but retain runtime dependencies. Verify both the exact production preload command and a health-checking production start.