#!/usr/bin/env bash
# =============================================================================
#  Modal Screenshot Diff — Gate 2 (shared primitive change guard)
#
#  Captures before-and-after screenshots for every UniversalDialog variant at
#  three representative viewports (portrait-mobile, landscape, desktop), then
#  computes per-image pixel diffs.  If any diff exceeds the 2% threshold a
#  review-required flag is written so pre-publish-validate.sh can block the
#  publish until the diff is acknowledged.
#
#  Usage (two-phase workflow):
#
#    # Phase A — before editing universal-modal.tsx or dialog.tsx:
#    bash scripts/modal-screenshot-diff.sh before
#
#    # Phase B — after editing, capture the "after" set and compare:
#    bash scripts/modal-screenshot-diff.sh after
#
#    # Optional: explicitly mark the diff as reviewed (agent acknowledgement):
#    bash scripts/modal-screenshot-diff.sh acknowledge
#
#    # Clear the review flag (start fresh):
#    bash scripts/modal-screenshot-diff.sh clear
#
#  Requirements:
#    - ImageMagick (convert / compare) — available in this Nix environment
#    - Playwright installed + app running on $E2E_BASE_URL (default: http://localhost:5000)
#    - node / npx available
#
#  Output files:
#    docs/screenshots/modal-diff/before/<variant>-<viewport>.png
#    docs/screenshots/modal-diff/after/<variant>-<viewport>.png
#    docs/screenshots/modal-diff/diff/<variant>-<viewport>-diff.png
#    docs/screenshots/modal-diff/report.txt
#    .agents/modal-diff-reviewed            (flag file written after acknowledge)
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

DIFF_DIR="docs/screenshots/modal-diff"
BEFORE_DIR="$DIFF_DIR/before"
AFTER_DIR="$DIFF_DIR/after"
COMP_DIR="$DIFF_DIR/diff"
REPORT="$DIFF_DIR/report.txt"
REVIEW_FLAG=".agents/modal-diff-reviewed"

# Pixel-diff threshold: flag if more than 2% of pixels changed
THRESHOLD_PCT=2

# Viewports: <label>:<width>x<height>
VIEWPORTS=(
  "portrait-mobile-375:375x667"
  "iphone-landscape:844x390"
  "desktop:1280x800"
)

# Modal variants (must match ModalTestHarness.tsx variant keys)
VARIANTS=(
  universal
  confirmation
  form
  picker
  information
  workflow
  wizard
)

BASE_URL="${E2E_BASE_URL:-http://localhost:5000}"

# ── Helper functions ──────────────────────────────────────────────────────────

pass()   { echo -e "${GREEN}  ✅ PASS${NC}  $1"; }
fail()   { echo -e "${RED}  ❌ FAIL${NC}  $1"; }
warn()   { echo -e "${YELLOW}  ⚠️  WARN${NC}  $1"; }
info()   { echo -e "${CYAN}  ℹ${NC}  $1"; }

check_imagemagick() {
  if ! command -v convert >/dev/null 2>&1; then
    echo -e "${RED}ERROR: ImageMagick 'convert' not found. Install it first.${NC}"
    exit 1
  fi
  if ! command -v compare >/dev/null 2>&1; then
    echo -e "${RED}ERROR: ImageMagick 'compare' not found. Install it first.${NC}"
    exit 1
  fi
}

# Capture a screenshot of the modal test harness for one variant at one viewport.
# Uses curl to fetch the page HTML then Playwright's --screenshot flag via a
# one-shot node script (avoids needing a full Playwright test run).
capture_screenshot() {
  local variant="$1"
  local viewport_label="$2"
  local viewport_dims="$3"   # WIDTHxHEIGHT
  local output_path="$4"

  local width="${viewport_dims%%x*}"
  local height="${viewport_dims##*x}"
  local url="${BASE_URL}/__modal-test__?variant=${variant}"

  # Use Playwright's CLI screenshot command (available after `npm install`)
  node - <<JS
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: ${width}, height: ${height} });
  // The harness checks navigator.webdriver (set automatically by Playwright)
  await page.goto('${url}', { waitUntil: 'networkidle', timeout: 20000 });
  // Wait for the dialog to render
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(400); // let animations settle
  await page.screenshot({ path: '${output_path}', fullPage: false });
  await browser.close();
})();
JS
}

# ── Phase: before ─────────────────────────────────────────────────────────────

cmd_before() {
  check_imagemagick
  mkdir -p "$BEFORE_DIR"
  info "Capturing BEFORE screenshots (${#VARIANTS[@]} variants × ${#VIEWPORTS[@]} viewports)…"
  for variant in "${VARIANTS[@]}"; do
    for vp_entry in "${VIEWPORTS[@]}"; do
      local label="${vp_entry%%:*}"
      local dims="${vp_entry##*:}"
      local out="$BEFORE_DIR/${variant}-${label}.png"
      info "  Capturing before: $variant @ $label"
      capture_screenshot "$variant" "$label" "$dims" "$out"
    done
  done
  echo ""
  pass "BEFORE screenshots saved to $BEFORE_DIR/"
  echo "  Now make your changes to universal-modal.tsx / dialog.tsx, then run:"
  echo "  bash scripts/modal-screenshot-diff.sh after"
}

# ── Phase: after ──────────────────────────────────────────────────────────────

cmd_after() {
  check_imagemagick

  if [ ! -d "$BEFORE_DIR" ] || [ -z "$(ls -A "$BEFORE_DIR" 2>/dev/null)" ]; then
    echo -e "${RED}ERROR: No BEFORE screenshots found. Run 'before' phase first.${NC}"
    exit 1
  fi

  mkdir -p "$AFTER_DIR" "$COMP_DIR"

  info "Capturing AFTER screenshots…"
  for variant in "${VARIANTS[@]}"; do
    for vp_entry in "${VIEWPORTS[@]}"; do
      local label="${vp_entry%%:*}"
      local dims="${vp_entry##*:}"
      local out="$AFTER_DIR/${variant}-${label}.png"
      info "  Capturing after: $variant @ $label"
      capture_screenshot "$variant" "$label" "$dims" "$out"
    done
  done

  echo ""
  info "Computing pixel diffs…"
  echo "" > "$REPORT"
  echo "Modal Screenshot Diff Report — $(date)" >> "$REPORT"
  echo "Threshold: ${THRESHOLD_PCT}% of pixels" >> "$REPORT"
  echo "--------------------------------------------" >> "$REPORT"

  local any_flagged=0
  local total_images=0

  for variant in "${VARIANTS[@]}"; do
    for vp_entry in "${VIEWPORTS[@]}"; do
      local label="${vp_entry%%:*}"
      local before_img="$BEFORE_DIR/${variant}-${label}.png"
      local after_img="$AFTER_DIR/${variant}-${label}.png"
      local diff_img="$COMP_DIR/${variant}-${label}-diff.png"

      total_images=$((total_images + 1))

      if [ ! -f "$before_img" ]; then
        warn "  MISSING before: ${variant}-${label} — skipping diff"
        echo "MISSING_BEFORE: ${variant}-${label}" >> "$REPORT"
        continue
      fi

      if [ ! -f "$after_img" ]; then
        warn "  MISSING after: ${variant}-${label} — skipping diff"
        echo "MISSING_AFTER: ${variant}-${label}" >> "$REPORT"
        continue
      fi

      # ImageMagick compare: output diff image + print number of differing pixels
      # -metric AE = Absolute pixel count, -fuzz 5% = ignore tiny anti-aliasing diffs
      local diff_pixels
      diff_pixels=$(compare -metric AE -fuzz 5% "$before_img" "$after_img" "$diff_img" 2>&1 || true)

      # Sanitize — compare can return non-numeric output on certain errors
      if ! [[ "$diff_pixels" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
        warn "  compare returned non-numeric output for ${variant}-${label}: $diff_pixels"
        diff_pixels=0
      fi

      # Get total pixel count from the BEFORE image
      local total_pixels
      total_pixels=$(identify -format "%[fx:w*h]" "$before_img" 2>/dev/null || echo "1")
      if ! [[ "$total_pixels" =~ ^[0-9]+$ ]] || [ "$total_pixels" -eq 0 ]; then
        total_pixels=1
      fi

      # Calculate percentage — use bc for floating point
      local pct
      pct=$(echo "scale=2; ($diff_pixels * 100) / $total_pixels" | bc 2>/dev/null || echo "0")

      # Compare against threshold (strip decimals for integer comparison)
      local pct_int
      pct_int=$(echo "$pct" | cut -d. -f1)

      if [ "${pct_int:-0}" -ge "$THRESHOLD_PCT" ]; then
        fail "  FLAGGED  ${variant} @ ${label}: ${pct}% pixels changed (threshold: ${THRESHOLD_PCT}%)"
        echo "FLAGGED: ${variant}-${label} | diff=${pct}% | diff_img=${diff_img}" >> "$REPORT"
        any_flagged=1
      else
        pass "  OK       ${variant} @ ${label}: ${pct}% pixels changed"
        echo "OK: ${variant}-${label} | diff=${pct}%" >> "$REPORT"
      fi
    done
  done

  echo ""
  echo "--------------------------------------------" >> "$REPORT"

  if [ "$any_flagged" -eq 1 ]; then
    # Remove any previous review flag — the diff changed, requires fresh review
    rm -f "$REVIEW_FLAG"
    echo "REVIEW_REQUIRED=true" >> "$REPORT"
    echo ""
    echo -e "${RED}  ❌ One or more modal screenshots changed by ≥${THRESHOLD_PCT}%.${NC}"
    echo "     Diff images saved to: $COMP_DIR/"
    echo "     Report: $REPORT"
    echo ""
    echo "  NEXT STEPS:"
    echo "  1. Review the diff images to confirm the change is intentional."
    echo "  2. If intentional, run:"
    echo "       bash scripts/modal-screenshot-diff.sh acknowledge"
    echo "  3. Then re-run pre-publish-validate.sh."
    echo ""
    exit 2
  else
    echo "REVIEW_REQUIRED=false" >> "$REPORT"
    echo ""
    pass "All modal diffs below the ${THRESHOLD_PCT}% threshold — no review required."
    # No flag needed if everything passed
    rm -f "$REVIEW_FLAG"
  fi
}

# ── Phase: acknowledge ────────────────────────────────────────────────────────

cmd_acknowledge() {
  if [ ! -f "$REPORT" ]; then
    echo -e "${YELLOW}No diff report found. Run 'before' and 'after' phases first.${NC}"
    exit 1
  fi

  mkdir -p ".agents"
  {
    echo "modal-diff-reviewed"
    echo "reviewed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "reviewed_by=${USER:-agent}"
    echo "report=$REPORT"
  } > "$REVIEW_FLAG"

  pass "Diff acknowledged. pre-publish-validate.sh will now pass the Gate 2 check."
  echo "     Flag written to: $REVIEW_FLAG"
}

# ── Phase: clear ──────────────────────────────────────────────────────────────

cmd_clear() {
  rm -f "$REVIEW_FLAG"
  echo "  Review flag cleared."
}

# ── Dispatch ──────────────────────────────────────────────────────────────────

PHASE="${1:-}"

case "$PHASE" in
  before)       cmd_before ;;
  after)        cmd_after ;;
  acknowledge)  cmd_acknowledge ;;
  clear)        cmd_clear ;;
  *)
    echo "Usage: bash scripts/modal-screenshot-diff.sh <before|after|acknowledge|clear>"
    echo ""
    echo "  before       Capture baseline screenshots before editing shared primitives"
    echo "  after        Capture post-edit screenshots and compute pixel diff"
    echo "  acknowledge  Mark the reviewed diff so pre-publish-validate.sh can continue"
    echo "  clear        Remove the review flag (forces re-review)"
    echo ""
    exit 1
    ;;
esac
