---
name: requireAuth userId access pattern
description: How to correctly read the authenticated user's ID from req inside route handlers after requireAuth runs.
---

# requireAuth — correct way to read userId in route handlers

## The Rule
`requireAuth` sets `req.authUser` (type `AuthenticatedUser`), NOT `req.userId`.

**Correct:**
```typescript
const userId = (req as any).authUser?.id as string | undefined;
if (!userId) return res.status(401).json({ error: "Unauthorized" });
```

**Wrong (always undefined → always 401):**
```typescript
const userId = (req as any).userId; // ← never set by requireAuth, always undefined
```

## Why
`requireAuth` in `server/middleware/requireAuth.ts` sets:
- `(req as AuthenticatedRequest).authUser` — full `AuthenticatedUser` object with `.id`, `.email`, `.plan`, etc.
- `(req as any).orgContext` — org context

It does NOT set `req.userId`. Any route reading `req.userId` will always get `undefined` and return 401 even for authenticated users.

## How to Apply
Every new route handler that needs the user's ID must read from `req.authUser?.id`.
The pattern at the top of every protected route handler should be:
```typescript
const userId = (req as any).authUser?.id as string | undefined;
if (!userId) return res.status(401).json({ error: "Unauthorized" });
```

## Related
- Also hit on `server/routes/therapeuticSetup.ts` (both GET and POST handlers)
- Also hit on `server/routes/nutritionSummary.ts`
- The column name bug `dailyCarbTarget` vs `dailyCarbsTarget` (schema uses `dailyCarbsTarget`) was found at the same time
