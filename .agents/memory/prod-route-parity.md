---
name: Production route readiness and parity
description: Production routes must be present after initialization, while cold-start requests must not fall through as false 404s.
---

## The rule

Production calls the shared route registrar late in asynchronous startup, while also mounting selected routes explicitly beforehand. Routes that must work before the shared graph is ready need a matching explicit Production mount. All other API requests must wait for initialization or receive a retryable service response, never fall through as 404.

**Why:** Production starts listening before asynchronous route registration completes so health probes can observe startup. A user request in that window once received a misleading 404 even though the release contained the route.

**How to apply:** Keep early health, release, and signed-callback routes available during startup. Gate other API traffic until the full route graph is ready. For routes intentionally required earlier, add a Production mount with the exact same authorization chain as the shared mount.

## Known gaps caught so far

- `shoppingListV2` — `DELETE /api/shopping-list-v2/` returned 404 in production for an extended period. Fixed by adding explicit mount in prod.ts.
- `checkInSchedules` — previously had the same gap; fixed earlier (comment in prod.ts notes this explicitly).

## Symptom

Route works in dev preview, 404s in the published app. Browser shows items not deleting, API calls failing silently, or features missing only in production.
