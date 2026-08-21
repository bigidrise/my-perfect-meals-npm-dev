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
#
# ── Bucket rotation instructions ─────────────────────────────────────────────
#  When the production Object Storage bucket is rotated or renamed:
#    1. Update the DEFAULT_OBJECT_STORAGE_BUCKET_ID secret in the PRODUCTION
#       Replit deployment to the new bucket ID.
#    2. Update ACTIVE_BUCKET_ID in server/objectStorage.ts if the dev bucket
#       also changed (dev bucket = DEV_BUCKET below).
#    3. The DEV_BUCKET constant below is the ONLY hardcoded bucket ID in this
#       script. It is the dev-workspace bucket that must NEVER be used in
#       production. If the dev bucket itself is rotated, update DEV_BUCKET here
#       AND update ACTIVE_BUCKET_ID in server/objectStorage.ts to match.
#    4. The production bucket ID is intentionally NOT hardcoded here — the
#       script reads DEFAULT_OBJECT_STORAGE_BUCKET_ID from the environment
#       at runtime so it automatically accepts any rotated prod bucket without
#       a code change.
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

PASSED=0; FAILED=0; WARNED=0

pass()   { echo -e "${GREEN}  ✅ PASS${NC}  $1"; PASSED=$((PASSED+1)); }
fail()   { echo -e "${RED}  ❌ FAIL${NC}  $1"; FAILED=$((FAILED+1)); }
warn()   { echo -e "${YELLOW}  ⚠️  WARN${NC}  $1"; WARNED=$((WARNED+1)); }
header() { echo ""; echo -e "${CYAN}━━━ $1 ━━━${NC}"; }

# ── DEV bucket ID — the ONE bucket that must never reach production ───────────
# Cross-reference: server/objectStorage.ts ACTIVE_BUCKET_ID must equal this
# value (it is the active bucket for the dev workspace).  If you update one,
# update the other.
DEV_BUCKET="replit-objstore-2a68d585-4c50-4c2e-a7ff-a9973358bc5b"
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
  echo "  Set DEFAULT_OBJECT_STORAGE_BUCKET_ID to the production bucket ID in the"
  echo "  Replit deployment secrets, then re-run this script."
  echo ""
else
  pass "Storage bucket is a non-dev bucket — $BUCKET_ID"
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
header "5. Database — reachability"

if [ -n "$DB_URL" ] && ! echo "$DB_URL" | grep -qi "$DEV_HOSTNAME_FRAGMENT"; then
  DB_RESULT=$(psql "$DB_URL" -c "SELECT 1" -q --no-psqlrc --tuples-only 2>&1)
  if echo "$DB_RESULT" | grep -q "1"; then
    pass "Database is reachable (SELECT 1 succeeded)"
  else
    fail "Database is NOT reachable — SELECT 1 failed: $(echo "$DB_RESULT" | head -1)"
  fi
else
  warn "Skipping database reachability check (DATABASE_URL not valid or points at dev)"
fi

# ─────────────────────────────────────────────────────────────────────────────
header "6. Storage reachability"

if [ -n "$BUCKET_ID" ] && [ "$BUCKET_ID" != "$DEV_BUCKET" ]; then
  # Test the canary object — this is the same object used by monitoring.
  # Run scripts/provision-storage-canary.sh once if this fails on a fresh bucket.
  CANARY_URL="https://app.myperfectmeals.com/public-objects/${BUCKET_ID}/migration-manifest.json"
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$CANARY_URL" 2>/dev/null || echo "000")
  if [ "$HTTP_STATUS" = "200" ]; then
    pass "Storage canary object reachable (migration-manifest.json → HTTP 200)"
  elif [ "$HTTP_STATUS" = "000" ]; then
    fail "Storage canary request timed out or could not connect"
  else
    fail "Storage canary returned HTTP $HTTP_STATUS (expected 200) — run: bash scripts/provision-storage-canary.sh"
  fi
else
  warn "Skipping storage reachability check (bucket ID not valid)"
fi

# ─────────────────────────────────────────────────────────────────────────────
header "7. Shared dialog primitive — screenshot diff review (Gate 2)"

# Check whether universal-modal.tsx or dialog.tsx has changed since the last
# publish baseline.  If so, the modal-screenshot-diff.sh workflow must have been
# run and the reviewer must have acknowledged any diff ≥ 2% of pixels.
#
# The acknowledgement is a simple flag file written by:
#   bash scripts/modal-screenshot-diff.sh acknowledge
#
# Why a flag file (not a git tag or env var): it survives across shell sessions
# and is resettable with a single rm, which is the safest pattern for this kind
# of "must be reviewed before proceeding" gate.

REVIEW_FLAG=".agents/modal-diff-reviewed"
SHARED_PRIMITIVES_CHANGED=0

# Detect whether the shared primitives have local changes vs the last commit,
# OR vs the remote main branch (whichever reveals more).
PRIM_FILES=(
  "client/src/components/ui/universal-modal.tsx"
  "client/src/components/ui/dialog.tsx"
)

for prim in "${PRIM_FILES[@]}"; do
  if git diff HEAD -- "$prim" 2>/dev/null | grep -q "^[+-]"; then
    SHARED_PRIMITIVES_CHANGED=1
    warn "Shared primitive modified (uncommitted): $prim"
  fi
  if git diff HEAD~1 HEAD -- "$prim" 2>/dev/null | grep -q "^[+-]"; then
    SHARED_PRIMITIVES_CHANGED=1
    warn "Shared primitive modified (last commit): $prim"
  fi
done

if [ "$SHARED_PRIMITIVES_CHANGED" -eq 1 ]; then
  if [ -f "$REVIEW_FLAG" ]; then
    REVIEWED_AT=$(grep "reviewed_at=" "$REVIEW_FLAG" 2>/dev/null | cut -d= -f2 || echo "unknown")
    pass "Shared primitive diff acknowledged (reviewed_at: $REVIEWED_AT)"
    echo "       Flag: $REVIEW_FLAG"
  else
    fail "Shared primitives changed but screenshot diff NOT reviewed"
    echo ""
    echo "  ${RED}UniversalDialog or DialogContent was modified but the screenshot diff${NC}"
    echo "  workflow has not been completed.  This risks silent mobile layout regressions"
    echo "  that produce zero JS errors (reference incident: InspirationCaptureModal, Aug 2026)."
    echo ""
    echo "  To resolve:"
    echo "    1. Run BEFORE your edit (if not already done):"
    echo "         bash scripts/modal-screenshot-diff.sh before"
    echo "    2. Make your changes to the shared primitives."
    echo "    3. Capture the AFTER screenshots and compare:"
    echo "         bash scripts/modal-screenshot-diff.sh after"
    echo "    4. Review the diff images in docs/screenshots/modal-diff/diff/"
    echo "    5. If the change is intentional, acknowledge and re-run this script:"
    echo "         bash scripts/modal-screenshot-diff.sh acknowledge"
    echo "         bash scripts/pre-publish-validate.sh"
    echo ""
  fi
else
  pass "Shared dialog primitives unchanged — no diff review required"
fi

# ─────────────────────────────────────────────────────────────────────────────
header "7a. Modal viewport tests — responsive layout guard (Gate 1)"

# Gate 1 (docs/responsive-ui-regression-guard.md Phase 4): run the Playwright
# viewport tests whenever the shared dialog primitives have changed (or when
# no fingerprint exists yet), then write a fingerprint so subsequent runs can
# skip re-execution when nothing changed.
#
# How it works:
#   1. Compute SHA-256 fingerprints of the two watched primitives.
#   2. If the fingerprints match the stored lock → tests are fresh → PASS.
#   3. If they differ (or no lock) → run the Playwright specs right now:
#        client/e2e/inspiration-capture-modal-viewport.spec.ts
#        client/e2e/universal-modal-viewport.spec.ts
#   4. On success → update the lock and PASS.
#   5. On failure → FAIL (block publish).
#
# To force a re-run regardless of fingerprint state:
#   bash scripts/run-modal-viewport-tests.sh
#   bash scripts/pre-publish-validate.sh

MODAL_LOCK="scripts/checksums/modal-viewport-gate.lock"
GATE1_PRIMITIVE_A="client/src/components/ui/universal-modal.tsx"
GATE1_PRIMITIVE_B="client/src/components/ui/dialog.tsx"
GATE1_SPEC_A="client/e2e/inspiration-capture-modal-viewport.spec.ts"
GATE1_SPEC_B="client/e2e/universal-modal-viewport.spec.ts"

# Compute current fingerprints up-front (needed for both paths)
CURRENT_SHA_A=""
CURRENT_SHA_B=""
if [ -f "$GATE1_PRIMITIVE_A" ]; then
  CURRENT_SHA_A=$(sha256sum "$GATE1_PRIMITIVE_A" | awk '{print $1}')
else
  fail "Watched primitive not found: $GATE1_PRIMITIVE_A"
fi
if [ -f "$GATE1_PRIMITIVE_B" ]; then
  CURRENT_SHA_B=$(sha256sum "$GATE1_PRIMITIVE_B" | awk '{print $1}')
else
  fail "Watched primitive not found: $GATE1_PRIMITIVE_B"
fi

GATE1_NEED_RUN=0
GATE1_STORED_TS="never"

if [ -z "$CURRENT_SHA_A" ] || [ -z "$CURRENT_SHA_B" ]; then
  # Already failed above — skip further checks
  GATE1_NEED_RUN=0
elif [ ! -f "$MODAL_LOCK" ]; then
  echo "  No Gate 1 fingerprint found — running modal viewport tests now..."
  GATE1_NEED_RUN=1
else
  STORED_SHA_A=$(grep "^universal_modal_sha256=" "$MODAL_LOCK" | cut -d= -f2 || echo "")
  STORED_SHA_B=$(grep "^dialog_sha256=" "$MODAL_LOCK" | cut -d= -f2 || echo "")
  GATE1_STORED_TS=$(grep "^timestamp=" "$MODAL_LOCK" | cut -d= -f2 || echo "unknown")

  if [ -z "$STORED_SHA_A" ] || [ -z "$STORED_SHA_B" ]; then
    echo "  Gate 1 fingerprint malformed — running modal viewport tests now..."
    GATE1_NEED_RUN=1
  elif [ "$CURRENT_SHA_A" != "$STORED_SHA_A" ] || [ "$CURRENT_SHA_B" != "$STORED_SHA_B" ]; then
    echo "  Shared dialog primitive changed since last passing run ($GATE1_STORED_TS) — running modal viewport tests now..."
    GATE1_NEED_RUN=1
  fi
fi

if [ "$GATE1_NEED_RUN" -eq 1 ]; then
  # Spec files must exist
  if [ ! -f "$GATE1_SPEC_A" ] || [ ! -f "$GATE1_SPEC_B" ]; then
    fail "Modal viewport spec files not found — cannot run Gate 1"
    echo "  Expected:"
    echo "    $GATE1_SPEC_A"
    echo "    $GATE1_SPEC_B"
  elif ! command -v npx &>/dev/null; then
    fail "npx not available — cannot run modal viewport tests"
    echo "  Install Node.js and re-run this script."
  else
    echo ""
    if npx playwright test "$GATE1_SPEC_A" "$GATE1_SPEC_B"; then
      # Tests passed — write updated fingerprint
      GATE1_RUN_TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
      mkdir -p "$(dirname "$MODAL_LOCK")"
      cat > "$MODAL_LOCK" <<LOCKEOF
# Modal Viewport Gate — fingerprint of last passing run
# Generated by: scripts/pre-publish-validate.sh (Gate 1 — Phase 4)
# Specs: $GATE1_SPEC_A
#        $GATE1_SPEC_B
# Architecture: docs/responsive-ui-regression-guard.md Gate 1
timestamp=$GATE1_RUN_TS
universal_modal_sha256=$CURRENT_SHA_A
dialog_sha256=$CURRENT_SHA_B
LOCKEOF
      pass "Modal viewport tests passed for current dialog primitives (run: $GATE1_RUN_TS)"
    else
      fail "Modal viewport tests FAILED — layout regression detected, do NOT publish"
      echo ""
      echo "  ${RED}One or more shared dialog primitives have a viewport regression.${NC}"
      echo "  This blocks publish to prevent a layout break from reaching production."
      echo ""
      echo "  Debug steps:"
      echo "    npx playwright show-report"
      echo "    npx playwright test $GATE1_SPEC_A $GATE1_SPEC_B --headed"
      echo ""
    fi
  fi
elif [ -n "$CURRENT_SHA_A" ] && [ -n "$CURRENT_SHA_B" ] && [ "$GATE1_NEED_RUN" -eq 0 ]; then
  # Fingerprints matched — tests are still valid for current code
  pass "Modal viewport tests passed for current dialog primitives (run: $GATE1_STORED_TS)"
fi

# ─────────────────────────────────────────────────────────────────────────────
header "8. Bundle isolation — no dev URLs in built artifacts"

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
