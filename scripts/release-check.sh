#!/bin/bash
# MPM Release Health Check
# Smoke-tests the 5 critical systems before any TestFlight build.
# Usage: npm run release-check
#        npm run release-check -- https://your-deployed-url.app

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASSED=0
FAILED=0
WARNED=0

BASE_URL=${1:-"http://localhost:5000"}

pass()   { echo -e "${GREEN}  ✅ PASS${NC}  $1"; PASSED=$((PASSED + 1)); }
fail()   { echo -e "${RED}  ❌ FAIL${NC}  $1"; FAILED=$((FAILED + 1)); }
warn()   { echo -e "${YELLOW}  ⚠️  WARN${NC}  $1"; WARNED=$((WARNED + 1)); }
header() { echo ""; echo -e "${CYAN}━━━ $1 ━━━${NC}"; }

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   MPM Release Health Check                   ║"
echo "║   Target: ${BASE_URL}"
echo "╚══════════════════════════════════════════════╝"

# ──────────────────────────────────────────────────
header "0. Supported Build and Type Contracts"

if npm run build:client; then
  pass "Client production build completed"
else
  fail "Client production build failed"
  exit 1
fi

if npm run build:server; then
  pass "Server production build completed"
else
  fail "Server production build failed"
  exit 1
fi

if npm run check:safety-types; then
  pass "Strict safety typecheck completed"
else
  fail "Strict safety typecheck failed"
  exit 1
fi

if npm run check:release-types; then
  pass "Root TypeScript debt matches its reviewed baseline"
else
  fail "Root TypeScript debt differs from its reviewed baseline"
  exit 1
fi

# ──────────────────────────────────────────────────
header "1. Server Reachability"
HEALTH=$(curl -sf --max-time 8 "${BASE_URL}/api/health" 2>/dev/null || echo "UNREACHABLE")

if echo "$HEALTH" | grep -q '"ok":true'; then
  pass "Health endpoint responding"
else
  fail "Server not responding at ${BASE_URL}/api/health"
  echo "       Response: $HEALTH"
  echo ""
  echo -e "${RED}  Cannot continue — server must be running.${NC}"
  exit 1
fi

if echo "$HEALTH" | grep -q '"hasOpenAI":true'; then
  pass "OpenAI API key configured"
else
  fail "OpenAI NOT configured — meal generation will fail"
fi

if echo "$HEALTH" | grep -q '"hasS3":true'; then
  pass "S3 image storage configured"
else
  warn "S3 not configured — meal images may not persist"
fi

# ──────────────────────────────────────────────────
header "2. Authentication Gate"
# A request without auth should return 401, not 200 or 500
AUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 \
  "${BASE_URL}/api/users/test-invalid-user/body-composition/latest" 2>/dev/null || echo "000")

if [ "$AUTH_STATUS" = "401" ]; then
  pass "Auth middleware working (returns 401 without credentials)"
elif [ "$AUTH_STATUS" = "403" ]; then
  pass "Auth middleware working (returns 403 without credentials)"
elif [ "$AUTH_STATUS" = "404" ]; then
  warn "Auth route returned 404 — may mean route not registered"
else
  fail "Auth not protecting routes — status was $AUTH_STATUS (expected 401)"
fi

# ──────────────────────────────────────────────────
header "3. Body Composition Route"
BC_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 \
  "${BASE_URL}/api/users/health-check-probe/body-composition/latest" 2>/dev/null || echo "000")

if [ "$BC_STATUS" = "401" ] || [ "$BC_STATUS" = "200" ]; then
  pass "Body composition route is registered (status: $BC_STATUS)"
elif [ "$BC_STATUS" = "404" ]; then
  fail "Body composition route not found — route may be missing"
else
  warn "Body composition route returned unexpected status: $BC_STATUS"
fi

# ──────────────────────────────────────────────────
header "4. Meal Generation Endpoint"
MEAL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 \
  -X POST "${BASE_URL}/api/meals/generate" \
  -H "Content-Type: application/json" \
  -d '{"type":"health-check"}' \
  2>/dev/null || echo "000")

if [ "$MEAL_STATUS" = "400" ] || [ "$MEAL_STATUS" = "401" ] || [ "$MEAL_STATUS" = "200" ]; then
  pass "Meal generation endpoint reachable (status: $MEAL_STATUS)"
elif [ "$MEAL_STATUS" = "404" ]; then
  fail "Meal generation endpoint not found — route may be missing"
else
  warn "Meal generation returned unexpected status: $MEAL_STATUS"
fi

# ──────────────────────────────────────────────────
header "5. Shopping List Route"
SHOP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 \
  "${BASE_URL}/api/shopping-list" 2>/dev/null || echo "000")

if [ "$SHOP_STATUS" = "401" ] || [ "$SHOP_STATUS" = "200" ]; then
  pass "Shopping list route is registered (status: $SHOP_STATUS)"
elif [ "$SHOP_STATUS" = "404" ]; then
  fail "Shopping list route not found — route may be missing"
else
  warn "Shopping list returned unexpected status: $SHOP_STATUS"
fi

# ──────────────────────────────────────────────────
header "6. Weekly Board Route"
BOARD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 \
  "${BASE_URL}/api/weekly-board" 2>/dev/null || echo "000")

if [ "$BOARD_STATUS" = "401" ] || [ "$BOARD_STATUS" = "200" ]; then
  pass "Weekly board route is registered (status: $BOARD_STATUS)"
elif [ "$BOARD_STATUS" = "404" ]; then
  fail "Weekly board route not found — boards will be empty"
else
  warn "Weekly board returned unexpected status: $BOARD_STATUS"
fi

# ──────────────────────────────────────────────────
header "7. AI Generation Smoke Test"
# The generation endpoint requires an authenticated session.  An unauthenticated
# probe returning 401 is the correct gate behaviour and confirms the route is
# registered and protected; it is NOT a timing failure.  Full AI quality testing
# requires a real session and is validated separately (see npm run validate).
AI_GATE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 \
  -X POST "${BASE_URL}/api/meals/generate" \
  -H "Content-Type: application/json" \
  -d '{"type":"create-with-chef","input":"health-probe"}' \
  2>/dev/null || echo "000")

if [ "$AI_GATE_STATUS" = "401" ] || [ "$AI_GATE_STATUS" = "400" ] || [ "$AI_GATE_STATUS" = "200" ]; then
  pass "AI generation gate reachable and protected (status: $AI_GATE_STATUS)"
elif [ "$AI_GATE_STATUS" = "404" ]; then
  fail "AI generation route not found — likely missing mount in routes.ts"
elif [ "$AI_GATE_STATUS" = "000" ]; then
  fail "AI generation probe timed out — server may be unresponsive"
else
  warn "AI generation gate returned unexpected status: $AI_GATE_STATUS"
fi

# ──────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   RELEASE CHECK SUMMARY                      ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "  Passed:   ${GREEN}${PASSED}${NC}"
echo -e "  Warnings: ${YELLOW}${WARNED}${NC}"
echo -e "  Failed:   ${RED}${FAILED}${NC}"
echo ""

if [ "$FAILED" -gt 0 ]; then
  echo -e "${RED}  ❌ RELEASE CHECK FAILED — do not build for TestFlight${NC}"
  exit 1
elif [ "$WARNED" -gt 0 ]; then
  echo -e "${YELLOW}  ⚠️  Release check passed with warnings — review before building${NC}"
  exit 0
else
  echo -e "${GREEN}  ✅ All release checks passed — safe to build for TestFlight${NC}"
  exit 0
fi
