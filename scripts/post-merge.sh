#!/bin/bash
set -e

echo "[post-merge] Installing dependencies..."
npm install --include=dev --prefer-offline --no-audit --no-fund

# ── Integrity guard: catch recurring task-agent merge damage early ──────────
# groceryCoach.ts is frequently hit by agents injecting finalizeMealCard calls
# and toN/nut references outside their valid scope. Check it with esbuild before
# the full 20s build so failures are caught fast with a clear file:line message.
echo "[post-merge] Checking groceryCoach.ts for merge damage..."
GCROACH_ERRORS=$(npx esbuild server/routes/groceryCoach.ts \
  --platform=node --packages=external --bundle=false --format=esm 2>&1 \
  | grep -E "^\s*✘" || true)
if [ -n "$GCROACH_ERRORS" ]; then
  echo "❌ [post-merge] groceryCoach.ts has build errors — likely task-agent merge damage:"
  echo "$GCROACH_ERRORS"
  exit 1
fi
# Also catch the specific const-reassignment pattern (finalizeMealCard injection)
# that esbuild does not report but tsc does.
CONST_REASSIGN=$(npx tsc --noEmit --project tsconfig.server.json 2>&1 \
  | grep "groceryCoach" | grep "error TS" || true)
if [ -n "$CONST_REASSIGN" ]; then
  echo "❌ [post-merge] groceryCoach.ts has TypeScript errors — likely task-agent merge damage:"
  echo "$CONST_REASSIGN"
  exit 1
fi
echo "[post-merge] groceryCoach.ts integrity check passed."

echo "[post-merge] Building client and server..."
npm run build

echo "[post-merge] Done."
