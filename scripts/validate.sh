#!/bin/bash
# MPM Pre-Push Validation
# Runs in the DEV space before every GitHub push.
# Combines code drift checks + server startup verification.
#
# Usage: npm run validate
#
# What it checks:
#   1. TypeScript + schema drift (via drift-check)
#   2. Server starts without crashing (spawns server, polls health, kills it)
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
fail()   { echo -e "${RED}  ❌ FAIL${NC}  $1"; ((ERRORS++)) || true; }
warn()   { echo -e "${YELLOW}  ⚠️  WARN${NC}  $1"; }
header() { echo ""; echo -e "${CYAN}━━━ $1 ━━━${NC}"; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   MPM Pre-Push Validation                    ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Run this before every ${CYAN}git push${NC} to GitHub."
echo -e "  Takes ~15 seconds. Catches problems before they reach production."
echo ""

# ──────────────────────────────────────────────────
header "Step 1 of 2: Code Integrity Check"
echo "  Running drift check (TypeScript, schema, auth guards)..."
echo ""

if bash scripts/prepush-check.sh; then
  pass "Code integrity checks passed"
else
  DRIFT_EXIT=$?
  if [ "$DRIFT_EXIT" -ne 0 ]; then
    fail "Drift check found errors — fix before pushing"
    ((ERRORS++)) || true
  fi
fi

# ──────────────────────────────────────────────────
header "Step 2 of 2: Server Startup Verification"
echo "  Starting server in background to verify clean boot..."

# Start server, redirect output to temp log
TMPLOG=$(mktemp /tmp/mpm-validate-XXXXXX.log)
NODE_ENV=development tsx server/index.ts > "$TMPLOG" 2>&1 &
SERVER_PID=$!

# Poll /api/health for up to 20 seconds
MAX_WAIT=20
INTERVAL=1
ELAPSED=0
STARTED=false

while [ $ELAPSED -lt $MAX_WAIT ]; do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    # Process died — boot failed
    fail "Server process exited unexpectedly during startup"
    echo ""
    echo -e "${RED}  Server output (last 20 lines):${NC}"
    tail -20 "$TMPLOG" | sed 's/^/    /'
    rm -f "$TMPLOG"
    break
  fi

  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 \
    http://localhost:5000/api/health 2>/dev/null || echo "000")

  if [ "$HTTP_STATUS" = "200" ]; then
    STARTED=true
    break
  fi

  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
done

if [ "$STARTED" = true ]; then
  pass "Server started cleanly and health endpoint responded"

  # Check for common crash patterns in startup output
  if grep -qiE "uncaughtException|UnhandledPromiseRejection|FATAL|Cannot find module|MODULE_NOT_FOUND" "$TMPLOG" 2>/dev/null; then
    warn "Server started but startup log contains error patterns — review before pushing:"
    grep -iE "uncaughtException|UnhandledPromiseRejection|FATAL|Cannot find module|MODULE_NOT_FOUND" "$TMPLOG" | head -5 | sed 's/^/    /'
  fi
elif [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
  fail "Server did not respond within ${MAX_WAIT}s — startup may have hung or port 5000 is blocked"
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

# ──────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   VALIDATION SUMMARY                         ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""

if [ "$ERRORS" -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}✅ VALIDATION PASSED — safe to push to GitHub${NC}"
  echo ""
  echo -e "  Next steps:"
  echo -e "    git push origin dev"
  echo -e "    → merge dev → main on GitHub"
  echo -e "    → git pull in production shell"
  echo -e "    → update LAST_STABLE.md with the new commit hash"
  echo ""
  exit 0
else
  echo -e "  ${RED}${BOLD}❌ VALIDATION FAILED — fix ${ERRORS} issue(s) before pushing${NC}"
  echo ""
  exit 1
fi
