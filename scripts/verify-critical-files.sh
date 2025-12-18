#!/bin/bash
# Verify that critical files haven't been modified or truncated unexpectedly

FREEZE_FILE=".critical-files-checksums"
LINE_COUNTS_FILE=".critical-files-linecounts"

if [ ! -f "$FREEZE_FILE" ]; then
  echo "❌ No checksums found. Run ./scripts/freeze-critical-files.sh first"
  exit 1
fi

echo "🔍 Verifying critical files..."
echo ""

CHANGES_DETECTED=0

# Minimum line counts for critical generators (truncation protection)
declare -A MIN_LINES
MIN_LINES["server/services/stableMealGenerator.ts"]=900
MIN_LINES["server/services/universalMealGenerator.ts"]=150
MIN_LINES["server/services/unifiedMealPipeline.ts"]=100
MIN_LINES["server/services/fridgeRescueGenerator.ts"]=200

while IFS= read -r line; do
  EXPECTED_HASH=$(echo "$line" | awk '{print $1}')
  FILE_PATH=$(echo "$line" | awk '{print $2}')
  
  if [ -f "$FILE_PATH" ]; then
    CURRENT_HASH=$(md5sum "$FILE_PATH" | awk '{print $1}')
    CURRENT_LINES=$(wc -l < "$FILE_PATH")
    
    # Check for truncation first (more critical)
    if [ -n "${MIN_LINES[$FILE_PATH]}" ]; then
      MIN_EXPECTED="${MIN_LINES[$FILE_PATH]}"
      if [ "$CURRENT_LINES" -lt "$MIN_EXPECTED" ]; then
        echo "🚨 TRUNCATED: $FILE_PATH (only $CURRENT_LINES lines, expected $MIN_EXPECTED+)"
        CHANGES_DETECTED=1
        continue
      fi
    fi
    
    if [ "$EXPECTED_HASH" != "$CURRENT_HASH" ]; then
      echo "⚠️  CHANGED: $FILE_PATH ($CURRENT_LINES lines)"
      CHANGES_DETECTED=1
    else
      echo "✅ OK: $FILE_PATH ($CURRENT_LINES lines)"
    fi
  else
    echo "❌ MISSING: $FILE_PATH"
    CHANGES_DETECTED=1
  fi
done < "$FREEZE_FILE"

echo ""
if [ $CHANGES_DETECTED -eq 0 ]; then
  echo "✅ All critical files intact and unchanged!"
else
  echo ""
  echo "⚠️  WARNING: Critical files have issues!"
  echo ""
  echo "If TRUNCATED: File was corrupted - restore from production or git history"
  echo "If CHANGED: Review with 'git diff' - update checksums if intentional"
  echo ""
  echo "To update checksums after intentional changes:"
  echo "  ./scripts/freeze-critical-files.sh"
fi

exit $CHANGES_DETECTED
