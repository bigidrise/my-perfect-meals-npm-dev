#!/bin/bash

# ===========================================
# APPLY PROMOTION PACKAGE (Run in PRODUCTION)
# ===========================================
# This script applies a promotion package from Staging.
#
# Usage: ./scripts/promote/apply_promotion_package.sh <package.zip>
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="$SCRIPT_DIR/backups/$(date +%Y%m%d_%H%M%S)"

if [ -z "$1" ]; then
    echo ""
    echo "Usage: ./scripts/promote/apply_promotion_package.sh <package.zip>"
    echo ""
    echo "Example:"
    echo "  ./scripts/promote/apply_promotion_package.sh promotion_package_20250110_143000.zip"
    echo ""
    exit 1
fi

PACKAGE="$1"

if [ ! -f "$SCRIPT_DIR/$PACKAGE" ] && [ ! -f "$PACKAGE" ]; then
    echo "Error: Package not found: $PACKAGE"
    echo "Make sure the zip file is in: $SCRIPT_DIR/"
    exit 1
fi

# Find the package
if [ -f "$SCRIPT_DIR/$PACKAGE" ]; then
    PACKAGE_PATH="$SCRIPT_DIR/$PACKAGE"
elif [ -f "$PACKAGE" ]; then
    PACKAGE_PATH="$PACKAGE"
fi

echo ""
echo "=========================================="
echo "  APPLY PROMOTION PACKAGE"
echo "=========================================="
echo ""
echo "Package: $PACKAGE_PATH"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"
echo "Backup directory: $BACKUP_DIR"
echo ""

# Extract package
echo "Extracting package..."
cd "$SCRIPT_DIR"
unzip -o "$PACKAGE_PATH" -d "$SCRIPT_DIR/temp_extract"

# Show manifest
echo ""
echo "Package contents:"
echo "----------------------------------------"
cat "$SCRIPT_DIR/temp_extract/promotion_payload/MANIFEST.txt"
echo "----------------------------------------"
echo ""

# Confirm before applying
echo "Do you want to apply these changes to Production? (yes/no)"
read -r CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    rm -rf "$SCRIPT_DIR/temp_extract"
    exit 0
fi

# Backup existing files and apply new ones
echo ""
echo "Applying changes..."

cd "$SCRIPT_DIR/temp_extract/promotion_payload"
find . -type f ! -name "MANIFEST.txt" ! -name ".flags" | while read -r file; do
    # Remove leading ./
    RELATIVE_PATH="${file#./}"
    SOURCE_FILE="$SCRIPT_DIR/temp_extract/promotion_payload/$RELATIVE_PATH"
    TARGET_FILE="$PROJECT_ROOT/$RELATIVE_PATH"
    
    # Backup existing file if it exists
    if [ -f "$TARGET_FILE" ]; then
        mkdir -p "$BACKUP_DIR/$(dirname "$RELATIVE_PATH")"
        cp "$TARGET_FILE" "$BACKUP_DIR/$RELATIVE_PATH"
        echo "  Backed up: $RELATIVE_PATH"
    fi
    
    # Copy new file
    mkdir -p "$(dirname "$TARGET_FILE")"
    cp "$SOURCE_FILE" "$TARGET_FILE"
    echo "  Applied: $RELATIVE_PATH"
done

# Check for dependency changes
if [ -f "$SCRIPT_DIR/temp_extract/promotion_payload/.flags" ]; then
    source "$SCRIPT_DIR/temp_extract/promotion_payload/.flags"
    if [ "$DEPENDENCIES_CHANGED" = "true" ]; then
        echo ""
        echo "Dependencies were changed. Running npm install..."
        cd "$PROJECT_ROOT"
        npm install
    fi
fi

# Cleanup
rm -rf "$SCRIPT_DIR/temp_extract"

echo ""
echo "=========================================="
echo "  CHANGES APPLIED SUCCESSFULLY"
echo "=========================================="
echo ""
echo "Backup saved to: $BACKUP_DIR"
echo ""
echo "Next steps:"
echo "  1. Run: npm run build"
echo "  2. Test the app locally"
echo "  3. If iOS: npx cap sync ios"
echo "  4. Redeploy Production"
echo ""
echo "To rollback, restore files from: $BACKUP_DIR"
echo ""
