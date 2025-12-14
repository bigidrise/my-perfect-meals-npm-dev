#!/bin/bash
# Verify that critical files haven't been modified unexpectedly

FREEZE_FILE=".critical-files-checksums"

if [ ! -f "$FREEZE_FILE" ]; then
  echo "❌ No checksums found. Run ./scripts/freeze-critical-files.sh first"
  exit 1
fi

echo "🔍 Verifying critical files..."
echo ""

CHANGES_DETECTED=0

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

echo ""
if [ $CHANGES_DETECTED -eq 0 ]; then
  echo "✅ All critical files unchanged!"
else
  echo "⚠️  WARNING: Critical files have been modified!"
  echo "Review changes with: git diff"
fi

exit $CHANGES_DETECTED
