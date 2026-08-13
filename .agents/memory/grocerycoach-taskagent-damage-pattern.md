---
name: GroceryCoach task-agent merge damage pattern
description: Task agents working on groceryCoach.ts repeatedly inject the same three categories of broken code on merge. Know what to look for and fix immediately.
---

## Pattern

Any task agent touching groceryCoach.ts or its neighbors tends to produce one or more of the following merge artifacts:

### 1. `finalizeMealCard({ recommendation, userId })` injection
`recommendation` is never defined in the `/recommend` or `/product-advisor` route scope. Task agents infer the import from `mealCardFinalizer` and incorrectly apply it.

**Fix:** In `/product-advisor`, use `engine.buildCartRecommendations(rawIngredients, paProtocolContext, rawStore ?? "")`. In `/recommend`, the parse block should be:
```typescript
let result: any;
try { result = JSON.parse(raw); } catch { ... }
```

### 2. Duplicate destructuring in `/product-advisor`
```typescript
const { ingredients: rawIngredients, store: rawStore } = req.body;
const { ingredients: rawIngredients, store: rawStore } = req.body; // duplicate
```
Delete the second line.

### 3. Dangling code fragments after `export default router;`
Partial route-handler code (usually the ingredient/store validation block from product-advisor) gets injected after the export statement. Delete everything after `export default router;`.

### 4. `protocolContext` declared as `const` then reassigned
The task agent injects `const protocolContext = ...` above the `if (userId)` block, then the block tries to `protocolContext = enforceBeforeGenerate(...)`. Fix: declare as `let protocolContext = ""` before the `if` block; assign inside it.

### 5. Missing `router.post("/recommend", async (req, res) => {` wrapper
The `detectMealType()` helper function gets inserted and the route wrapper opening lines get dropped, leaving the route body at depth 0. The brace depth tool catches this:
```
node -e "/* brace depth script — see prior sessions */"
```
Fix: re-insert `router.post("/recommend", async (req, res) => {\n  try {` after the `detectMealType` function closes.

## Detection

```bash
npx esbuild server/routes/groceryCoach.ts --platform=node --packages=external --bundle=false --format=esm 2>&1 | grep -E "^\s*✘|ERROR"
```

Zero output = clean. Run this before every server restart after a groceryCoach task merge.

**Why:** Multiple task agents (#891, #892, #895, #896, #900) all modified groceryCoach.ts concurrently in August 2026. Each agent's diff applied cleanly in isolation but left fragments when merged together. The `finalizeMealCard` import was the attractor — agents saw it imported and assumed it should be called in every route.
