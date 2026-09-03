#!/usr/bin/env bash
# =============================================================================
# smoke-diabetes.sh — Diabetes API regression smoke test
#
# Tests that the /api/diabetes/* routes enforce authentication correctly and
# that glucose read/write work for authenticated users.
#
# Usage:
#   bash scripts/smoke-diabetes.sh [BASE_URL] [AUTH_TOKEN]
#
# Examples:
#   bash scripts/smoke-diabetes.sh                        # localhost:5000
#   bash scripts/smoke-diabetes.sh https://my.app TOKEN   # production
#
# The AUTH_TOKEN must be the value stored in the mpm_auth_token localStorage
# key for the test user. Obtain it from DevTools → Application → Local Storage.
#
# Exit codes:
#   0 — all checks passed
#   1 — one or more checks failed
# =============================================================================

BASE="${1:-http://localhost:5000}"
TOKEN="${2:-}"
PASS=0
FAIL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}  ✓ PASS${NC} — $1"; ((PASS++)); }
fail() { echo -e "${RED}  ✗ FAIL${NC} — $1"; ((FAIL++)); }
info() { echo -e "${YELLOW}  →${NC} $1"; }

auth_header() {
  if [ -n "$TOKEN" ]; then
    echo "-H \"x-auth-token: ${TOKEN}\""
  else
    echo ""
  fi
}

curl_auth() {
  local method="$1"; shift
  local url="$1";    shift
  if [ -n "$TOKEN" ]; then
    curl -s -o /tmp/smoke_body -w "%{http_code}" \
      -X "$method" \
      -H "Content-Type: application/json" \
      -H "x-auth-token: ${TOKEN}" \
      "$@" "$url"
  else
    curl -s -o /tmp/smoke_body -w "%{http_code}" \
      -X "$method" \
      -H "Content-Type: application/json" \
      --cookie-jar /tmp/smoke_cookies \
      --cookie /tmp/smoke_cookies \
      "$@" "$url"
  fi
}

curl_anon() {
  local method="$1"; shift
  local url="$1";    shift
  curl -s -o /tmp/smoke_body -w "%{http_code}" \
    -X "$method" \
    -H "Content-Type: application/json" \
    "$@" "$url"
}

echo ""
echo "================================================================"
echo " MyPerfectMeals — Diabetes API Smoke Test"
echo " Base URL : $BASE"
echo " Auth mode: $([ -n "$TOKEN" ] && echo "x-auth-token header" || echo "session cookie")"
echo "================================================================"
echo ""

# ── TEST 1: Unauthenticated glucose read must return 401, never 500 ──────────
echo "TEST 1: Unauthenticated GET /api/diabetes/glucose → must be 401"
STATUS=$(curl_anon GET "${BASE}/api/diabetes/glucose")
BODY=$(cat /tmp/smoke_body)
if [ "$STATUS" = "401" ]; then
  pass "Got 401 (not 500, not 200)"
else
  fail "Expected 401, got $STATUS. Body: $BODY"
fi

# ── TEST 2: Unauthenticated glucose write must return 401, never 500 ─────────
echo ""
echo "TEST 2: Unauthenticated POST /api/diabetes/glucose → must be 401"
STATUS=$(curl_anon POST "${BASE}/api/diabetes/glucose" \
  -d '{"valueMgdl":120,"context":"PRE_MEAL"}')
BODY=$(cat /tmp/smoke_body)
if [ "$STATUS" = "401" ]; then
  pass "Got 401 (not 500)"
else
  fail "Expected 401, got $STATUS. Body: $BODY"
fi

# ── TEST 3: Unauthenticated profile read must return 401 ─────────────────────
echo ""
echo "TEST 3: Unauthenticated GET /api/diabetes/profile → must be 401"
STATUS=$(curl_anon GET "${BASE}/api/diabetes/profile")
BODY=$(cat /tmp/smoke_body)
if [ "$STATUS" = "401" ]; then
  pass "Got 401"
else
  fail "Expected 401, got $STATUS. Body: $BODY"
fi

# ── Authenticated tests only run if TOKEN or session cookie is provided ───────
if [ -z "$TOKEN" ]; then
  echo ""
  echo "─────────────────────────────────────────────────────────────────"
  echo " No AUTH_TOKEN supplied — skipping authenticated tests."
  echo " To run all tests:"
  echo "   bash scripts/smoke-diabetes.sh ${BASE} <your-mpm_auth_token>"
  echo "─────────────────────────────────────────────────────────────────"
else
  # ── TEST 4: Authenticated glucose read must return 200 ───────────────────
  echo ""
  echo "TEST 4: Authenticated GET /api/diabetes/glucose → must be 200"
  STATUS=$(curl_auth GET "${BASE}/api/diabetes/glucose?limit=5")
  BODY=$(cat /tmp/smoke_body)
  if [ "$STATUS" = "200" ]; then
    pass "Got 200"
    if echo "$BODY" | grep -q '"data"'; then
      pass "Response has 'data' field"
    else
      fail "Response missing 'data' field. Body: $BODY"
    fi
  else
    fail "Expected 200, got $STATUS. Body: $BODY"
  fi

  # ── TEST 5: Authenticated glucose write must return 201 ──────────────────
  echo ""
  echo "TEST 5: Authenticated POST /api/diabetes/glucose → must be 201"
  TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  STATUS=$(curl_auth POST "${BASE}/api/diabetes/glucose" \
    -d "{\"valueMgdl\":115,\"context\":\"PRE_MEAL\",\"recordedAt\":\"${TS}\"}")
  BODY=$(cat /tmp/smoke_body)
  if [ "$STATUS" = "201" ]; then
    pass "Got 201"
    if echo "$BODY" | grep -q '"ok":true'; then
      pass "Response has ok:true"
    else
      fail "Response missing ok:true. Body: $BODY"
    fi
  else
    fail "Expected 201, got $STATUS. Body: $BODY"
  fi

  # ── TEST 6: Out-of-range value must return 422 ───────────────────────────
  echo ""
  echo "TEST 6: POST /api/diabetes/glucose with valueMgdl=5 → must be 422"
  STATUS=$(curl_auth POST "${BASE}/api/diabetes/glucose" \
    -d '{"valueMgdl":5,"context":"PRE_MEAL"}')
  BODY=$(cat /tmp/smoke_body)
  if [ "$STATUS" = "422" ]; then
    pass "Got 422 (value_out_of_range rejected)"
  else
    fail "Expected 422, got $STATUS. Body: $BODY"
  fi

  # ── TEST 7: Missing required fields must return 400 ──────────────────────
  echo ""
  echo "TEST 7: POST /api/diabetes/glucose missing context → must be 400"
  STATUS=$(curl_auth POST "${BASE}/api/diabetes/glucose" \
    -d '{"valueMgdl":120}')
  BODY=$(cat /tmp/smoke_body)
  if [ "$STATUS" = "400" ]; then
    pass "Got 400 (missing_fields rejected)"
  else
    fail "Expected 400, got $STATUS. Body: $BODY"
  fi

  # ── TEST 8: Response must never be 500 for any diabetes route ────────────
  echo ""
  echo "TEST 8: No diabetes route may return 500 for an authenticated user"
  for ROUTE in "/api/diabetes/glucose" "/api/diabetes/profile"; do
    STATUS=$(curl_auth GET "${BASE}${ROUTE}")
    if [ "$STATUS" = "500" ]; then
      fail "GET ${ROUTE} returned 500 — server error for authenticated user"
    else
      pass "GET ${ROUTE} returned $STATUS (not 500)"
    fi
  done
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "================================================================"
echo " Results: ${PASS} passed, ${FAIL} failed"
echo "================================================================"
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
