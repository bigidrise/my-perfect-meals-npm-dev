#!/bin/bash
# ============================================================================
#  MPM Production Acceptance Test
#  Run this AFTER every publish — against the real customer-facing domain.
#
#  A release is not successful because it published.
#  A release is successful when this script passes.
#
#  Usage:
#    bash scripts/run-prod-acceptance.sh
#    bash scripts/run-prod-acceptance.sh --sha a83f5d2   # verify specific SHA
#
#  The test always targets app.myperfectmeals.com. It is not configurable
#  to another URL — that would defeat its purpose.
# ============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

PASSED=0; FAILED=0; WARNED=0

pass()   { echo -e "${GREEN}  ✅ PASS${NC}  $1"; PASSED=$((PASSED+1)); }
fail()   { echo -e "${RED}  ❌ FAIL${NC}  $1"; FAILED=$((FAILED+1)); }
warn()   { echo -e "${YELLOW}  ⚠️  WARN${NC}  $1"; WARNED=$((WARNED+1)); }
header() { echo ""; echo -e "${CYAN}━━━ $1 ━━━${NC}"; }

CANONICAL="https://app.myperfectmeals.com"
ALIAS="https://app.myperfectmeals.ai"
PROD_BUCKET="replit-objstore-3ccef2ce-f691-43ed-bb6e-fd72e925a491"
DEV_BUCKET="replit-objstore-2a68d585-4c50-4c2e-a7ff-a9973358bc5b"

# Optional: expected SHA (pass as --sha <sha> argument)
EXPECTED_SHA=""
if [ "${1:-}" = "--sha" ] && [ -n "${2:-}" ]; then
  EXPECTED_SHA="$2"
elif command -v git &>/dev/null && git rev-parse --short HEAD &>/dev/null 2>&1; then
  EXPECTED_SHA=$(git rev-parse --short HEAD)
fi

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   MPM Production Acceptance Test                         ║${NC}"
echo -e "${BOLD}║   Target: ${CANONICAL}   ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Started : $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
[ -n "$EXPECTED_SHA" ] && echo "  Expected SHA: $EXPECTED_SHA"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
header "Gate 1 — Release identity"

RELEASE_JSON=$(curl -sf --max-time 10 "${CANONICAL}/api/release" 2>/dev/null || echo '{}')

if echo "$RELEASE_JSON" | grep -q '"gitSha"'; then
  LIVE_SHA=$(echo "$RELEASE_JSON" | grep -o '"gitSha":"[^"]*"' | cut -d'"' -f4)
  pass "Release endpoint responding (SHA: $LIVE_SHA)"
else
  fail "Release endpoint did not return a gitSha — /api/release may not be deployed yet"
  LIVE_SHA="unknown"
fi

if [ -n "$EXPECTED_SHA" ] && [ "$LIVE_SHA" != "unknown" ]; then
  if [ "$LIVE_SHA" = "$EXPECTED_SHA" ]; then
    pass "Production SHA matches expected: $LIVE_SHA"
  else
    fail "SHA MISMATCH — production is running $LIVE_SHA, expected $EXPECTED_SHA"
    echo "       This means the wrong commit is deployed. Do not declare the release healthy."
  fi
else
  warn "SHA verification skipped (could not determine expected SHA)"
fi

LIVE_BUCKET=$(echo "$RELEASE_JSON" | grep -o '"storageBucketId":"[^"]*"' | cut -d'"' -f4)
if [ "$LIVE_BUCKET" = "$PROD_BUCKET" ]; then
  pass "Storage bucket is correct production bucket"
elif [ "$LIVE_BUCKET" = "$DEV_BUCKET" ]; then
  fail "CRITICAL: Production is using the DEV storage bucket — images will fail"
elif [ -n "$LIVE_BUCKET" ]; then
  fail "Unexpected storage bucket: $LIVE_BUCKET (expected $PROD_BUCKET) — do not declare release healthy"
else
  fail "storageBucketId not present in /api/release — release manifest was not built correctly"
fi

LIVE_ENV=$(echo "$RELEASE_JSON" | grep -o '"environment":"[^"]*"' | cut -d'"' -f4)
if [ "$LIVE_ENV" = "production" ]; then
  pass "Environment tag: production"
elif [ -n "$LIVE_ENV" ]; then
  fail "Environment tag is '$LIVE_ENV' — production build is not tagged correctly"
else
  fail "environment field missing from /api/release — release manifest was not built correctly"
fi

# ─────────────────────────────────────────────────────────────────────────────
header "Gate 2 — Infrastructure health"

HEALTH_JSON=$(curl -sf --max-time 15 "${CANONICAL}/api/health/full" 2>/dev/null || echo '{}')
HEALTH_HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "${CANONICAL}/api/health/full" 2>/dev/null || echo "000")

if [ "$HEALTH_HTTP" = "200" ]; then
  pass "Infrastructure health endpoint → HTTP 200 (all systems healthy)"
elif [ "$HEALTH_HTTP" = "503" ]; then
  fail "Infrastructure health endpoint → HTTP 503 (one or more systems unhealthy)"
  echo "       Response: $HEALTH_JSON"
elif [ "$HEALTH_HTTP" = "404" ]; then
  fail "/api/health/full not found (404) — endpoint not deployed; release cannot be declared healthy"
else
  fail "Infrastructure health returned HTTP $HEALTH_HTTP"
fi

# Parse individual subsystems if JSON available
for SUBSYSTEM in database objectStorage openai auth; do
  VALUE=$(echo "$HEALTH_JSON" | grep -o "\"${SUBSYSTEM}\":\"[^\"]*\"" | cut -d'"' -f4 || true)
  if [ -z "$VALUE" ]; then continue; fi
  if [ "$VALUE" = "healthy" ] || [ "$VALUE" = "configured" ]; then
    pass "  $SUBSYSTEM: $VALUE"
  else
    fail "  $SUBSYSTEM: $VALUE"
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
header "Gate 3 — Environment isolation"

# Check live HTML for dev URL references
HTML=$(curl -sf --max-time 10 "${CANONICAL}/" 2>/dev/null || echo "")
if echo "$HTML" | grep -qi "spock\.replit\.dev\|replit\.dev/public-objects\|my-perfect-meals-npm-dev"; then
  fail "Production HTML/bundle references DEV infrastructure URLs"
  echo "       This means the client bundle was built against dev, not production"
else
  pass "No dev infrastructure URLs found in production HTML bundle"
fi

# Confirm API origin from release endpoint
LIVE_ORIGIN=$(echo "$RELEASE_JSON" | grep -o '"apiOrigin":"[^"]*"' | cut -d'"' -f4)
if [ "$LIVE_ORIGIN" = "app.myperfectmeals.com" ]; then
  pass "apiOrigin is app.myperfectmeals.com"
elif [ -n "$LIVE_ORIGIN" ]; then
  warn "apiOrigin is '$LIVE_ORIGIN' (expected app.myperfectmeals.com)"
else
  warn "apiOrigin not present in /api/release"
fi

# ─────────────────────────────────────────────────────────────────────────────
header "Gate 4 — Authentication wall"

AUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 \
  "${CANONICAL}/api/user/profile" 2>/dev/null || echo "000")

if [ "$AUTH_STATUS" = "401" ]; then
  pass "Auth wall active — unauthenticated profile request → 401"
elif [ "$AUTH_STATUS" = "403" ]; then
  pass "Auth wall active — unauthenticated profile request → 403"
elif [ "$AUTH_STATUS" = "200" ]; then
  fail "CRITICAL: /api/user/profile returned 200 without auth — auth is broken"
else
  fail "Auth gate returned HTTP $AUTH_STATUS (expected 401/403) — auth middleware may not be mounted"
fi

# ─────────────────────────────────────────────────────────────────────────────
header "Gate 5 — Object Storage canary"

CANARY_URL="${CANONICAL}/public-objects/${PROD_BUCKET}/migration-manifest.json"
CANARY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$CANARY_URL" 2>/dev/null || echo "000")
CANARY_TYPE=$(curl -sI --max-time 10 "$CANARY_URL" 2>/dev/null | grep -i "content-type:" | head -1 | tr -d '\r' || true)

if [ "$CANARY_STATUS" = "200" ]; then
  pass "Storage canary object → HTTP 200 ($CANARY_TYPE)"
elif [ "$CANARY_STATUS" = "404" ]; then
  fail "Storage canary not found — run: bash scripts/provision-storage-canary.sh"
elif [ "$CANARY_STATUS" = "503" ]; then
  fail "Storage canary → HTTP 503 — Object Storage is unavailable"
else
  fail "Storage canary returned HTTP $CANARY_STATUS (expected 200)"
fi

# ─────────────────────────────────────────────────────────────────────────────
header "Gate 6 — Domain alias (.ai == .com)"

AI_SHA=$(curl -sf --max-time 10 "${ALIAS}/api/release" 2>/dev/null | grep -o '"gitSha":"[^"]*"' | cut -d'"' -f4 || echo "")
COM_SHA="$LIVE_SHA"

if [ -z "$AI_SHA" ]; then
  warn "${ALIAS}/api/release did not respond or has no gitSha"
  echo "       If .ai is not yet configured, this warning is expected"
elif [ "$AI_SHA" = "$COM_SHA" ]; then
  pass ".ai and .com are serving the same SHA: $AI_SHA"
else
  fail "DOMAIN DIVERGENCE: .ai is serving $AI_SHA, .com is serving $COM_SHA"
  echo "       Two customer domains are on different code. One of them will break."
fi

# ─────────────────────────────────────────────────────────────────────────────
header "Gate 7 — Core route reachability"

for ROUTE in "/api/health" "/api/weekly-board" "/api/shopping-list"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "${CANONICAL}${ROUTE}" 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ]; then
    pass "Route registered: ${ROUTE} → HTTP $STATUS"
  elif [ "$STATUS" = "404" ]; then
    fail "Route missing: ${ROUTE} → 404 (route not mounted in prod)"
  else
    fail "Route ${ROUTE} → HTTP $STATUS (5xx or no response — server error)"
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   ACCEPTANCE TEST SUMMARY                                ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo -e "  Passed:   ${GREEN}${PASSED}${NC}"
echo -e "  Warnings: ${YELLOW}${WARNED}${NC}"
echo -e "  Failed:   ${RED}${FAILED}${NC}"
echo ""

RELEASE_ID=$(echo "$RELEASE_JSON" | grep -o '"releaseId":"[^"]*"' | cut -d'"' -f4 || echo "unknown")

if [ "$FAILED" -gt 0 ]; then
  echo -e "${RED}  ❌ RELEASE FAILED — production is not healthy${NC}"
  echo ""
  echo "  Immediate action: see ROLLBACK.md"
  echo "  Release: $RELEASE_ID | SHA: $LIVE_SHA"
  echo ""
  exit 1
elif [ "$WARNED" -gt 0 ]; then
  echo -e "${YELLOW}  ⚠️  RELEASE PASSED WITH WARNINGS — review warnings before declaring healthy${NC}"
  echo ""
  echo -e "  ${BOLD}RELEASE DECLARED CANDIDATE: $RELEASE_ID | SHA: $LIVE_SHA${NC}"
  echo ""
  exit 0
else
  echo -e "${GREEN}  ✅ ALL GATES PASSED${NC}"
  echo ""
  echo -e "  ${BOLD}RELEASE DECLARED HEALTHY: $RELEASE_ID | SHA: $LIVE_SHA${NC}"
  echo "  Time: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo ""
  exit 0
fi
