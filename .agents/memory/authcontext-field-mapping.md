---
name: AuthContext refreshUser field mapping
description: refreshUser() in AuthContext.tsx builds User object explicitly — new profile fields must be added in two places or they are silently dropped.
---

## The Rule

Any field returned by `GET /api/user/profile` that you want visible in the `user` object throughout the app must be added in **two places**:

1. `client/src/lib/auth.ts` — the `User` interface (TypeScript type)
2. `client/src/contexts/AuthContext.tsx` — the `updatedUser` object built inside `refreshUser()`

**Why:** `refreshUser()` does not spread `userData` into `updatedUser`. It explicitly maps each field by name. Fields not listed in the mapping are silently discarded even if the server returns them. This applies to every new DB column added to the users table and exposed by the profile endpoint.

**How to apply:** After adding a column to the DB schema and returning it from `/api/user/profile` in `server/routes.ts`, always grep for `updatedUser` in `AuthContext.tsx` and add the new field there, and add it to the `User` interface in `auth.ts`. The pattern is:

```typescript
// auth.ts — User interface
myNewField?: string | null;

// AuthContext.tsx — updatedUser inside refreshUser()
myNewField: userData.myNewField ?? null,
```

**Discovered via:** Pregnancy fields (`pregnancyStage`, `pregnancyDueDate`, `pregnancySupportContext`) were in the DB, returned by the profile endpoint, but never showed in the app because `refreshUser()` didn't map them. The hub always showed "Set Up My Perfect Pregnancy" even after successful saves.
