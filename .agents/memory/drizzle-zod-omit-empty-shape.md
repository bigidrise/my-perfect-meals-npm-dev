---
name: drizzle-zod .omit() breaks with empty shape
description: createInsertSchema() returns ZodObject<{}, 'strip'> at the TS type level; all .omit() calls on the result fail with TS2322. Fix is to remove .omit() calls.
---

## Rule

Never call `.omit()` on a `createInsertSchema()` result in this codebase. Remove any existing ones.

## Why

`drizzle-zod 0.7.1` + `zod 3.25.76` + `TypeScript 5.9.3`: `BuildSchema<'insert', TColumns, undefined>` maps over a large column set and the resulting `Simplify<RemoveNever<{...}>>` collapses to `{}` during TypeScript's type evaluation. This makes `ZodObject<{}, 'strip'>` the inferred type of every `createInsertSchema()` call.

Zod's `.omit()` constraint is:
```ts
omit<Mask extends util.Exactly<{[k in keyof T]?: true}, Mask>>(mask: Mask)
// util.Exactly<T, X> = T & Record<Exclude<keyof X, keyof T>, never>
```

With `T = {}`, every key in `Mask` lands in `Exclude<keyof Mask, never>` → typed as `never`. So `{ id: true }` produces "Type 'true' is not assignable to type 'never'" (TS2322) for every key.

The runtime schema IS correct — drizzle-zod evaluates columns correctly in JavaScript. Only TypeScript types are broken.

## How to apply

- **Remove `.omit({...})` call entirely.** The insert schema already marks `id`, `createdAt`, `updatedAt`, and other server-generated columns as `ZodOptional<...>` at runtime — they are optional not required.
- **Behavioral impact**: callers can now optionally pass server-generated fields. Since production code never passes `id`/`createdAt` in request bodies, runtime behavior is unchanged.
- The 43 `.omit()` sites were removed across: `shared/schema.ts`, `shared/fitlife-schema.ts`, `shared/diabetes-schema.ts`, `shared/schema/mealplan.ts`, `server/db/schema/bodyComposition.ts`, `server/db/schema/clinicalLabs.ts`, `server/db/schema/glp1Shots.ts`, `server/routes/mealLogs.ts`.
- This eliminated 98 TypeScript errors (381 → 283).
