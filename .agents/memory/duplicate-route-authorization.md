---
name: Duplicate-route authorization
description: Production route ordering rule for authorization reviews and repairs.
---

Every production-effective registration for a sensitive method/path must enforce
authorization itself. Never treat a later guarded router as protection for an
earlier matching handler, and never place an unscoped auth guard on a router
mounted at a broad prefix such as `/api`.

**Why:** Express dispatch order made earlier legacy handlers bypass later secured
routers. Conversely, a router-wide guard mounted broadly intercepted unrelated
authentication endpoints during validation.

**How to apply:** Inventory duplicate registrations in actual production mount
order. Test every matching registration for actor binding, and scope guards to
the router's own path family or individual handlers.