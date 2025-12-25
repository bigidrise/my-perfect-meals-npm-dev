#!/bin/bash
# Create checksums of critical files to detect unwanted changes

FREEZE_FILE=".critical-files-checksums"

echo "🔒 Creating checksums of critical files..."

# List of files that should NEVER change unless you explicitly edit them
CRITICAL_FILES=(
  # Client pages
  "client/src/components/modals/AIMealCreatorModal.tsx"
  "client/src/components/PreparationModal.tsx"
  "client/src/components/pickers/MealPremadePicker.tsx"
  "client/src/pages/WeeklyMealBoard.tsx"
  "client/src/pages/BeachBodyMealBoard.tsx"
  "client/src/pages/pro/PerformanceCompetitionBuilder.tsx"
  "client/src/pages/Planner.tsx"
  # Server routes
  "server/routes/manualMacros.ts"
  # CRITICAL GENERATORS - These contain complex logic that must not be truncated
  "server/services/stableMealGenerator.ts"
  "server/services/universalMealGenerator.ts"
  "server/services/unifiedMealPipeline.ts"
  "server/services/fridgeRescueGenerator.ts"
)

# Minimum expected line counts for critical generators (to catch truncation)
declare -A MIN_LINES
MIN_LINES["server/services/stableMealGenerator.ts"]=900
MIN_LINES["server/services/universalMealGenerator.ts"]=150
MIN_LINES["server/services/unifiedMealPipeline.ts"]=100
MIN_LINES["server/services/fridgeRescueGenerator.ts"]=200

# Create checksums
> "$FREEZE_FILE"
for file in "${CRITICAL_FILES[@]}"; do
  if [ -f "$file" ]; then
    md5sum "$file" >> "$FREEZE_FILE"
  fi
done

echo "✅ Checksums saved to $FREEZE_FILE"
echo ""
echo "To verify files haven't changed, run:"
echo "  ./scripts/verify-critical-files.sh"
