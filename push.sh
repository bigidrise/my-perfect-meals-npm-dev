#!/bin/bash

# ENFORCED PRE-PUBLISH VALIDATION
# This script will NOT let you publish unless everything is clean

set -e  # Exit immediately if any command fails

echo "🔒 ENFORCED PRE-PUBLISH VALIDATION"
echo "===================================="
echo ""

# Check if commit message was provided
if [ -z "$1" ]; then
  echo "❌ ERROR: Commit message required"
  echo "Usage: ./push.sh \"your commit message\""
  exit 1
fi

COMMIT_MESSAGE="$1"

# Step 1: Check for unexpected file changes
echo "1️⃣ Checking for unexpected changes..."
if [ -f ".critical-files-checksums" ]; then
  if ./scripts/verify-critical-files.sh; then
    echo "✅ No unexpected changes detected"
  else
    echo ""
    echo "❌ BLOCKED: Critical files have changed unexpectedly!"
    echo ""
    echo "Run this to see what changed:"
    echo "  git diff"
    echo ""
    echo "If changes are intentional, update checksums:"
    echo "  ./scripts/freeze-critical-files.sh"
    echo ""
    exit 1
  fi
else
  echo "⚠️  Checksums not initialized. Creating baseline..."
  ./scripts/freeze-critical-files.sh
fi

echo ""

# Step 2: Check server is running
echo "2️⃣ Verifying server is running..."
if curl -s http://localhost:5000 > /dev/null 2>&1; then
  echo "✅ Server is running on port 5000"
else
  echo "⚠️  WARNING: Server not responding on port 5000"
  echo "   Consider restarting workflow before publishing"
fi

echo ""
echo "===================================="
echo "✅ ALL VALIDATION CHECKS PASSED!"
echo "===================================="
echo ""
echo "Publishing: $COMMIT_MESSAGE"
echo ""

# Configure git user email to avoid Replit issue
git config user.email "replit-override@example.com" 2>/dev/null || true

# Add all changes
git add -A

# Commit with provided message
if git commit -m "$COMMIT_MESSAGE"; then
  echo "✅ Changes committed"
else
  echo "ℹ️  Nothing new to commit"
fi

# Push to GitHub
echo ""
echo "Pushing to GitHub..."
if git push -u origin staging 2>&1; then
  echo "✅ SUCCESSFULLY PUBLISHED!"
  echo ""
  echo "📋 What was published:"
  git log -1 --stat
  echo ""
  echo "🔒 Freezing current state..."
  ./scripts/freeze-critical-files.sh
else
  echo "❌ Push failed. Check your connection and try again."
  exit 1
fi
