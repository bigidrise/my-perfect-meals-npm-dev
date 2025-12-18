#!/bin/bash
# Verify that critical files haven't been modified or truncated

FREEZE_FILE=".critical-files-checksums"
LINE_COUNTS_FILE=".critical-files-linecounts"

# Minimum line counts for key generator files (to detect truncation)
declare -A MIN_LINES
MIN_LINES["server/services/stableMealGenerator.ts"]=900
MIN_LINES["server/services/universalMealGenerator.ts"]=150
MIN_LINES["server/services/fridgeRescueGenerator.ts"]=200
MIN_LINES["server/services/unifiedMealPipeline.ts"]=100

echo "🔍 Verifying critical files..."
echo ""

CHANGES_DETECTED=0

# Check line counts for truncation detection
echo "📏 Checking for truncation (minimum line counts)..."
for file in "${!MIN_LINES[@]}"; do
  if [ -f "$file" ]; then
    CURRENT_LINES=$(wc -l < "$file")
    MIN="${MIN_LINES[$file]}"
    if [ "$CURRENT_LINES" -lt "$MIN" ]; then
      echo "❌ TRUNCATED: $file has $CURRENT_LINES lines (minimum: $MIN)"
      CHANGES_DETECTED=1
    else
      echo "✅ OK: $file ($CURRENT_LINES lines, min: $MIN)"
    fi
  else
    echo "❌ MISSING: $file"
    CHANGES_DETECTED=1
  fi
done

echo ""

# Check checksums if available
if [ -f "$FREEZE_FILE" ]; then
  echo "🔐 Checking checksums..."
  while IFS= read -r line; do
    EXPECTED_HASH=$(echo "$line" | awk '{print $1}')
    FILE_PATH=$(echo "$line" | awk '{print $2}')
    
    if [ -f "$FILE_PATH" ]; then
      CURRENT_HASH=$(md5sum "$FILE_PATH" | awk '{print $1}')
      
      if [ "$EXPECTED_HASH" != "$CURRENT_HASH" ]; then
        echo "⚠️  CHANGED: $FILE_PATH"
        CHANGES_DETECTED=1
      else
        echo "✅ OK: $FILE_PATH"
      fi
    else
      echo "❌ MISSING: $FILE_PATH"
      CHANGES_DETECTED=1
    fi
  done < "$FREEZE_FILE"
else
  echo "⚠️  No checksums found. Run ./scripts/freeze-critical-files.sh to create them."
fi

echo ""
if [ $CHANGES_DETECTED -eq 0 ]; then
  echo "✅ All critical files verified!"
else
  echo ""
  echo "⚠️  WARNING: Critical file issues detected!"
  echo ""
  echo "If files are truncated, restore from:"
  echo "  my-perfect-meals-production-do-not-touch/server/services/"
  echo ""
  echo "Example:"
  echo "  cp my-perfect-meals-production-do-not-touch/server/services/stableMealGenerator.ts server/services/"
fi

exit $CHANGES_DETECTED
