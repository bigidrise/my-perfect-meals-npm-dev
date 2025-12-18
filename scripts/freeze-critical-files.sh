#!/bin/bash
# Create checksums of critical files to detect unwanted changes

FREEZE_FILE=".critical-files-checksums"
LINE_COUNTS_FILE=".critical-files-linecounts"

echo "🔒 Creating checksums of critical files..."

# List of files that should NEVER change unless you explicitly edit them
CRITICAL_FILES=(
  "server/services/stableMealGenerator.ts"
  "server/services/universalMealGenerator.ts"
  "server/services/fridgeRescueGenerator.ts"
  "server/services/unifiedMealPipeline.ts"
  "client/src/components/modals/AIMealCreatorModal.tsx"
  "client/src/components/PreparationModal.tsx"
  "client/src/components/pickers/MealPremadePicker.tsx"
  "client/src/pages/WeeklyMealBoard.tsx"
  "client/src/pages/BeachBodyMealBoard.tsx"
  "client/src/pages/pro/PerformanceCompetitionBuilder.tsx"
  "client/src/pages/Planner.tsx"
  "server/routes/manualMacros.ts"
)

# Create checksums and line counts
> "$FREEZE_FILE"
> "$LINE_COUNTS_FILE"

for file in "${CRITICAL_FILES[@]}"; do
  if [ -f "$file" ]; then
    md5sum "$file" >> "$FREEZE_FILE"
    LINES=$(wc -l < "$file")
    echo "$LINES $file" >> "$LINE_COUNTS_FILE"
    echo "  ✅ $file ($LINES lines)"
  else
    echo "  ⚠️  Missing: $file"
  fi
done

echo ""
echo "✅ Checksums saved to $FREEZE_FILE"
echo "✅ Line counts saved to $LINE_COUNTS_FILE"
echo ""
echo "To verify files haven't changed, run:"
echo "  ./scripts/verify-critical-files.sh"
