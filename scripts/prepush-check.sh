#!/bin/bash
# MPM Pre-Push Drift Check
# Catches auth drift, raw fetch calls, and schema issues BEFORE they hit production.
# Usage: bash scripts/prepush-check.sh
# Add to CI / git pre-push hook as needed.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

pass()  { echo -e "${GREEN}  ✅ PASS${NC}  $1"; }
fail()  { echo -e "${RED}  ❌ FAIL${NC}  $1"; ((ERRORS++)); }
warn()  { echo -e "${YELLOW}  ⚠️  WARN${NC}  $1"; ((WARNINGS++)); }
info()  { echo -e "${CYAN}  ℹ️  INFO${NC}  $1"; }
header(){ echo ""; echo -e "${CYAN}━━━ $1 ━━━${NC}"; }

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   MPM Pre-Push Drift Check                   ║"
echo "╚══════════════════════════════════════════════╝"

# ──────────────────────────────────────────────────
header "1. TypeScript Compilation"
if npm run check --silent 2>/dev/null; then
  pass "TypeScript clean"
else
  fail "TypeScript errors — fix before pushing"
fi

# ──────────────────────────────────────────────────
header "2. Raw fetch() Usage in Client Code"
# Exclude: queryClient.ts (the one allowed to use fetch), refetch/prefetch calls, .d.ts
RAW_FETCH=$(grep -rn 'fetch(' client/src/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v 'queryClient\.ts' \
  | grep -v '^\s*//' \
  | grep -v 'refetch\b\|prefetch\b' \
  | grep -v '\.d\.ts' \
  || true)

RAW_COUNT=$(echo "$RAW_FETCH" | grep -c 'fetch(' 2>/dev/null || echo 0)

if [ "$RAW_COUNT" -eq 0 ]; then
  pass "No raw fetch() calls found"
else
  warn "$RAW_COUNT raw fetch() call(s) found — should use apiRequest() instead:"
  echo "$RAW_FETCH" | head -20 | sed 's/^/    /'
  if [ "$RAW_COUNT" -gt 20 ]; then
    echo "    ... and $((RAW_COUNT - 20)) more"
  fi
fi

# ──────────────────────────────────────────────────
header "3. Auth-Sensitive Routes Without apiRequest"
# Routes that require authentication — flag any raw fetch to these
AUTH_ROUTES=("/api/users" "/api/body-composition" "/api/macros" "/api/weekly-board" "/api/shopping")

AUTH_VIOLATIONS=0
for route in "${AUTH_ROUTES[@]}"; do
  FOUND=$(grep -rn "fetch(apiUrl(\`${route}\|fetch(\`${route}\|fetch(\"${route}" client/src/ \
    --include="*.ts" --include="*.tsx" \
    | grep -v 'queryClient\.ts' \
    | grep -v '^\s*//' \
    || true)
  if [ -n "$FOUND" ]; then
    fail "Raw fetch to auth-protected route '${route}':"
    echo "$FOUND" | sed 's/^/    /'
    ((AUTH_VIOLATIONS++))
  fi
done

if [ "$AUTH_VIOLATIONS" -eq 0 ]; then
  pass "No raw fetch calls to auth-protected routes"
fi

# ──────────────────────────────────────────────────
header "4. Builder Namespace Isolation"
# Each builder must use its BUILDER_NS constant — not a hardcoded string
HARDCODED_NS=$(grep -rn 'namespace.*=.*["'"'"']antiInflammatory\|namespace.*=.*["'"'"']diabetic\|namespace.*=.*["'"'"']glp1\|namespace.*=.*["'"'"']beachBody\|namespace.*=.*["'"'"']generalNutrition\|namespace.*=.*["'"'"']performanceCompetition' \
  client/src/ --include="*.tsx" --include="*.ts" \
  | grep -v 'builderNamespaces\|BUILDER_NS\|node_modules' \
  || true)

if [ -z "$HARDCODED_NS" ]; then
  pass "No hardcoded builder namespace strings found"
else
  warn "Hardcoded namespace strings (use BUILDER_NS constants instead):"
  echo "$HARDCODED_NS" | sed 's/^/    /'
fi

# ──────────────────────────────────────────────────
header "5. Shared Schema Drift"
# Ensure bodyCompositionSchema is imported in both server route and client sheet
SERVER_IMPORT=$(grep -l 'bodyCompositionSchema' server/routes/ 2>/dev/null | wc -l)
CLIENT_IMPORT=$(grep -rl 'bodyCompositionSchema' client/src/ 2>/dev/null | wc -l)

if [ "$SERVER_IMPORT" -gt 0 ]; then
  pass "Server imports from shared/bodyCompositionSchema"
else
  warn "Server route not importing from shared/bodyCompositionSchema — schema may drift"
fi

if [ "$CLIENT_IMPORT" -gt 0 ]; then
  pass "Client imports from shared/bodyCompositionSchema"
else
  warn "Client not importing from shared/bodyCompositionSchema — types may drift"
fi

# ──────────────────────────────────────────────────
header "6. Duplicate UI Component Names"
DUPES=$(find client/src/components -name "*.tsx" | xargs -I{} basename {} .tsx \
  | sort | uniq -d || true)

if [ -z "$DUPES" ]; then
  pass "No duplicate component filenames detected"
else
  warn "Duplicate component filenames (consolidate to one):"
  echo "$DUPES" | sed 's/^/    /'
fi

# ──────────────────────────────────────────────────
header "7. Core File Integrity"
CORE_FILES=(
  "client/src/lib/queryClient.ts"
  "client/src/hooks/useWeeklyBoard.ts"
  "shared/builderNamespaces.ts"
  "shared/bodyCompositionSchema.ts"
  "server/lib/accessTier.ts"
  "server/services/mealEngineService.ts"
)

for f in "${CORE_FILES[@]}"; do
  if [ -f "$f" ]; then
    pass "$f exists"
  else
    fail "$f MISSING — core file deleted or moved!"
  fi
done

# ──────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   DRIFT CHECK SUMMARY                        ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "  Errors:   ${RED}${ERRORS}${NC}"
echo -e "  Warnings: ${YELLOW}${WARNINGS}${NC}"
echo ""

if [ "$ERRORS" -gt 0 ]; then
  echo -e "${RED}  ❌ DRIFT CHECK FAILED — resolve errors before pushing${NC}"
  exit 1
elif [ "$WARNINGS" -gt 0 ]; then
  echo -e "${YELLOW}  ⚠️  Passed with warnings — review before pushing${NC}"
  exit 0
else
  echo -e "${GREEN}  ✅ All drift checks passed — safe to push${NC}"
  exit 0
fi
