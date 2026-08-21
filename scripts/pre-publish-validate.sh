#!/bin/bash
# ============================================================================
#  MPM Pre-Publish Configuration Validator
#  Run this in the PRODUCTION workspace before clicking Publish.
#  If anything fails, do NOT publish — fix the problem first.
#
#  This script is the regression test for the storage-bucket incident:
#  it hard-blocks a publish if production is pointing at dev infrastructure.
#
#  Usage:
#    bash scripts/pre-publish-validate.sh
# ============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

PASSED=0; FAILED=0; WARNED=0

pass()   { echo -e "${GREEN}  ✅ PASS${NC}  $1"; PASSED=$((PASSED+1)); }
fail()   { echo -e "${RED}  ❌ FAIL${NC}  $1"; FAILED=$((FAILED+1)); }
warn()   { echo -e "${YELLOW}  ⚠️  WARN${NC}  $1"; WARNED=$((WARNED+1)); }
header() { echo ""; echo -e "${CYAN}━━━ $1 ━━━${NC}"; }

# ── Known bucket IDs (hard-coded — these are facts about the deployment) ──────
DEV_BUCKET="replit-objstore-2a68d585-4c50-4c2e-a7ff-a9973358bc5b"
PROD_BUCKET="replit-objstore-3ccef2ce-f691-43ed-bb6e-fd72e925a491"
# Dev workspace hostname fragment — any DATABASE_URL containing this is pointing at dev
DEV_HOSTNAME_FRAGMENT="replit.dev"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   MPM Pre-Publish Configuration Validator                ║"
echo "║   Run before every Publish. Failures = do NOT publish.   ║"
echo "╚══════════════════════════════════════════════════════════╝"

# ─────────────────────────────────────────────────────────────────────────────
header "1. Environment identity"

if [ "${NODE_ENV:-}" = "production" ]; then
  pass "NODE_ENV=production"
else
  fail "NODE_ENV=${NODE_ENV:-'(not set)'} — must be 'production' before publishing"
fi

if [ "${REPLIT_DEPLOYMENT:-}" = "1" ]; then
  pass "REPLIT_DEPLOYMENT=1 (running in deployment context)"
else
  warn "REPLIT_DEPLOYMENT is not 1 — are you running this from the production workspace?"
fi

# ─────────────────────────────────────────────────────────────────────────────
header "2. Critical secrets present"

for SECRET in OPENAI_API_KEY SESSION_SECRET STRIPE_SECRET_KEY DATABASE_URL; do
  if [ -n "${!SECRET:-}" ]; then
    pass "$SECRET is set"
  else
    fail "$SECRET is NOT set — meal generation / payments / auth will fail"
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
header "3. Object Storage — environment isolation (CRITICAL)"

BUCKET_ID="${DEFAULT_OBJECT_STORAGE_BUCKET_ID:-}"

if [ -z "$BUCKET_ID" ]; then
  fail "DEFAULT_OBJECT_STORAGE_BUCKET_ID is NOT set — images will fail to load"
elif [ "$BUCKET_ID" = "$DEV_BUCKET" ]; then
  fail "FATAL: DEFAULT_OBJECT_STORAGE_BUCKET_ID is the DEV bucket ($DEV_BUCKET)"
  echo ""
  echo -e "  ${RED}This is exactly the configuration that caused the image outage.${NC}"
  echo "  Production must use the prod bucket: $PROD_BUCKET"
  echo ""
elif [ "$BUCKET_ID" = "$PROD_BUCKET" ]; then
  pass "Storage bucket is the correct PRODUCTION bucket"
else
  warn "Storage bucket is $BUCKET_ID — not the expected prod bucket ($PROD_BUCKET)"
  echo "       If this is intentional (bucket was rotated), update PROD_BUCKET in this script."
fi

# ─────────────────────────────────────────────────────────────────────────────
header "4. Database — environment isolation"

DB_URL="${DATABASE_URL:-}"
if [ -z "$DB_URL" ]; then
  fail "DATABASE_URL is not set"
elif echo "$DB_URL" | grep -qi "$DEV_HOSTNAME_FRAGMENT"; then
  fail "DATABASE_URL contains a dev hostname — production is pointed at dev database"
  echo "       URL fragment: $(echo "$DB_URL" | sed 's|://[^:]*:[^@]*@||' | cut -c1-60)..."
else
  pass "DATABASE_URL does not reference dev infrastructure"
fi

# ─────────────────────────────────────────────────────────────────────────────
header "5. Storage reachability"

if [ -n "$BUCKET_ID" ] && [ "$BUCKET_ID" != "$DEV_BUCKET" ]; then
  # Test the canary object — this is the same object used by monitoring
  CANARY_URL="https://app.myperfectmeals.com/public-objects/${BUCKET_ID}/migration-manifest.json"
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$CANARY_URL" 2>/dev/null || echo "000")
  if [ "$HTTP_STATUS" = "200" ]; then
    pass "Storage canary object reachable (migration-manifest.json → HTTP 200)"
  elif [ "$HTTP_STATUS" = "000" ]; then
    fail "Storage canary request timed out or could not connect"
  else
    fail "Storage canary returned HTTP $HTTP_STATUS (expected 200)"
  fi
else
  warn "Skipping storage reachability check (bucket ID not valid)"
fi

# ─────────────────────────────────────────────────────────────────────────────
header "6. Bundle isolation — no dev URLs in built artifacts"

DIST_DIR="client/dist"
if [ ! -d "$DIST_DIR" ]; then
  warn "client/dist not found — run a build first to check bundle isolation"
else
  DEV_URL_PATTERN="spock\.replit\.dev\|my-perfect-meals-npm-dev\|\.replit\.dev"
  HITS=$(grep -r "$DEV_URL_PATTERN" "$DIST_DIR" 2>/dev/null | grep -v "\.map$" | head -5 || true)
  if [ -z "$HITS" ]; then
    pass "No dev URLs found in client/dist bundle"
  else
    fail "Dev URLs found in production bundle — environment isolation broken"
    echo "$HITS" | while read -r line; do echo "       → $line"; done
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
header "7. TypeScript and build integrity"

if npm run check --silent 2>/dev/null; then
  pass "TypeScript check passed"
else
  fail "TypeScript check failed — fix errors before publishing"
fi

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   PRE-PUBLISH VALIDATION SUMMARY                         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "  Passed:   ${GREEN}${PASSED}${NC}"
echo -e "  Warnings: ${YELLOW}${WARNED}${NC}"
echo -e "  Failed:   ${RED}${FAILED}${NC}"
echo ""

if [ "$FAILED" -gt 0 ]; then
  echo -e "${RED}  ❌ VALIDATION FAILED — do NOT publish until all failures are resolved${NC}"
  echo ""
  exit 1
elif [ "$WARNED" -gt 0 ]; then
  echo -e "${YELLOW}  ⚠️  Passed with warnings — review before publishing${NC}"
  echo ""
  exit 0
else
  echo -e "${GREEN}  ✅ All checks passed — safe to publish${NC}"
  echo ""
  echo "  Next: click Publish in Replit, then run:"
  echo "  bash scripts/run-prod-acceptance.sh"
  echo ""
  exit 0
fi
