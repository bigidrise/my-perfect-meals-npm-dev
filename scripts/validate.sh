#!/bin/bash
# MPM Pre-Push Validation
# Runs in the DEV space before every GitHub push.
# Verifies that core server files are intact and the server boots without errors.
# Does NOT run client TypeScript — client TS errors are pre-existing and non-blocking.
#
# Usage: npm run validate
#
# What it checks:
#   1. Core server and shared files are present (no critical file deleted or moved)
#   2. No unguarded raw-fetch calls to auth-protected server routes in client code
#   3. Server starts without crashing and /api/health responds
#   4. No error patterns (uncaughtException, UnhandledPromiseRejection, etc.) in startup log
#
# Exit codes:
#   0 = PASS — safe to push
#   1 = FAIL — fix issues before pushing

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ERRORS=0
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

pass()   { echo -e "${GREEN}  ✅ PASS${NC}  $1"; }
fail()   { echo -e "${RED}  ❌ FAIL${NC}  $1"; ERRORS=$((ERRORS + 1)); }
warn()   { echo -e "${YELLOW}  ⚠️  WARN${NC}  $1"; }
header() { echo ""; echo -e "${CYAN}━━━ $1 ━━━${NC}"; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   MPM Pre-Push Validation                    ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Run before every ${CYAN}git push${NC} to GitHub. Takes ~15 seconds."
echo -e "  Checks server startup health and critical file integrity."
echo ""

# ──────────────────────────────────────────────────
header "Step 1 of 3: Core File Integrity"
# If any of these files go missing, the server will not start correctly.

CORE_FILES=(
  "server/index.ts"
  "server/routes.ts"
  "server/middleware/requireAuth.ts"
  "server/middleware/requireActiveAccess.ts"
  "server/lib/accessTier.ts"
  "server/services/mealEngineService.ts"
  "shared/schema.ts"
  "shared/planFeatures.ts"
  "client/src/lib/queryClient.ts"
  "client/src/hooks/useWeeklyBoard.ts"
)

ALL_FILES_OK=true
for f in "${CORE_FILES[@]}"; do
  if [ ! -f "$f" ]; then
    fail "Core file MISSING: $f"
    ALL_FILES_OK=false
  fi
done

if [ "$ALL_FILES_OK" = true ]; then
  pass "All core server and shared files present"
fi

# ──────────────────────────────────────────────────
header "Step 2 of 3: Auth-Protected Route Safety"
# Flag any raw fetch() calls to auth-protected routes not going through apiRequest().
# Excludes: queryClient.ts (intentional), refetch/prefetch, and comments.

AUTH_ROUTES=("/api/users" "/api/body-composition" "/api/macros" "/api/weekly-board" "/api/shopping" "/api/biometrics" "/api/studio")
AUTH_VIOLATIONS=0

for route in "${AUTH_ROUTES[@]}"; do
  FOUND=$(grep -rn \
    "fetch(apiUrl(\`${route}\|fetch(\`${route}\|fetch(\"${route}" \
    client/src/ \
    --include="*.ts" --include="*.tsx" \
    | grep -v 'queryClient\.ts' \
    | grep -v '^\s*//' \
    || true)
  if [ -n "$FOUND" ]; then
    fail "Raw fetch() to auth-protected route '${route}' — use apiRequest() instead:"
    echo "$FOUND" | head -5 | sed 's/^/    /'
    AUTH_VIOLATIONS=$((AUTH_VIOLATIONS + 1))
  fi
done

if [ "$AUTH_VIOLATIONS" -eq 0 ]; then
  pass "No raw fetch() calls to auth-protected routes"
fi

# ──────────────────────────────────────────────────
header "Step 3 of 3: Server Startup Verification"
echo "  Starting server in background to verify clean boot..."
echo "  (If port 5000 is in use, stop the dev workflow first)"
echo ""

# Fail immediately if port 5000 is already bound — avoids false results
if lsof -ti:5000 >/dev/null 2>&1; then
  fail "Port 5000 is already in use — stop the running dev server first, then re-run validate"
  echo ""
  echo -e "${YELLOW}  Tip: In the Replit workflow panel, stop the 'Start application' workflow,${NC}"
  echo -e "${YELLOW}  run 'npm run validate', then restart the workflow.${NC}"
  echo ""
else
  # Start server, redirect output to temp log
  TMPLOG=$(mktemp /tmp/mpm-validate-XXXXXX.log)
  NODE_ENV=development tsx server/index.ts >"$TMPLOG" 2>&1 &
  SERVER_PID=$!

  # Poll /api/health for up to 20 seconds
  MAX_WAIT=20
  ELAPSED=0
  STARTED=false

  while [ $ELAPSED -lt $MAX_WAIT ]; do
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
      # Process died — boot failed
      fail "Server process crashed during startup"
      echo ""
      echo -e "${RED}  Server output (last 25 lines):${NC}"
      tail -25 "$TMPLOG" | sed 's/^/    /'
      echo ""
      rm -f "$TMPLOG"
      SERVER_PID=""
      break
    fi

    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 \
      http://localhost:5000/api/health 2>/dev/null || echo "000")

    if [ "$HTTP_STATUS" = "200" ]; then
      STARTED=true
      break
    fi

    sleep 1
    ELAPSED=$((ELAPSED + 1))
  done

  if [ "$STARTED" = true ]; then
    # Hard check: fail on any startup error patterns in the server log
    if grep -qiE "uncaughtException|UnhandledPromiseRejection|FATAL|Cannot find module|MODULE_NOT_FOUND|SyntaxError:" "$TMPLOG" 2>/dev/null; then
      fail "Server started but startup log contains critical error patterns:"
      grep -iE "uncaughtException|UnhandledPromiseRejection|FATAL|Cannot find module|MODULE_NOT_FOUND|SyntaxError:" \
        "$TMPLOG" | head -8 | sed 's/^/    /'
    else
      pass "Server started cleanly — /api/health responded with 200"
      pass "No critical error patterns in startup log"
    fi
  elif [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    fail "Server did not respond to /api/health within ${MAX_WAIT}s — startup may have hung"
    echo ""
    echo -e "${YELLOW}  Server output (last 20 lines):${NC}"
    tail -20 "$TMPLOG" | sed 's/^/    /'
  fi

  rm -f "$TMPLOG"

  # Kill the background server
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    SERVER_PID=""
  fi
fi

# ──────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   VALIDATION SUMMARY                         ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""

if [ "$ERRORS" -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}✅ VALIDATION PASSED — safe to push to GitHub${NC}"
  echo ""
  echo -e "  Full push sequence:"
  echo -e "    1. git push origin dev"
  echo -e "    2. Merge dev → main on GitHub"
  echo -e "    3. git pull in production shell"
  echo -e "    4. Check /api/health in browser"
  echo -e "    5. Update LAST_STABLE.md with new commit hash"
  echo ""
  exit 0
else
  echo -e "  ${RED}${BOLD}❌ VALIDATION FAILED — fix ${ERRORS} issue(s) before pushing${NC}"
  echo ""
  exit 1
fi
