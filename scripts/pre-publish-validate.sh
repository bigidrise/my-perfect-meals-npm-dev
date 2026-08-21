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
# run, all 21 capture pairs compared, and the reviewer must have acknowledged
# any diff ≥ 2% of pixels.
#
# The gate uses a two-file state model:
#   .agents/modal-diff-manifest   — written by `after`; contains SHA-256
#                                   fingerprints of both primitives at capture time
#   .agents/modal-diff-reviewed   — written by `after` (auto) or `acknowledge`
#
# Both files must exist AND the manifest fingerprints must match the current
# on-disk primitive files.  If the primitives changed again after the last
# `after` run, the stored fingerprints will differ and this gate fails, forcing
# a fresh comparison cycle.

REVIEW_FLAG=".agents/modal-diff-reviewed"
MANIFEST=".agents/modal-diff-manifest"
SHARED_PRIMITIVES_CHANGED=0

PRIM_UNIVERSAL_MODAL="client/src/components/ui/universal-modal.tsx"
PRIM_DIALOG="client/src/components/ui/dialog.tsx"

# Detect whether the shared primitives have changed (uncommitted or last commit)
for prim in "$PRIM_UNIVERSAL_MODAL" "$PRIM_DIALOG"; do
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
  GATE2_OK=1

  # 1. Review flag must exist
  if [ ! -f "$REVIEW_FLAG" ]; then
    fail "Shared primitives changed but screenshot diff NOT reviewed"
    GATE2_OK=0
  fi

  # 2. Manifest must exist (proves `after` was run, not just `acknowledge`)
  if [ ! -f "$MANIFEST" ]; then
    fail "Diff manifest missing — 'after' command was never completed"
    GATE2_OK=0
  fi

  if [ "$GATE2_OK" -eq 1 ]; then
    # 3. Fingerprint check — re-hash both primitives now and compare to the
    #    values recorded in the manifest when `after` ran.  Any subsequent edit
    #    to the primitives will produce a mismatch and force a fresh cycle.
    STORED_HASH_MODAL=$(grep "^primitive_hash_universal_modal=" "$MANIFEST" 2>/dev/null | cut -d= -f2 || echo "")
    STORED_HASH_DIALOG=$(grep "^primitive_hash_dialog=" "$MANIFEST" 2>/dev/null | cut -d= -f2 || echo "")

    CURRENT_HASH_MODAL=$(sha256sum "$PRIM_UNIVERSAL_MODAL" 2>/dev/null | awk '{print $1}' || echo "missing")
    CURRENT_HASH_DIALOG=$(sha256sum "$PRIM_DIALOG" 2>/dev/null | awk '{print $1}' || echo "missing")

    FINGERPRINT_OK=1
    if [ "$CURRENT_HASH_MODAL" != "$STORED_HASH_MODAL" ]; then
      fail "universal-modal.tsx changed after the screenshot diff was captured"
      echo "       Stored:  ${STORED_HASH_MODAL:0:16}..."
      echo "       Current: ${CURRENT_HASH_MODAL:0:16}..."
      FINGERPRINT_OK=0
    fi
    if [ "$CURRENT_HASH_DIALOG" != "$STORED_HASH_DIALOG" ]; then
      fail "dialog.tsx changed after the screenshot diff was captured"
      echo "       Stored:  ${STORED_HASH_DIALOG:0:16}..."
      echo "       Current: ${CURRENT_HASH_DIALOG:0:16}..."
      FINGERPRINT_OK=0
    fi

    if [ "$FINGERPRINT_OK" -eq 1 ]; then
      REVIEWED_AT=$(grep "^reviewed_at=" "$REVIEW_FLAG" 2>/dev/null | cut -d= -f2 || echo "unknown")
      COMPARED=$(grep "^compared=" "$MANIFEST" 2>/dev/null | cut -d= -f2 || echo "?")
      pass "Shared primitive diff acknowledged — $COMPARED pairs compared, fingerprints match (reviewed_at: $REVIEWED_AT)"
    else
      echo ""
      echo "  The primitives were edited after the last screenshot comparison."
      echo "  Run a fresh diff cycle:"
      echo "    bash scripts/modal-screenshot-diff.sh before"
      echo "    bash scripts/modal-screenshot-diff.sh after"
      echo "    bash scripts/modal-screenshot-diff.sh acknowledge   # if diff ≥ 2%"
      echo ""
    fi
  else
    echo ""
    echo "  ${RED}UniversalDialog or DialogContent was modified but the screenshot diff${NC}"
    echo "  workflow has not been completed.  This risks silent mobile layout regressions"
    echo "  that produce zero JS errors (reference incident: InspirationCaptureModal, Aug 2026)."
    echo ""
    echo "  To resolve:"
    echo "    1. bash scripts/modal-screenshot-diff.sh before"
    echo "    2. <make your changes to the shared primitives>"
    echo "    3. bash scripts/modal-screenshot-diff.sh after"
    echo "    4. Review diff images in docs/screenshots/modal-diff/diff/"
    echo "    5. bash scripts/modal-screenshot-diff.sh acknowledge   # if diff ≥ 2%"
    echo "    6. bash scripts/pre-publish-validate.sh"
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
header "7b. Sheet/Drawer viewport tests — responsive layout guard (Gate 1)"

# Mirrors section 7a for the Sheet (Radix) and Drawer (Vaul) primitives.
# sheet.tsx uses `inset-x-0` for bottom sheets and `inset-y-0 h-full` for
# side sheets; drawer.tsx uses `inset-x-0 bottom-0`. An accidental override
# of those classes causes the component to overflow the viewport with zero
# JS/TS errors — the same failure mode as the August 2026 InspirationCaptureModal
# incident.
#
# Lock file: scripts/checksums/sheet-viewport-gate.lock
# Spec:      client/e2e/bottom-sheet-viewport.spec.ts
# Harness:   client/src/pages/SheetTestHarness.tsx (/__sheet-test__)

SHEET_LOCK="scripts/checksums/sheet-viewport-gate.lock"
GATE1B_PRIMITIVE_C="client/src/components/ui/sheet.tsx"
GATE1B_PRIMITIVE_D="client/src/components/ui/drawer.tsx"
GATE1B_SPEC_C="client/e2e/bottom-sheet-viewport.spec.ts"

CURRENT_SHA_C=""
CURRENT_SHA_D=""
if [ -f "$GATE1B_PRIMITIVE_C" ]; then
  CURRENT_SHA_C=$(sha256sum "$GATE1B_PRIMITIVE_C" | awk '{print $1}')
else
  fail "Watched primitive not found: $GATE1B_PRIMITIVE_C"
fi
if [ -f "$GATE1B_PRIMITIVE_D" ]; then
  CURRENT_SHA_D=$(sha256sum "$GATE1B_PRIMITIVE_D" | awk '{print $1}')
else
  fail "Watched primitive not found: $GATE1B_PRIMITIVE_D"
fi

GATE1B_NEED_RUN=0
GATE1B_STORED_TS="never"

if [ -z "$CURRENT_SHA_C" ] || [ -z "$CURRENT_SHA_D" ]; then
  GATE1B_NEED_RUN=0
elif [ ! -f "$SHEET_LOCK" ]; then
  echo "  No Gate 1b fingerprint found — running sheet/drawer viewport tests now..."
  GATE1B_NEED_RUN=1
else
  STORED_SHA_C=$(grep "^sheet_sha256=" "$SHEET_LOCK" | cut -d= -f2 || echo "")
  STORED_SHA_D=$(grep "^drawer_sha256=" "$SHEET_LOCK" | cut -d= -f2 || echo "")
  GATE1B_STORED_TS=$(grep "^timestamp=" "$SHEET_LOCK" | cut -d= -f2 || echo "unknown")

  if [ -z "$STORED_SHA_C" ] || [ -z "$STORED_SHA_D" ]; then
    echo "  Gate 1b fingerprint malformed — running sheet/drawer viewport tests now..."
    GATE1B_NEED_RUN=1
  elif [ "$CURRENT_SHA_C" != "$STORED_SHA_C" ] || [ "$CURRENT_SHA_D" != "$STORED_SHA_D" ]; then
    echo "  Sheet/Drawer primitive changed since last passing run ($GATE1B_STORED_TS) — running tests now..."
    GATE1B_NEED_RUN=1
  fi
fi

if [ "$GATE1B_NEED_RUN" -eq 1 ]; then
  if [ ! -f "$GATE1B_SPEC_C" ]; then
    fail "Sheet viewport spec not found — cannot run Gate 1b"
    echo "  Expected: $GATE1B_SPEC_C"
  elif ! command -v npx &>/dev/null; then
    fail "npx not available — cannot run sheet/drawer viewport tests"
    echo "  Install Node.js and re-run this script."
  else
    echo ""
    if npx playwright test "$GATE1B_SPEC_C"; then
      GATE1B_RUN_TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
      mkdir -p "$(dirname "$SHEET_LOCK")"
      cat > "$SHEET_LOCK" <<LOCKEOF
# Sheet/Drawer Viewport Gate — fingerprint of last passing run
# Generated by: scripts/pre-publish-validate.sh (Gate 1b)
# Spec: $GATE1B_SPEC_C
# Architecture: docs/responsive-ui-regression-guard.md Gate 1
timestamp=$GATE1B_RUN_TS
sheet_sha256=$CURRENT_SHA_C
drawer_sha256=$CURRENT_SHA_D
LOCKEOF
      pass "Sheet/Drawer viewport tests passed for current primitives (run: $GATE1B_RUN_TS)"
    else
      fail "Sheet/Drawer viewport tests FAILED — layout regression detected, do NOT publish"
      echo ""
      echo "  ${RED}sheet.tsx or drawer.tsx has a viewport regression.${NC}"
      echo "  This blocks publish to prevent a layout break from reaching production."
      echo ""
      echo "  Debug steps:"
      echo "    npx playwright show-report"
      echo "    npx playwright test $GATE1B_SPEC_C --headed"
      echo ""
    fi
  fi
elif [ -n "$CURRENT_SHA_C" ] && [ -n "$CURRENT_SHA_D" ] && [ "$GATE1B_NEED_RUN" -eq 0 ]; then
  pass "Sheet/Drawer viewport tests passed for current primitives (run: $GATE1B_STORED_TS)"
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
header "8. Responsive modal tests — viewport bounds guard"
#
# Runs the Playwright responsive test suite against every supported mobile
# viewport (375px → 1280px) and asserts that no modal/dialog overflows the
# screen, occludes a close button, or hides a primary CTA.
#
# Gate logic: only runs when modal/dialog files have changed since the last
# commit — avoids slowing every publish when UI has not been touched.
#
# Failure format (printed on failure):
#   InspirationCaptureModal right=422 exceeds viewport width=375 at small-iphone-portrait
#
# Reference: docs/responsive-ui-regression-guard.md (Gate 2 integration)

MODAL_CHANGED=false

# Detect if any modal/dialog source files changed since the last commit.
# Patterns match the trigger rules in responsive-ui-regression-guard.md §Gate 1.
if command -v git &>/dev/null && git rev-parse --git-dir &>/dev/null 2>&1; then
  CHANGED_FILES=$(git diff HEAD~1 --name-only 2>/dev/null || git diff --name-only 2>/dev/null || echo "")
  if echo "$CHANGED_FILES" | grep -qE '(Modal|Sheet|Drawer)\.tsx$|ui/dialog\.tsx|ui/universal-modal\.tsx|ui/.*[Ss]heet|ui/.*[Dd]rawer'; then
    MODAL_CHANGED=true
    echo "  Detected modal/dialog file changes — responsive tests will run."
  else
    echo "  No modal/dialog files changed since last commit."
  fi
else
  # Git unavailable in this environment — run tests unconditionally to be safe.
  MODAL_CHANGED=true
  echo "  Git unavailable — running responsive tests unconditionally."
fi

if [ "$MODAL_CHANGED" = "false" ]; then
  warn "No modal/dialog files changed — skipping responsive viewport tests (fast path)"
else
  MODAL_TEST_FILE="client/e2e/modal-responsive.spec.ts"

  if [ ! -f "$MODAL_TEST_FILE" ]; then
    fail "Responsive modal test file not found: $MODAL_TEST_FILE"
    echo "  Run: git pull to ensure the test suite is present."
  elif ! command -v npx &>/dev/null; then
    warn "npx not available — cannot run responsive modal tests; verify viewport bounds manually before publishing"
  else
    # ── Ensure the app server is reachable ──────────────────────────────────
    # The modal tests navigate the real app at localhost:5000. If the server is
    # not already running (e.g. this script is run in a fresh shell), start the
    # dev server temporarily so the tests have a live app to measure.
    MODAL_SERVER_PID=""
    MODAL_SERVER_STARTED=false

    if ! curl -s --max-time 3 "http://localhost:5000/" > /dev/null 2>&1; then
      echo "  App server not running — starting dev server for responsive modal tests..."
      NODE_ENV=development tsx server/index.ts > /tmp/modal-test-server.log 2>&1 &
      MODAL_SERVER_PID=$!

      # Wait up to 30 s for the server to accept connections
      SERVER_READY=false
      for i in $(seq 1 30); do
        sleep 1
        if curl -s --max-time 2 "http://localhost:5000/" > /dev/null 2>&1; then
          SERVER_READY=true
          break
        fi
      done

      if [ "$SERVER_READY" = "true" ]; then
        MODAL_SERVER_STARTED=true
        echo "  Dev server ready on :5000"
      else
        echo "  Dev server did not start in time. Tail: $(tail -5 /tmp/modal-test-server.log 2>/dev/null)"
        kill "$MODAL_SERVER_PID" 2>/dev/null || true
        warn "Could not start dev server — responsive modal tests skipped; verify layout manually before publishing"
        MODAL_SERVER_PID=""
      fi
    else
      echo "  App server already running on :5000"
    fi

    # ── Run Playwright if server is available ────────────────────────────────
    if curl -s --max-time 3 "http://localhost:5000/" > /dev/null 2>&1; then
      echo "  Running: npx playwright test $MODAL_TEST_FILE --reporter=list"
      echo ""
      PW_EXIT_CODE=0
      PW_OUTPUT=$(E2E_BASE_URL=http://localhost:5000 \
        npx playwright test "$MODAL_TEST_FILE" --reporter=list 2>&1) || PW_EXIT_CODE=$?

      if [ "$PW_EXIT_CODE" -eq 0 ]; then
        PW_PASSED=$(echo "$PW_OUTPUT" | grep -cE '(✓|passed|ok)' 2>/dev/null || echo "?")
        pass "Responsive modal tests passed — all viewport bounds checks OK ($PW_PASSED tests)"
      else
        fail "Responsive modal tests FAILED — modal overflow or inaccessible control detected"
        echo ""
        echo -e "  ${RED}Failing assertions:${NC}"
        # Print lines that contain viewport names or assertion values — these are
        # the precise failure messages in the format the gate was designed to surface:
        #   InspirationCaptureModal right=422.0 exceeds viewport width=375 at small-iphone-portrait
        echo "$PW_OUTPUT" | grep -E \
          "(exceeds viewport|exceeds viewport width|off-screen|outside viewport|wider than viewport|Error:|FAIL|✗|×)" \
          2>/dev/null | sed 's/^/    /' | head -30
        echo ""
        echo "  How to diagnose:"
        echo "    1. Run: npx playwright test $MODAL_TEST_FILE --reporter=list"
        echo "    2. Look for the viewport name in the failure, e.g. 'at small-iphone-portrait'"
        echo "    3. Common causes: negative margin, removed max-width, flex restructuring"
        echo "    4. Rule: spacing/padding fixes must NOT restructure flex/overflow/width"
        echo "    5. Docs: docs/responsive-ui-regression-guard.md — minimal-blast-radius rule"
        echo ""
      fi
    fi

    # ── Stop the server if we started it ────────────────────────────────────
    if [ "$MODAL_SERVER_STARTED" = "true" ] && [ -n "$MODAL_SERVER_PID" ]; then
      kill "$MODAL_SERVER_PID" 2>/dev/null || true
      # Also kill any child processes (tsx → node chain)
      pkill -P "$MODAL_SERVER_PID" 2>/dev/null || true
    fi
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
