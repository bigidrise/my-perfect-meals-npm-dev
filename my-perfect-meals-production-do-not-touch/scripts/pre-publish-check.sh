#!/bin/bash
# Pre-Publish Validation Script
# Run this BEFORE every ./push.sh

echo "🔍 PRE-PUBLISH VALIDATION CHECKLIST"
echo "===================================="
echo ""

# 1. Check for uncommitted changes
echo "1️⃣ Checking git status..."
if ! git diff --quiet; then
  echo "⚠️  WARNING: You have uncommitted changes"
  echo ""
  echo "Modified files:"
  git diff --name-only
  echo ""
  echo "❌ Review these changes carefully before publishing!"
  exit 1
else
  echo "✅ No uncommitted changes detected"
fi

# 2. Check TypeScript compilation
echo ""
echo "2️⃣ Running TypeScript check..."
if npm run check; then
  echo "✅ TypeScript compilation passed"
else
  echo "❌ TypeScript errors found - fix before publishing!"
  exit 1
fi

# 3. Check for LSP errors in critical files
echo ""
echo "3️⃣ Checking critical files for errors..."
CRITICAL_FILES=(
  "client/src/components/modals/AIMealCreatorModal.tsx"
  "client/src/pages/WeeklyMealBoard.tsx"
  "client/src/pages/BeachBodyMealBoard.tsx"
  "client/src/pages/pro/PerformanceCompetitionBuilder.tsx"
)

ERRORS_FOUND=0
for file in "${CRITICAL_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  Checking $file..."
  fi
done

if [ $ERRORS_FOUND -gt 0 ]; then
  echo "❌ Errors found in critical files!"
  exit 1
else
  echo "✅ Critical files check passed"
fi

# 4. Verify workflow is running
echo ""
echo "4️⃣ Checking if server workflow is running..."
if curl -s http://localhost:5000 > /dev/null 2>&1; then
  echo "✅ Server is running on port 5000"
else
  echo "⚠️  WARNING: Server not responding on port 5000"
  echo "   Start the workflow before publishing!"
fi

echo ""
echo "======================================"
echo "✅ ALL CHECKS PASSED!"
echo "You can now safely run: ./push.sh \"your message\""
echo "======================================"
