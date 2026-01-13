#!/bin/bash
# My Perfect Meals - Pre-Deployment Preflight Check
# Run this script before every deployment to catch issues early
#
# Usage: ./scripts/preflight.sh [deployed-url]
# Example: ./scripts/preflight.sh https://my-perfect-meals.replit.app

set -e

echo "=========================================="
echo "🛫 MPM Pre-Deployment Preflight Check"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

DEPLOYED_URL=${1:-"http://localhost:5000"}
PASSED=0
FAILED=0

check_pass() {
    echo -e "${GREEN}✅ PASS:${NC} $1"
    ((PASSED++))
}

check_fail() {
    echo -e "${RED}❌ FAIL:${NC} $1"
    ((FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠️  WARN:${NC} $1"
}

# Step 1: Build check
echo ""
echo "📦 Step 1: Building application..."
if npm run build > /dev/null 2>&1; then
    check_pass "Build completed successfully"
else
    check_fail "Build failed"
    exit 1
fi

# Step 2: Health endpoint check
echo ""
echo "🏥 Step 2: Checking health endpoint..."
HEALTH_RESPONSE=$(curl -s "${DEPLOYED_URL}/api/health" 2>/dev/null || echo '{}')

if echo "$HEALTH_RESPONSE" | grep -q '"ok":true'; then
    check_pass "Health endpoint responding"
else
    check_fail "Health endpoint not responding at ${DEPLOYED_URL}/api/health"
fi

# Check OpenAI connection
if echo "$HEALTH_RESPONSE" | grep -q '"hasOpenAI":true'; then
    check_pass "OpenAI API key configured"
else
    check_fail "OpenAI NOT configured - meals will use fallbacks!"
fi

# Check OpenAI key length
KEY_LENGTH=$(echo "$HEALTH_RESPONSE" | grep -o '"openAIKeyLength":[0-9]*' | grep -o '[0-9]*' || echo "0")
if [ "$KEY_LENGTH" -gt 0 ]; then
    check_pass "OpenAI key length: ${KEY_LENGTH}"
else
    check_fail "OpenAI key length is 0"
fi

# Check S3 configuration
if echo "$HEALTH_RESPONSE" | grep -q '"hasS3":true'; then
    check_pass "S3 image storage configured"
else
    check_warn "S3 not configured - images may not persist"
fi

# Check fallback usage
FALLBACKS=$(echo "$HEALTH_RESPONSE" | grep -o '"fallbacksUsed":[0-9]*' | grep -o '[0-9]*' || echo "0")
if [ "$FALLBACKS" -eq 0 ]; then
    check_pass "No fallback meals used this session"
else
    check_warn "Fallback meals used: ${FALLBACKS} (may indicate previous AI failures)"
fi

# Summary
echo ""
echo "=========================================="
echo "📊 PREFLIGHT SUMMARY"
echo "=========================================="
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL CHECKS PASSED - Safe to deploy!${NC}"
    exit 0
else
    echo -e "${RED}🚫 PREFLIGHT FAILED - Fix issues before deploying${NC}"
    exit 1
fi
