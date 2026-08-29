---
name: Frontend static asset location
description: Canonical location and verification rule for browser-served frontend images.
---

Browser-facing static images must live under `client/public`, which is the Vite frontend root and the canonical static-delivery directory for this project. Do not treat the repository root `public` directory as interchangeable.

**Why:** The development server can make an incorrectly placed asset appear reachable while the actual frontend build or authenticated page still renders without it. That can lead to unnecessary CSS layering and background debugging.

**How to apply:** Before changing a page’s image layout, compare the asset location with a working page, place the asset under `client/public`, restart the app, and verify the exact browser URL returns the intended file.