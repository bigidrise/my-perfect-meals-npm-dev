#!/bin/bash
# 🔒 Meal Picker Structure Verification Script
# Enforces that AIMealCreatorModal.tsx and MealPremadePicker.tsx remain structurally unchanged
# See LOCKDOWN.md for complete meal picker protection protocol

set -e

LOCK_FILE="scripts/checksums/meal_pickers.lock"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}🔒 Meal Picker Structure Verification${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo ""

# Check if lock file exists
if [ ! -f "$LOCK_FILE" ]; then
  echo -e "${RED}❌ Lock file not found: $LOCK_FILE${NC}"
  echo "Run ./scripts/generate-meal-picker-checksums.sh to create it"
  exit 1
fi

echo "📋 Checking protected meal picker files..."
echo ""

CHANGES_DETECTED=0
FILES_CHECKED=0

# Read lock file and verify each file
while IFS= read -r line; do
  # Skip comments and empty lines
  [[ "$line" =~ ^#.*$ ]] && continue
  [[ -z "$line" ]] && continue
  
  EXPECTED_HASH=$(echo "$line" | awk '{print $1}')
  FILE_PATH=$(echo "$line" | awk '{print $2}')
  
  if [ -f "$FILE_PATH" ]; then
    CURRENT_HASH=$(sha256sum "$FILE_PATH" | awk '{print $1}')
    FILES_CHECKED=$((FILES_CHECKED + 1))
    
    if [ "$EXPECTED_HASH" != "$CURRENT_HASH" ]; then
      echo -e "${RED}⚠️  STRUCTURE CHANGED: $FILE_PATH${NC}"
      echo -e "${YELLOW}   Expected: $EXPECTED_HASH${NC}"
      echo -e "${YELLOW}   Current:  $CURRENT_HASH${NC}"
      echo ""
      CHANGES_DETECTED=1
    else
      echo -e "${GREEN}✅ PROTECTED: $FILE_PATH${NC}"
    fi
  else
    echo -e "${RED}❌ MISSING: $FILE_PATH${NC}"
    CHANGES_DETECTED=1
  fi
done < "$LOCK_FILE"

echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"

if [ $CHANGES_DETECTED -eq 0 ]; then
  echo -e "${GREEN}✅ All meal picker structures are intact! ($FILES_CHECKED files verified)${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}⚠️  LOCKDOWN VIOLATION DETECTED!${NC}"
  echo ""
  echo -e "${YELLOW}Meal picker structure has been modified!${NC}"
  echo ""
  echo "Review changes: git diff"
  echo ""
  echo -e "${YELLOW}REMINDER: Only DATA changes are allowed (ingredients/meals).${NC}"
  echo -e "${YELLOW}UI structure changes require architect approval and hash regeneration.${NC}"
  echo ""
  exit 1
fi
