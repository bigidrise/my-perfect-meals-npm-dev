#!/bin/bash

# ===========================================
# BUILD PROMOTION PACKAGE (Run in STAGING)
# ===========================================
# This script identifies all changed files and packages them
# into a single zip file for transfer to Production.
#
# Usage: ./scripts/promote/build_promotion_package.sh
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAST_PROMO_FILE="$SCRIPT_DIR/.last_promotion"
PAYLOAD_DIR="$SCRIPT_DIR/promotion_payload"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_NAME="promotion_package_$TIMESTAMP"

echo ""
echo "=========================================="
echo "  BUILD PROMOTION PACKAGE"
echo "=========================================="
echo ""

# Check if we have a baseline commit
if [ -f "$LAST_PROMO_FILE" ]; then
    BASELINE=$(cat "$LAST_PROMO_FILE")
    echo "Last promotion was at commit: $BASELINE"
else
    echo "No previous promotion found."
    echo ""
    echo "Enter the number of commits to include (e.g., 1 for last commit, 5 for last 5 commits):"
    read -r COMMIT_COUNT
    BASELINE="HEAD~$COMMIT_COUNT"
    echo "Using baseline: $BASELINE"
fi

echo ""
echo "Identifying changed files..."
echo ""

# Get list of changed files
CHANGED_FILES=$(git diff --name-only "$BASELINE" HEAD 2>/dev/null || git diff --name-only HEAD~1 HEAD)

if [ -z "$CHANGED_FILES" ]; then
    echo "No files changed since last promotion."
    exit 0
fi

echo "Files changed:"
echo "----------------------------------------"
echo "$CHANGED_FILES"
echo "----------------------------------------"
echo ""

# Count files
FILE_COUNT=$(echo "$CHANGED_FILES" | wc -l | tr -d ' ')
echo "Total files to package: $FILE_COUNT"
echo ""

# Clean up old payload
rm -rf "$PAYLOAD_DIR"
mkdir -p "$PAYLOAD_DIR"

# Create manifest
MANIFEST_FILE="$PAYLOAD_DIR/MANIFEST.txt"
echo "Promotion Package Manifest" > "$MANIFEST_FILE"
echo "Created: $(date)" >> "$MANIFEST_FILE"
echo "From commit: $(git rev-parse HEAD)" >> "$MANIFEST_FILE"
echo "Baseline: $BASELINE" >> "$MANIFEST_FILE"
echo "" >> "$MANIFEST_FILE"
echo "Files included:" >> "$MANIFEST_FILE"
echo "----------------------------------------" >> "$MANIFEST_FILE"

# Copy each changed file
echo "Packaging files..."
while IFS= read -r file; do
    if [ -f "$file" ]; then
        # Create directory structure
        mkdir -p "$PAYLOAD_DIR/$(dirname "$file")"
        # Copy file
        cp "$file" "$PAYLOAD_DIR/$file"
        echo "  + $file" >> "$MANIFEST_FILE"
        echo "  Copied: $file"
    else
        echo "  - $file (DELETED)" >> "$MANIFEST_FILE"
        echo "  Skipped (deleted): $file"
    fi
done <<< "$CHANGED_FILES"

echo "" >> "$MANIFEST_FILE"
echo "----------------------------------------" >> "$MANIFEST_FILE"
echo "Total files: $FILE_COUNT" >> "$MANIFEST_FILE"

# Check for package.json changes
if echo "$CHANGED_FILES" | grep -q "package.json\|package-lock.json"; then
    echo ""
    echo "DEPENDENCIES_CHANGED=true" > "$PAYLOAD_DIR/.flags"
    echo "NOTE: package.json was modified - run 'npm install' in Production"
fi

# Create zip
echo ""
echo "Creating zip package..."
cd "$SCRIPT_DIR"
zip -r "$PACKAGE_NAME.zip" promotion_payload/

# Create checksum
sha256sum "$PACKAGE_NAME.zip" > "$PACKAGE_NAME.sha256"

# Save current commit as new baseline
git rev-parse HEAD > "$LAST_PROMO_FILE"

echo ""
echo "=========================================="
echo "  PACKAGE CREATED SUCCESSFULLY"
echo "=========================================="
echo ""
echo "Package location:"
echo "  $SCRIPT_DIR/$PACKAGE_NAME.zip"
echo ""
echo "Next steps:"
echo "  1. Download: $PACKAGE_NAME.zip"
echo "  2. Upload to Production Repl (scripts/promote/ folder)"
echo "  3. In Production, run:"
echo "     ./scripts/promote/apply_promotion_package.sh $PACKAGE_NAME.zip"
echo ""
