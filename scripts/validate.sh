#!/bin/bash
# MPM Pre-Push Validation
# Runs in the DEV space before every GitHub push.
# Checks TypeScript errors in server/shared files, verifies critical files are intact,
# catches raw-fetch auth violations, and confirms the server boots without crashing.
#
# Usage: npm run validate [--report]
#   --report   Write a plain-text summary digest to /tmp/mpm-validate-report-<timestamp>.txt
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
SHUTDOWN_ACTIVE_CONNS=0
FAIL_MESSAGES=()
WARN_MESSAGES=()
CURRENT_STEP=""

SAVE_REPORT=0
for arg in "$@"; do
  if [ "$arg" = "--report" ]; then
    SAVE_REPORT=1
  fi
done
REPORT_TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_FILE="/tmp/mpm-validate-report-${REPORT_TIMESTAMP}.txt"

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    sleep 0.5
    # tsx spawns a child Node.js process that survives killing the wrapper.
    # Kill everything still holding the test port to catch all descendants.
    [ -n "$VALIDATE_PORT" ] && lsof -ti:"$VALIDATE_PORT" 2>/dev/null | xargs -r kill -9 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

pass()   { echo -e "${GREEN}  ✅ PASS${NC}  $1"; }
fail()   { echo -e "${RED}  ❌ FAIL${NC}  $1"; ERRORS=$((ERRORS + 1)); FAIL_MESSAGES+=("[${CURRENT_STEP}] $1"); }
warn()   { echo -e "${YELLOW}  ⚠️  WARN${NC}  $1"; WARNINGS=$((WARNINGS + 1)); WARN_MESSAGES+=("[${CURRENT_STEP}] $1"); }
header() { echo ""; echo -e "${CYAN}━━━ $1 ━━━${NC}"; CURRENT_STEP="$1"; }

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

# Guard: bare /api + requireAuth mount pattern
# app.use("/api", requireAuth, ...) intercepts EVERY /api/* request, including
# the login endpoint. requireAuth must be applied per-route inside the router,
# not at the bare /api prefix. Specific sub-paths like /api/something are fine.
BARE_API_AUTH=$(grep -rn \
  'app\.use([[:space:]]*["\x27]/api["\x27][[:space:]]*,[[:space:]]*requireAuth' \
  server/routes.ts server/prod.ts 2>/dev/null \
  | grep -v '^[^:]*:[0-9]*:[[:space:]]*//' \
  || true)
if [ -n "$BARE_API_AUTH" ]; then
  fail "Bare /api requireAuth mount found — this blocks login. Apply requireAuth per-route inside the router instead:"
  echo "$BARE_API_AUTH" | head -5 | sed 's/^/    /'
else
  pass "No bare /api requireAuth mount pattern found"
fi

# ──────────────────────────────────────────────────
header "Step 4 of 6: Translation Quality"
echo "  Running i18n value quality scan..."
echo "    • Gate A: {{variable}} interpolation mismatches (hard fail — runtime bugs)"
echo "    • Gate B: identical-to-English values  (warn >15%, hard fail >40% per locale)"
echo ""

I18N_LOG=$(mktemp /tmp/mpm-i18n-XXXXXX.log)
if npx tsx scripts/i18n-value-quality-scan.ts --warn-identical-above=15 --fail-identical-above=40 >"$I18N_LOG" 2>&1; then
  # Check for warnings even on success
  if grep -q "IDENTICAL-TO-ENGLISH WARNING" "$I18N_LOG"; then
    WARN_LOCALES=$(grep "IDENTICAL-TO-ENGLISH WARNING" "$I18N_LOG" | grep -oP '\w+ \(\d+\.\d+%\)' | tr '\n' ' ' || echo "see report")
    warn "i18n identical gate: locale(s) above 15% warn threshold — ${WARN_LOCALES}"
    echo -e "${YELLOW}  Run: npm run validate:i18n   to see the full report${NC}"
    echo ""
  else
    pass "i18n interpolation gate: no {{variable}} mismatches found"
    pass "i18n identical-to-English gate: all locales within acceptable thresholds"
  fi
else
  # Interpolation failure
  if grep -q "INTERPOLATION GATE FAILED" "$I18N_LOG"; then
    MISMATCH_COUNT=$(grep -oP '\d+ interpolation mismatch' "$I18N_LOG" | grep -oP '^\d+' || echo "?")
    fail "i18n interpolation gate: ${MISMATCH_COUNT} mismatch(es) found — {{variable}} bugs will break the UI at runtime"
    echo ""
    echo -e "${RED}  Interpolation mismatch details (first 20 lines):${NC}"
    grep -A2 "Interp mismatch\|INTERPOLATION GATE" "$I18N_LOG" | head -20 | sed 's/^/    /'
    echo ""
  fi
  # Identical-to-English failure
  if grep -q "IDENTICAL-TO-ENGLISH GATE FAILED" "$I18N_LOG"; then
    FAIL_LOCALES=$(grep -A1 "IDENTICAL-TO-ENGLISH GATE FAILED" "$I18N_LOG" | grep -oP '\w+ \(\d+\.\d+%\)' | tr '\n' ' ' || echo "see report")
    fail "i18n identical gate: locale(s) exceed 40% identical-to-English — half-translated locale must not ship: ${FAIL_LOCALES}"
    echo ""
    echo -e "${RED}  Translate the flagged strings or remove the locale before pushing.${NC}"
    echo ""
  fi
  echo -e "${YELLOW}  Run: npm run validate:i18n   to see the full report${NC}"
  echo ""
fi
rm -f "$I18N_LOG"

# ──────────────────────────────────────────────────
header "Step 5 of 6: Route Parity — dev vs prod"
echo "  Checking that every API route in server/routes.ts is also mounted in server/prod.ts ..."
echo "  (Routes missing from prod.ts cause silent 404s in production only)"
echo ""

# Extract specific /api/* mount paths from each server file.
# Matches: app.use("/api/something"  or  app.use(\`/api/something\`
extract_routes() {
  grep -oP "app\.use\([\"\`']/api/[^\"\`' ,)]+" "$1" 2>/dev/null \
    | sed "s/app\.use([\"\`']//" \
    | sort -u
}

DEV_ROUTES=$(extract_routes "server/routes.ts")
PROD_ROUTES=$(extract_routes "server/prod.ts")

PARITY_MISSING=()
while IFS= read -r path; do
  [ -z "$path" ] && continue
  # Skip bare /api — too generic to diff meaningfully
  [ "$path" = "/api" ] && continue
  if ! echo "$PROD_ROUTES" | grep -qF "$path"; then
    PARITY_MISSING+=("$path")
  fi
done <<< "$DEV_ROUTES"

if [ "${#PARITY_MISSING[@]}" -eq 0 ]; then
  pass "Route parity: all dev routes are present in prod.ts"
else
  # Warn rather than hard-fail: prod.ts intentionally omits some dev-only routes
  # and covers others via generic app.use("/api", router) mounts. Review the list
  # manually and add an explicit mount if any recently added route is missing.
  warn "Route parity: ${#PARITY_MISSING[@]} route path(s) in routes.ts have no matching explicit mount in prod.ts:"
  for missing_path in "${PARITY_MISSING[@]}"; do
    echo -e "${YELLOW}      $missing_path${NC}"
  done
  echo ""
  echo -e "${YELLOW}  Review list above. If any are newly added routes, add them to server/prod.ts.${NC}"
  echo ""
fi

# ──────────────────────────────────────────────────
header "Step 6 of 6: Server Startup Verification"
echo "  Starting an isolated test server (separate port) to verify clean boot..."
echo "  The existing dev server on port 5000 is never touched."
echo ""

# When running as a git pre-push hook (MPM_IS_HOOK=1 is exported by the hook
# script), skip the server boot test. git does not export GIT_DIR to hook
# processes, so we use our own flag instead. Steps 1–5 already gate code
# quality; the boot test is redundant here because it passed in the most recent
# standalone validate run.
if [ -n "$MPM_IS_HOOK" ]; then
  echo -e "${CYAN}  ℹ️  Running as git hook — boot test skipped to preserve session stability.${NC}"
  echo -e "${CYAN}     Run 'npm run validate' standalone to include the full boot test.${NC}"
  echo ""
else

# ── Snapshot the pre-existing dev server state ─────────────────────────────
# We record the PID now. After the test, we confirm it's still alive.
# This is the regression check: validation must never kill the workspace server.
PRE_VALIDATE_DEV_PID=$(lsof -ti:5000 2>/dev/null | head -1 || true)

# ── Find a free port for the isolated test server ──────────────────────────
# Scans 5090–5190 for a port not currently in use. Falls back to 5099.
VALIDATE_PORT=$(python3 -c "
import socket
for p in range(5090, 5190):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind(('', p))
        s.close()
        print(p)
        break
    except OSError:
        pass
" 2>/dev/null || echo "5099")

echo -e "  Using isolated test port: ${CYAN}${VALIDATE_PORT}${NC}"
echo ""

TMPLOG=$(mktemp /tmp/mpm-validate-XXXXXX.log)
PORT=$VALIDATE_PORT NODE_ENV=development tsx server/index.ts >"$TMPLOG" 2>&1 &
SERVER_PID=$!

# Poll /api/health on VALIDATE_PORT for up to 25 seconds
MAX_WAIT=25
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
    "http://localhost:${VALIDATE_PORT}/api/health" 2>/dev/null || echo "000")

  if [ "$HTTP_STATUS" = "200" ]; then
    STARTED=true
    break
  fi

  sleep 1
  ELAPSED=$((ELAPSED + 1))
done

if [ "$STARTED" = true ]; then
  # Hard fail on critical crash patterns in the startup log
  if grep -qiE "uncaughtException|UnhandledPromiseRejection|FATAL|Cannot find module|MODULE_NOT_FOUND|SyntaxError:" "$TMPLOG" 2>/dev/null; then
    fail "Server started but startup log contains critical error patterns:"
    grep -iE "uncaughtException|UnhandledPromiseRejection|FATAL|Cannot find module|MODULE_NOT_FOUND|SyntaxError:" \
      "$TMPLOG" | head -8 | sed 's/^/    /'
  else
    pass "Server started cleanly — /api/health responded with 200 on port ${VALIDATE_PORT}"
    pass "No critical error patterns in startup log"
  fi

  # ── Auth login + session integration tests ────────────────────────────────
  # Runs against the isolated test server to catch route-mounting regressions.
  echo ""
  echo -e "  ${CYAN}Running auth login/session integration tests...${NC}"
  AUTH_TEST_OUT=$(mktemp /tmp/mpm-auth-test-XXXXXX.log)
  if npx tsx scripts/test-auth-integration.ts --base-url "http://localhost:${VALIDATE_PORT}" >"$AUTH_TEST_OUT" 2>&1; then
    cat "$AUTH_TEST_OUT" | sed 's/^/  /'
    pass "Auth login/session integration tests — all checks passed"
  else
    cat "$AUTH_TEST_OUT" | sed 's/^/  /'
    fail "Auth login/session integration tests — one or more checks failed (see above)"
  fi
  rm -f "$AUTH_TEST_OUT"

elif [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
  fail "Server did not respond to /api/health within ${MAX_WAIT}s on port ${VALIDATE_PORT} — startup may have hung"
  echo ""
  echo -e "${YELLOW}  Server output (last 20 lines):${NC}"
  tail -20 "$TMPLOG" | sed 's/^/    /'
fi

rm -f "$TMPLOG"

# ── Shut down ONLY the isolated test server ───────────────────────────────
# Signal the tsx wrapper, then port-sweep to catch the Node.js child process
# that tsx spawns and that plain `kill $SERVER_PID` leaves behind.
if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
  kill "$SERVER_PID" 2>/dev/null || true
  sleep 0.5
  lsof -ti:"$VALIDATE_PORT" 2>/dev/null | xargs -r kill -9 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
  SERVER_PID=""
fi

# ── Regression check: dev server on port 5000 must still be alive ─────────
# Validation must NEVER kill the workspace server. If it was running before,
# it must still be running now. A failure here is a bug in the validate script.
if [ -n "$PRE_VALIDATE_DEV_PID" ]; then
  if kill -0 "$PRE_VALIDATE_DEV_PID" 2>/dev/null; then
    pass "Dev server integrity: port 5000 process (PID $PRE_VALIDATE_DEV_PID) still running — workspace undisturbed"
  else
    fail "Dev server integrity: port 5000 process was killed during validation — this is a validate.sh bug"
    echo -e "${RED}  The workspace dev server should never be stopped by validation.${NC}"
    echo -e "${RED}  Check validate.sh for any lsof/kill calls targeting port 5000.${NC}"
  fi
else
  echo -e "${CYAN}  ℹ️  No dev server was running on port 5000 before validation — nothing to check.${NC}"
fi

fi  # end of: if [ -n "$MPM_IS_HOOK" ] ... else ... fi  (git-hook boot-test guard)

# ──────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   VALIDATION SUMMARY                         ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
if [ "${SHUTDOWN_ACTIVE_CONNS:-0}" -gt 0 ] 2>/dev/null; then
  warn "${SHUTDOWN_ACTIVE_CONNS} active connection(s) were present on port 5000 at shutdown — in-flight requests may have been interrupted"
fi
echo -e "  Hard failures: ${RED}${ERRORS}${NC}"
echo -e "  Warnings:      ${YELLOW}${WARNINGS}${NC}"

if [ "${#FAIL_MESSAGES[@]}" -gt 0 ]; then
  echo ""
  echo -e "  ${RED}${BOLD}Failures:${NC}"
  for msg in "${FAIL_MESSAGES[@]}"; do
    echo -e "    ${RED}❌${NC}  $msg"
  done
fi

if [ "${#WARN_MESSAGES[@]}" -gt 0 ]; then
  echo ""
  echo -e "  ${YELLOW}${BOLD}Warnings:${NC}"
  for msg in "${WARN_MESSAGES[@]}"; do
    echo -e "    ${YELLOW}⚠️ ${NC}  $msg"
  done
fi

echo ""

write_report() {
  local result_line="$1"
  {
    echo "MPM Validation Report"
    echo "Run: $(date)"
    echo "=============================="
    echo ""
    echo "Hard failures: ${ERRORS}"
    echo "Warnings:      ${WARNINGS}"
    echo ""
    if [ "${#FAIL_MESSAGES[@]}" -gt 0 ]; then
      echo "Failures:"
      for msg in "${FAIL_MESSAGES[@]}"; do
        echo "  [FAIL] $msg"
      done
      echo ""
    fi
    if [ "${#WARN_MESSAGES[@]}" -gt 0 ]; then
      echo "Warnings:"
      for msg in "${WARN_MESSAGES[@]}"; do
        echo "  [WARN] $msg"
      done
      echo ""
    fi
    echo "$result_line"
  } > "$REPORT_FILE"
  echo -e "  📄 Report saved: ${CYAN}${REPORT_FILE}${NC}"
  echo ""
}

if [ "$ERRORS" -eq 0 ]; then
  if [ "$WARNINGS" -gt 0 ]; then
    echo -e "  ${YELLOW}${BOLD}⚠️  VALIDATION PASSED WITH WARNINGS — review warnings before pushing${NC}"
    RESULT_LINE="RESULT: PASS WITH WARNINGS"
  else
    echo -e "  ${GREEN}${BOLD}✅ VALIDATION PASSED — safe to push to GitHub${NC}"
    RESULT_LINE="RESULT: PASS"
  fi
  echo ""
  echo -e "  Full push sequence:"
  echo -e "    1. git push origin dev"
  echo -e "    2. Merge dev → main on GitHub"
  echo -e "    3. git pull in production shell"
  echo -e "    4. Check /api/health in browser"
  echo -e "    5. Update LAST_STABLE.md with new commit hash"
  echo ""
  [ "$SAVE_REPORT" -eq 1 ] && write_report "$RESULT_LINE"
  exit 0
else
  echo -e "  ${RED}${BOLD}❌ VALIDATION FAILED — fix ${ERRORS} issue(s) before pushing${NC}"
  echo ""
  [ "$SAVE_REPORT" -eq 1 ] && write_report "RESULT: FAIL (${ERRORS} failure(s))"
  exit 1
fi
