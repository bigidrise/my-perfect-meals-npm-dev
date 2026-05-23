#!/bin/bash
# MPM Pre-Push Validation
# Runs in the DEV space before every GitHub push.
# Checks TypeScript errors in server/shared files, verifies critical files are intact,
# catches raw-fetch auth violations, and confirms the server boots without crashing.
#
# Usage: npm run validate
#
# What it checks:
#   1. Server + shared TypeScript type errors (server-only tsconfig, warns on pre-existing TS debt)
#   2. Core server and shared files are present (no critical file deleted or moved)
#   3. No raw fetch() calls to auth-protected routes in client code
#   4. Server starts without crashing and /api/health responds within 20s
#   5. No crash patterns (uncaughtException, UnhandledPromiseRejection, etc.) in startup log
#
# Exit codes:
#   0 = PASS (or PASS WITH WARNINGS) — safe to push
#   1 = FAIL — fix issues before pushing

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ERRORS=0
WARNINGS=0
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
warn()   { echo -e "${YELLOW}  ⚠️  WARN${NC}  $1"; WARNINGS=$((WARNINGS + 1)); }
header() { echo ""; echo -e "${CYAN}━━━ $1 ━━━${NC}"; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   MPM Pre-Push Validation                    ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Run before every ${CYAN}git push${NC} to GitHub. Takes ~15–20 seconds."
echo ""

# ──────────────────────────────────────────────────
header "Step 1 of 4: Server TypeScript Check"
echo "  Checking server/ and shared/ TypeScript using tsconfig.server.json ..."
echo "  (Client TS errors are pre-existing and excluded from this check)"
echo ""

TSLOG=$(mktemp /tmp/mpm-ts-XXXXXX.log)

if npx tsc --noEmit -p tsconfig.server.json >"$TSLOG" 2>&1; then
  pass "Server TypeScript: no type errors"
else
  TS_COUNT=$(grep -c ': error TS' "$TSLOG" 2>/dev/null || echo 0)
  fail "Server TypeScript: ${TS_COUNT} type error(s) found — fix before pushing"
  echo ""
  echo -e "${RED}  TypeScript output (first 40 lines):${NC}"
  head -80 "$TSLOG" | sed 's/^/    /'
fi
rm -f "$TSLOG"

# ──────────────────────────────────────────────────
header "Step 2 of 4: Core File Integrity"
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
header "Step 3 of 4: Auth-Protected Route Safety"
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
header "Step 4 of 4: Server Startup Verification"
echo "  Starting server in background to verify clean boot..."
echo ""

# Detect port 5000 occupancy before starting the test server.
# - If it's our own MPM dev server (tsx server/index.ts): stop it temporarily,
#   run the boot test, then restart it automatically.
# - If it's something else: skip Step 4 with a warning (not a hard fail).
PORT_PID=$(lsof -ti:5000 2>/dev/null | head -1 || true)
DEV_SERVER_RESTARTED=false

if [ -n "$PORT_PID" ]; then
  PORT_CMD=$(ps -p "$PORT_PID" -o args= 2>/dev/null || true)
  if echo "$PORT_CMD" | grep -q "server/index.ts"; then
    echo -e "${YELLOW}  MPM dev server detected on port 5000 (PID $PORT_PID) — pausing it for test...${NC}"
    # Check for active (ESTABLISHED) connections before killing.
    # This warns the developer that in-flight requests may be interrupted,
    # which is why the shutdown could be slow or produce connection errors.
    ACTIVE_CONNS=$(ss -tn state established '( dport = :5000 or sport = :5000 )' 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')
    if [ "${ACTIVE_CONNS:-0}" -gt 0 ] 2>/dev/null; then
      echo -e "${YELLOW}  ⚠️  Warning: ${ACTIVE_CONNS} active connection(s) detected on port 5000.${NC}"
      echo -e "${YELLOW}     The server is currently handling requests. Shutdown may be slow${NC}"
      echo -e "${YELLOW}     and any in-flight requests will be interrupted.${NC}"
    fi
    kill "$PORT_PID" 2>/dev/null || true
    # Poll up to 10s for the port to free after SIGTERM
    PORT_FREED=false
    for _i in 1 2 3 4 5 6 7 8 9 10; do
      sleep 1
      if ! lsof -ti:5000 >/dev/null 2>&1; then
        PORT_FREED=true
        break
      fi
    done
    # If port is still bound, escalate to SIGKILL
    if [ "$PORT_FREED" = false ]; then
      REMAINING_PID=$(lsof -ti:5000 2>/dev/null | head -1 || true)
      if [ -n "$REMAINING_PID" ]; then
        echo -e "${YELLOW}  Port 5000 still occupied after 10s — sending SIGKILL to PID $REMAINING_PID...${NC}"
        kill -9 "$REMAINING_PID" 2>/dev/null || true
        sleep 1
        if lsof -ti:5000 >/dev/null 2>&1; then
          warn "Port 5000 could not be freed even after SIGKILL — skipping boot test"
          PORT_FREED=false
        else
          echo -e "${YELLOW}  Process forcefully killed. Port 5000 is now free.${NC}"
          PORT_FREED=true
        fi
      fi
    fi
    if [ "$PORT_FREED" = true ]; then
      DEV_SERVER_RESTARTED=true
    fi
  else
    warn "Port 5000 is occupied by a non-MPM process (PID $PORT_PID: ${PORT_CMD:0:80}) — skipping boot test"
    echo -e "${YELLOW}  Stop that process and re-run validate to include the boot test.${NC}"
    echo ""
  fi
fi

if [ -z "$PORT_PID" ] || [ "$DEV_SERVER_RESTARTED" = true ]; then
  TMPLOG=$(mktemp /tmp/mpm-validate-XXXXXX.log)
  NODE_ENV=development tsx server/index.ts >"$TMPLOG" 2>&1 &
  SERVER_PID=$!

  # Poll /api/health for up to 20 seconds
  MAX_WAIT=20
  ELAPSED=0
  STARTED=false

  while [ $ELAPSED -lt $MAX_WAIT ]; do
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
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
    # Hard fail on critical crash patterns — these indicate a broken startup
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

  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    SERVER_PID=""
  fi

  # If we paused the MPM dev server to free the port, restart it now.
  if [ "$DEV_SERVER_RESTARTED" = true ]; then
    echo ""
    echo -e "${CYAN}  Restarting MPM dev server...${NC}"
    NODE_ENV=development tsx server/index.ts >/dev/null 2>&1 &
    disown
    echo -e "${GREEN}  MPM dev server restarted in background.${NC}"
  fi
fi

# ──────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   VALIDATION SUMMARY                         ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Hard failures: ${RED}${ERRORS}${NC}"
echo -e "  Warnings:      ${YELLOW}${WARNINGS}${NC}"
echo ""

if [ "$ERRORS" -eq 0 ]; then
  if [ "$WARNINGS" -gt 0 ]; then
    echo -e "  ${YELLOW}${BOLD}⚠️  VALIDATION PASSED WITH WARNINGS — review warnings before pushing${NC}"
  else
    echo -e "  ${GREEN}${BOLD}✅ VALIDATION PASSED — safe to push to GitHub${NC}"
  fi
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
