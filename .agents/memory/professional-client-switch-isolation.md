---
name: Professional client-switch isolation
description: Privacy invariant for professional dashboards during client route changes and delayed requests.
---

Professional dashboards must derive data access from a verified mapping for the currently selected relationship. During a route change, hide prior-client state before paint and reject asynchronous responses whose requested client identity is no longer current.

**Why:** React state and delayed requests can retain Client A while the route already selects Client B, causing cross-client disclosure or saving A-derived values under B.

**How to apply:** Every professional client-data request, summary, and child component must use the verified current identity; clear route-scoped state before paint and identity-check responses before mutating state.