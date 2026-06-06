---
name: LMS Boot Migrations — Dev vs Prod
description: Dev server (server/index.ts) and prod server (server/prod.ts) are separate; boot migrations must be added to both or tables only exist in one env.
---

## Rule
Any new DB table or column created via boot migration must be added as a `setTimeout(async () => { ... }, N)` block in **both** `server/index.ts` (development) and `server/prod.ts` (production). Adding to only prod.ts means tables never exist in dev (the Replit workflow runs `tsx server/index.ts`, not prod.ts).

**Why:** The project uses boot-time migrations (CREATE TABLE IF NOT EXISTS / ALTER TABLE IF NOT EXISTS) instead of drizzle-kit push (drizzle-kit not installed and times out on this project). Each entry point runs its own independent startup sequence.

**How to apply:** After adding a migration block to prod.ts, always add the same block to index.ts (or a shared utility both import). Use a 2500ms setTimeout in index.ts (after DB is stable but before 3000ms reminders).

## Pattern used for LMS tables (June 2026)
```typescript
setTimeout(async () => {
  try {
    const { db } = await import('./db');
    const { sql } = await import('drizzle-orm');
    await db.execute(sql`ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS ...`);
    console.log('✅ LMS boot migrations complete');
  } catch (err: any) {
    console.error('❌ LMS boot migrations failed:', err.message);
  }
}, 2500);
```
