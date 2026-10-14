---
name: Neon preflight default privileges
description: Avoid treating unrelated administrative default ACLs as a migration conflict.
---

Default-privilege preflight checks must examine the actual object-creating role,
both database-wide and target-schema defaults, and the object types being created.
Do not require the entire pg_default_acl catalog to be empty.

**Why:** A global absence check stopped an authorized migration because the
external Neon database had cloud_admin defaults granting neon_superuser access
to tables and sequences. Neither default applied to the connected creator.
There were no event triggers, creator-applicable defaults, or PUBLIC defaults.

**How to apply:** Recheck current metadata rather than assuming those observations
remain true. PostgreSQL creation defaults belong to the current creating role,
not inherited membership defaults. Verify that the reviewed SQL does not switch
roles. Inspect applicable grants and event triggers independently; do not remove
administrative defaults or change permissions merely to make preflight pass.
