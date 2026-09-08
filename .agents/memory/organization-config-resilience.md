---
name: Organization config resilience
description: Why client Organization context must tolerate partial authenticated tenant configuration.
---

Treat Organization configuration returned for an authenticated tenant as potentially partial or stale. Normalize it over the complete public defaults, including a field-by-field feature-flag merge, before exposing it to render-time consumers.

**Why:** The public Organization config can be complete while an authenticated Organization path supplies older or incomplete tenant data. Direct feature-flag dereferencing then crashes tenant-only pages during render.

**How to apply:** Any new Organization config consumer should use the normalized context rather than raw API data. New flags need a safe default, and render-time checks must tolerate absent nested configuration.