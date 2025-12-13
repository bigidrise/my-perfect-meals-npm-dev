#!/bin/bash
# 🔐 Meal Picker Checksum Generator
# Regenerates canonical checksums for protected meal picker files
# 
# ⚠️  IMPORTANT: Only run this after architect-approved structure changes!
# See LOCKDOWN.md for approval workflow

set -e

LOCK_FILE="scripts/checksums/meal_pickers.lock"

# Colors
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${YELLOW}⚠️  Meal Picker Checksum Regeneration${NC}"
echo -e "${YELLOW}═══════════════════════════════════════${NC}"
echo ""
echo -e "${RED}WARNING: This updates the canonical structure checksums!${NC}"
echo ""
echo -e "${YELLOW}Only proceed if:${NC}"
echo -e "${YELLOW}1. Architect has reviewed and approved structural changes${NC}"
echo -e "${YELLOW}2. You have explicit permission to update the lock file${NC}"
echo ""
read -p "Have you received architect approval? (yes/no): " APPROVAL

if [ "$APPROVAL" != "yes" ]; then
  echo ""
  echo -e "${RED}❌ Checksum regeneration cancelled${NC}"
  echo "Changes must be reviewed by architect before updating lock file"
  echo ""
  exit 1
fi

echo ""
echo -e "${BLUE}📝 Generating new checksums...${NC}"
echo ""

# Protected files
FILES=(
  "client/src/components/modals/AIMealCreatorModal.tsx"
  "client/src/components/pickers/MealPremadePicker.tsx"
)

# Backup old lock file
if [ -f "$LOCK_FILE" ]; then
  cp "$LOCK_FILE" "${LOCK_FILE}.backup"
  echo -e "${GREEN}✅ Backed up old lock file to ${LOCK_FILE}.backup${NC}"
fi

# Generate new lock file
cat > "$LOCK_FILE" << 'EOF'
# Meal Picker Structure Lock File
# Generated: $(date "+%B %d, %Y at %H:%M:%S")
# 
# These are the canonical SHA256 checksums for locked meal picker components.
# ANY changes to these files MUST be approved by architect and require hash regeneration.
# 
# PROTECTED FILES (Structure LOCKED - NO modifications allowed):
# - AIMealCreatorModal.tsx: The AI meal creation modal
# - MealPremadePicker.tsx: The premade meal selection picker
#
# ALLOWED CHANGES:
# - Data files (snackIngredients.ts, diabeticPremadeSnacks.ts, etc.) are NOT in this lock
# - Data additions/changes are permitted without hash updates
#
# PROHIBITED CHANGES:
# - UI structure modifications
# - Adding new sections/banners/inputs
# - Changing modal layout
# - Modifying grid rendering logic
#
# To regenerate hashes (requires architect approval):
# ./scripts/generate-meal-picker-checksums.sh

EOF

# Generate checksums
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    HASH=$(sha256sum "$file" | awk '{print $1}')
    echo "$HASH  $file" >> "$LOCK_FILE"
    echo -e "${GREEN}✅ $file${NC}"
    echo "   Hash: $HASH"
  else
    echo -e "${RED}❌ File not found: $file${NC}"
    exit 1
  fi
done

echo ""
echo -e "${GREEN}✅ Lock file updated: $LOCK_FILE${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Verify the changes: ./scripts/verify-meal-pickers.sh"
echo "2. Commit the updated lock file: git add $LOCK_FILE"
echo "3. Document the approved changes in LOCKDOWN.md"
echo ""
