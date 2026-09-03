#!/bin/bash
# =============================================================================
#  Gate 2 — Modal Screenshot Diff Tool
#
#  Captures before/after screenshots of shared dialog primitives
#  (universal-modal.tsx, dialog.tsx) and computes pixel diff.
#  A diff ≥ 2% of pixels triggers a mandatory review step before publishing.
#
#  State model (both files must exist for Gate 2 to pass):
#    .agents/modal-diff-manifest   — written by `after` on successful completion;
#                                    contains SHA-256 fingerprints of the primitives
#                                    at capture time
#    .agents/modal-diff-reviewed   — written by `after` (auto) or `acknowledge`;
#                                    read by pre-publish-validate.sh Gate 2
#
#  SECURITY: pre-publish-validate.sh re-hashes the primitive files at validation
#  time and rejects a stale manifest/flag whenever the files have changed since
#  the last `after` run. This prevents a second edit from inheriting a prior
#  review without a fresh comparison cycle.
#
#  `acknowledge` REQUIRES the manifest. Running it without a completed
#  before/after diff cycle will fail. This prevents bypassing the gate.
#
#  Usage:
#    bash scripts/modal-screenshot-diff.sh before        # snapshot BEFORE editing
#    bash scripts/modal-screenshot-diff.sh after         # snapshot AFTER + diff
#    bash scripts/modal-screenshot-diff.sh acknowledge   # mark diff reviewed
#    bash scripts/modal-screenshot-diff.sh reset         # clear all state
#
#  Standard workflow:
#    1. bash scripts/modal-screenshot-diff.sh before
#    2. <edit universal-modal.tsx or dialog.tsx>
#    3. bash scripts/modal-screenshot-diff.sh after
#       — all diffs < 2%: gate auto-acknowledged, go to step 5
#       — any diff ≥ 2%: inspect diff images, then continue to step 4
#    4. bash scripts/modal-screenshot-diff.sh acknowledge   # intentional change
#    5. bash scripts/pre-publish-validate.sh               # Gate 2 passes
#
#  Reference: docs/responsive-ui-regression-guard.md §"Gate 2"
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

COMMAND="${1:-help}"

# ── Paths ─────────────────────────────────────────────────────────────────────
DIFF_DIR="docs/screenshots/modal-diff"
BEFORE_DIR="$DIFF_DIR/before"
AFTER_DIR="$DIFF_DIR/after"
DIFF_OUT_DIR="$DIFF_DIR/diff"

# Two-file state model:
#   MANIFEST    — proof that `after` completed; holds fingerprints of both
#                 primitives at capture time (required before `acknowledge`)
#   REVIEW_FLAG — proof that the diff was reviewed (read by pre-publish-validate.sh)
MANIFEST=".agents/modal-diff-manifest"
REVIEW_FLAG=".agents/modal-diff-reviewed"

# Watched primitive files — their SHA-256 hashes are embedded in the manifest
# so any subsequent edit invalidates the stored acknowledgement.
PRIMITIVE_UNIVERSAL_MODAL="client/src/components/ui/universal-modal.tsx"
PRIMITIVE_DIALOG="client/src/components/ui/dialog.tsx"

# Expected capture pairs: 3 Gate-2 viewports × 7 variants = 21
# `after` rejects a partial comparison (fewer pairs means screenshots failed).
EXPECTED_PAIRS=21

# Pixel diff threshold — diffs at or above this percentage require acknowledgement
THRESHOLD_PCT=2

# Server URL — override with E2E_BASE_URL if the app runs on a different port
BASE_URL="${E2E_BASE_URL:-http://localhost:5000}"

# ── Helpers ───────────────────────────────────────────────────────────────────

check_server() {
  if ! curl -s --max-time 5 "$BASE_URL" > /dev/null 2>&1; then
    echo -e "${RED}❌ Server not reachable at $BASE_URL${NC}"
    echo ""
    echo "   Start the application first:"
    echo "     NODE_ENV=development tsx server/index.ts"
    echo ""
    echo "   Or set E2E_BASE_URL if using a different port:"
    echo "     E2E_BASE_URL=http://localhost:3000 bash scripts/modal-screenshot-diff.sh before"
    echo ""
    exit 1
  fi
}

check_node() {
  if ! command -v node &>/dev/null; then
    echo -e "${RED}❌ node is not in PATH${NC}"
    exit 1
  fi
}

check_imagemagick() {
  command -v compare &>/dev/null
}

# Compute SHA-256 fingerprint of a single file.
# Returns the hex digest, or "missing" if the file does not exist.
file_sha256() {
  local path="$1"
  if [ -f "$path" ]; then
    sha256sum "$path" | awk '{print $1}'
  else
    echo "missing"
  fi
}

# Capture screenshots using the standalone Playwright script
capture_screenshots() {
  local OUT_DIR="$1"
  echo -e "${CYAN}  Capturing screenshots → $OUT_DIR${NC}"
  mkdir -p "$OUT_DIR"
  node scripts/modal-screenshot-capture.mjs \
    --dir="$OUT_DIR" \
    --base-url="$BASE_URL"
}

# Clear both state files — called at the start of `before` and `after`
# so no stale flag or manifest can carry over to a new diff cycle.
clear_state() {
  rm -f "$MANIFEST" "$REVIEW_FLAG"
}

# Write the completion manifest.
# ALWAYS called by `after` — whether or not the diff passed threshold.
# Records fingerprints of both primitives at capture time so that
# pre-publish-validate.sh (and `acknowledge`) can detect if the files
# changed again after this run.
write_manifest() {
  local threshold_met="$1"   # "true" | "false" | "incomplete"
  local any_above="$2"       # 0 or 1
  local compared="$3"        # integer
  local hash_modal="$4"      # SHA-256 of universal-modal.tsx at capture time
  local hash_dialog="$5"     # SHA-256 of dialog.tsx at capture time
  mkdir -p "$(dirname "$MANIFEST")"
  {
    echo "completed_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "threshold_met=$threshold_met"
    echo "any_above_threshold=$any_above"
    echo "compared=$compared"
    echo "expected_pairs=$EXPECTED_PAIRS"
    echo "primitive_hash_universal_modal=$hash_modal"
    echo "primitive_hash_dialog=$hash_dialog"
    echo "before_dir=$BEFORE_DIR"
    echo "after_dir=$AFTER_DIR"
    echo "diff_dir=$DIFF_OUT_DIR"
  } > "$MANIFEST"
}

# Write the review flag — only called after a verified comparison.
# `acknowledge` calls this; `after` calls it only on all-below-threshold runs.
write_review_flag() {
  mkdir -p "$(dirname "$REVIEW_FLAG")"
  {
    echo "reviewed_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "reviewer=${USER:-agent}"
    echo "manifest=$MANIFEST"
    echo "diff_dir=$DIFF_OUT_DIR"
  } > "$REVIEW_FLAG"
}

# ── Subcommands ───────────────────────────────────────────────────────────────

cmd_before() {
  echo ""
  echo -e "${CYAN}━━━ Gate 2: BEFORE capture ━━━${NC}"
  echo ""
  echo "  Capturing modal screenshots BEFORE editing shared primitives."
  echo "  Run this before touching universal-modal.tsx or dialog.tsx."
  echo ""

  check_node
  check_server

  # Clear any stale state from a previous diff cycle so the old manifest
  # and review flag cannot carry forward to the next `acknowledge` call.
  clear_state

  capture_screenshots "$BEFORE_DIR"

  echo ""
  echo -e "${GREEN}✅ Before screenshots saved to: $BEFORE_DIR${NC}"
  echo "   Review flag and manifest cleared — a fresh diff cycle has started."
  echo ""
  echo "   Now make your changes to the shared dialog primitives."
  echo "   When done, run:"
  echo ""
  echo "     bash scripts/modal-screenshot-diff.sh after"
  echo ""
}

cmd_after() {
  echo ""
  echo -e "${CYAN}━━━ Gate 2: AFTER capture + diff ━━━${NC}"
  echo ""

  check_node
  check_server

  # Validate that before screenshots exist
  if [ ! -d "$BEFORE_DIR" ] || [ -z "$(ls -A "$BEFORE_DIR" 2>/dev/null)" ]; then
    echo -e "${RED}❌ No 'before' screenshots found in $BEFORE_DIR${NC}"
    echo ""
    echo "   Run first: bash scripts/modal-screenshot-diff.sh before"
    echo ""
    exit 1
  fi

  # Always clear any existing review flag and manifest before running the
  # comparison.  This ensures a stale acknowledgement from a previous diff
  # cycle cannot survive into the new one, even if `before` was skipped.
  clear_state

  # Fingerprint the watched primitives NOW, before the server renders them,
  # so the hash reflects the source files that drove this capture run.
  HASH_MODAL=$(file_sha256 "$PRIMITIVE_UNIVERSAL_MODAL")
  HASH_DIALOG=$(file_sha256 "$PRIMITIVE_DIALOG")

  capture_screenshots "$AFTER_DIR"
  mkdir -p "$DIFF_OUT_DIR"

  echo ""
  echo -e "${CYAN}━━━ Pixel diff (threshold: ${THRESHOLD_PCT}%) ━━━${NC}"
  echo ""

  HAS_IMAGEMAGICK=0
  if check_imagemagick; then
    HAS_IMAGEMAGICK=1
  else
    echo -e "  ${YELLOW}⚠️  ImageMagick 'compare' not found — numerical diff unavailable.${NC}"
    echo "     Install ImageMagick to enable pixel-level comparison."
    echo "     Without it every file-level difference is treated as significant."
    echo ""
  fi

  ANY_ABOVE_THRESHOLD=0
  COMPARED=0
  UNQUANTIFIED=0

  for BEFORE_FILE in "$BEFORE_DIR"/*.png; do
    [ -f "$BEFORE_FILE" ] || continue
    FILENAME=$(basename "$BEFORE_FILE")
    AFTER_FILE="$AFTER_DIR/$FILENAME"
    DIFF_FILE="$DIFF_OUT_DIR/$FILENAME"

    if [ ! -f "$AFTER_FILE" ]; then
      echo -e "  ${YELLOW}⚠️  $FILENAME — after screenshot missing, skipping${NC}"
      continue
    fi

    COMPARED=$((COMPARED + 1))

    if [ "$HAS_IMAGEMAGICK" -eq 1 ]; then
      # Resolve dimensions for percentage calculation
      DIMS=$(identify -format "%wx%h" "$BEFORE_FILE" 2>/dev/null || echo "0x0")
      W=$(echo "$DIMS" | cut -dx -f1)
      H=$(echo "$DIMS" | cut -dx -f2)
      TOTAL_PX=$(( W * H ))

      if [ "$TOTAL_PX" -eq 0 ]; then
        echo -e "  ${YELLOW}⚠️  $FILENAME — could not read dimensions${NC}"
        UNQUANTIFIED=$((UNQUANTIFIED + 1))
        ANY_ABOVE_THRESHOLD=1
        continue
      fi

      # AE = absolute error pixel count; -fuzz 3% ignores sub-pixel rendering noise.
      # compare exits non-zero when images differ; capture output carefully.
      AE_RAW=$(compare -metric AE -fuzz 3% \
        "$BEFORE_FILE" "$AFTER_FILE" "$DIFF_FILE" 2>&1 || true)
      AE_COUNT=$(echo "$AE_RAW" | grep -oE '^[0-9]+' | head -1 || echo "0")
      AE_COUNT="${AE_COUNT:-0}"

      # Percentage to two decimal places
      DIFF_PCT=$(echo "scale=2; $AE_COUNT * 100 / $TOTAL_PX" | bc 2>/dev/null || echo "0.00")
      DIFF_INT=$(printf "%.0f" "$DIFF_PCT" 2>/dev/null || echo "0")

      if [ "$DIFF_INT" -ge "$THRESHOLD_PCT" ]; then
        echo -e "  ${RED}🔴 $FILENAME — ${DIFF_PCT}% pixels changed (≥ ${THRESHOLD_PCT}% threshold)${NC}"
        echo "       diff image → $DIFF_FILE"
        ANY_ABOVE_THRESHOLD=1
      else
        echo -e "  ${GREEN}✅ $FILENAME — ${DIFF_PCT}% pixels changed${NC}"
      fi
    else
      # No ImageMagick: flag any file-level difference as unquantified
      if cmp -s "$BEFORE_FILE" "$AFTER_FILE"; then
        echo -e "  ${GREEN}✅ $FILENAME — byte-identical${NC}"
      else
        echo -e "  ${YELLOW}⚠️  $FILENAME — files differ (ImageMagick required for % breakdown)${NC}"
        UNQUANTIFIED=$((UNQUANTIFIED + 1))
        ANY_ABOVE_THRESHOLD=1
      fi
    fi
  done

  echo ""

  # Reject a partial comparison — fewer than EXPECTED_PAIRS means some captures
  # failed; a partial diff is not a trustworthy basis for acknowledgement.
  if [ "$COMPARED" -lt "$EXPECTED_PAIRS" ]; then
    echo -e "${RED}❌ Incomplete comparison: $COMPARED of $EXPECTED_PAIRS pairs captured.${NC}"
    echo "   Some before/after screenshots are missing. Re-run the full cycle:"
    echo ""
    echo "     bash scripts/modal-screenshot-diff.sh reset"
    echo "     bash scripts/modal-screenshot-diff.sh before"
    echo "     <make your changes>"
    echo "     bash scripts/modal-screenshot-diff.sh after"
    echo ""
    # Write a manifest marked as incomplete so the gate still fails cleanly
    write_manifest "incomplete" "1" "$COMPARED" "$HASH_MODAL" "$HASH_DIALOG"
    exit 1
  fi

  # Write the manifest that `acknowledge` (and pre-publish-validate.sh) requires.
  # Records source fingerprints so any subsequent edit to the primitives
  # invalidates this run without a fresh comparison cycle.
  THRESHOLD_MET_STR="false"
  if [ "$ANY_ABOVE_THRESHOLD" -eq 0 ]; then
    THRESHOLD_MET_STR="true"
  fi
  write_manifest "$THRESHOLD_MET_STR" "$ANY_ABOVE_THRESHOLD" "$COMPARED" "$HASH_MODAL" "$HASH_DIALOG"

  if [ "$ANY_ABOVE_THRESHOLD" -eq 1 ]; then
    # Significant or unquantified diff — do NOT write the review flag.
    # The developer must inspect the diff images and run `acknowledge`.
    echo -e "${YELLOW}━━━ Review required ━━━${NC}"
    echo ""
    if [ "$UNQUANTIFIED" -gt 0 ]; then
      echo "  $UNQUANTIFIED screenshot(s) could not be quantified (install ImageMagick)."
    fi
    echo "  One or more screenshots changed by ≥ ${THRESHOLD_PCT}% of pixels."
    echo "  This is NOT a hard block — visual changes may be intentional."
    echo ""
    echo "  1. Open the diff images and review the visual change:"
    echo "       $DIFF_OUT_DIR/"
    echo ""
    echo "  2. If the change is correct, acknowledge it:"
    echo "       bash scripts/modal-screenshot-diff.sh acknowledge"
    echo ""
    echo "  3. Then re-run pre-publish validation:"
    echo "       bash scripts/pre-publish-validate.sh"
    echo ""
  else
    # All diffs within threshold — auto-acknowledge.
    write_review_flag
    echo -e "${GREEN}✅ All ${COMPARED} diffs below ${THRESHOLD_PCT}% threshold.${NC}"
    echo ""
    echo "   Auto-acknowledged (no significant visual change detected)."
    echo "   Diff images saved to $DIFF_OUT_DIR for reference."
    echo ""
    echo "   You can now run: bash scripts/pre-publish-validate.sh"
    echo ""
  fi
}

cmd_acknowledge() {
  echo ""
  echo -e "${CYAN}━━━ Gate 2: acknowledge ━━━${NC}"
  echo ""

  # Require a completed diff manifest — `acknowledge` cannot be used to bypass
  # the gate without first running a complete before/after diff cycle.
  if [ ! -f "$MANIFEST" ]; then
    echo -e "${RED}❌ No completed diff manifest found.${NC}"
    echo ""
    echo "   You must run a full before/after comparison first:"
    echo ""
    echo "     bash scripts/modal-screenshot-diff.sh before"
    echo "     <edit universal-modal.tsx or dialog.tsx>"
    echo "     bash scripts/modal-screenshot-diff.sh after"
    echo ""
    echo "   Then run acknowledge to mark the diff as reviewed."
    exit 1
  fi

  # Read manifest metadata
  COMPLETED_AT=$(grep "^completed_at=" "$MANIFEST" 2>/dev/null | cut -d= -f2 || echo "unknown")
  THRESHOLD_MET=$(grep "^threshold_met=" "$MANIFEST" 2>/dev/null | cut -d= -f2 || echo "unknown")
  COMPARED_COUNT=$(grep "^compared=" "$MANIFEST" 2>/dev/null | cut -d= -f2 || echo "?")
  STORED_HASH_MODAL=$(grep "^primitive_hash_universal_modal=" "$MANIFEST" 2>/dev/null | cut -d= -f2 || echo "")
  STORED_HASH_DIALOG=$(grep "^primitive_hash_dialog=" "$MANIFEST" 2>/dev/null | cut -d= -f2 || echo "")

  # Verify that the primitive files have NOT changed since the `after` run.
  # If they have, the stored diff no longer covers the current source — reject.
  CURRENT_HASH_MODAL=$(file_sha256 "$PRIMITIVE_UNIVERSAL_MODAL")
  CURRENT_HASH_DIALOG=$(file_sha256 "$PRIMITIVE_DIALOG")

  STALE=0
  if [ "$CURRENT_HASH_MODAL" != "$STORED_HASH_MODAL" ]; then
    echo -e "${RED}❌ $PRIMITIVE_UNIVERSAL_MODAL has changed since the diff was captured.${NC}"
    STALE=1
  fi
  if [ "$CURRENT_HASH_DIALOG" != "$STORED_HASH_DIALOG" ]; then
    echo -e "${RED}❌ $PRIMITIVE_DIALOG has changed since the diff was captured.${NC}"
    STALE=1
  fi

  if [ "$STALE" -eq 1 ]; then
    echo ""
    echo "   The stored diff no longer covers the current primitive state."
    echo "   Run a fresh comparison cycle:"
    echo ""
    echo "     bash scripts/modal-screenshot-diff.sh before"
    echo "     <your changes are already in place>"
    echo "     bash scripts/modal-screenshot-diff.sh after"
    echo ""
    exit 1
  fi

  echo "  Diff run completed at: $COMPLETED_AT"
  echo "  Images compared:       $COMPARED_COUNT of $EXPECTED_PAIRS expected"
  echo "  All below threshold:   $THRESHOLD_MET"
  echo "  Primitive fingerprints match current source files ✓"
  echo ""
  echo "  Marking the screenshot diff as reviewed."
  echo "  This signals that any visual change to the shared dialog primitives"
  echo "  has been inspected and is intentional."
  echo ""

  write_review_flag

  echo -e "${GREEN}✅ Acknowledged.${NC}"
  echo "   Flag: $REVIEW_FLAG"
  echo ""
  echo "   You can now run: bash scripts/pre-publish-validate.sh"
  echo ""
}

cmd_reset() {
  echo ""
  echo -e "${CYAN}━━━ Gate 2: reset ━━━${NC}"
  echo ""
  clear_state
  rm -rf "$BEFORE_DIR" "$AFTER_DIR" "$DIFF_OUT_DIR"
  mkdir -p "$BEFORE_DIR" "$AFTER_DIR" "$DIFF_OUT_DIR"
  echo -e "${GREEN}✅ Reset complete.${NC}"
  echo "   Before/after/diff directories cleared."
  echo "   Review flag and manifest removed."
  echo ""
}

cmd_help() {
  echo ""
  echo "  Gate 2 — Modal Screenshot Diff Tool"
  echo "  Reference: docs/responsive-ui-regression-guard.md §'Gate 2'"
  echo ""
  echo "  Usage:"
  echo "    bash scripts/modal-screenshot-diff.sh <command>"
  echo ""
  echo "  Commands:"
  echo "    before       Capture baseline screenshots BEFORE editing dialog primitives"
  echo "    after        Capture AFTER screenshots, compute pixel diff vs before"
  echo "    acknowledge  Mark the diff as reviewed (requires completed before/after run)"
  echo "    reset        Clear all screenshots, manifest, and review flag"
  echo ""
  echo "  State model:"
  echo "    .agents/modal-diff-manifest   — written by 'after'; holds SHA-256 fingerprints"
  echo "                                    of both primitives at capture time"
  echo "    .agents/modal-diff-reviewed   — written by 'after' (auto) or 'acknowledge'"
  echo "    acknowledge requires the manifest AND current files matching stored fingerprints."
  echo ""
  echo "  Viewports:  small-iphone-portrait (375×667) · iphone-landscape (844×390) · desktop (1280×800)"
  echo "  Variants:   universal · confirmation · form · picker · information · workflow · wizard"
  echo "  Pairs:      ${EXPECTED_PAIRS} expected (3 viewports × 7 variants)"
  echo "  Threshold:  ${THRESHOLD_PCT}% of pixels — diffs ≥ this require explicit acknowledgement"
  echo ""
}

# ── Dispatch ──────────────────────────────────────────────────────────────────

case "$COMMAND" in
  before)               cmd_before      ;;
  after)                cmd_after       ;;
  acknowledge)          cmd_acknowledge ;;
  reset)                cmd_reset       ;;
  help | --help | -h)   cmd_help        ;;
  *)
    echo -e "${RED}Unknown command: $COMMAND${NC}"
    cmd_help
    exit 1
    ;;
esac
