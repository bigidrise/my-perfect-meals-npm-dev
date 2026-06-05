#!/usr/bin/env bash
# smoke-cooking.sh
# Regression smoke test for /api/cooking-challenges, /api/cooking-classes, /api/holiday-feast
#
# Usage:
#   bash scripts/smoke-cooking.sh                          # unauthenticated tests only
#   bash scripts/smoke-cooking.sh http://localhost:5000 <token>   # full test
#
# Unauthenticated tests verify that requireAuth inside each router
# correctly blocks access (401), not a 500 crash.

BASE="${1:-http://localhost:5000}"
TOKEN="${2:-}"
PASS=0
FAIL=0

green() { echo -e "\033[32m✅ $1\033[0m"; }
red()   { echo -e "\033[31m❌ $1\033[0m"; }

check() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [ "$actual" = "$expected" ]; then
    green "$label (got $actual)"
    ((PASS++))
  else
    red "$label (expected $expected, got $actual)"
    ((FAIL++))
  fi
}

AUTH_HEADER=""
if [ -n "$TOKEN" ]; then
  AUTH_HEADER="-H \"x-auth-token: $TOKEN\""
fi

echo ""
echo "=== Cooking Challenges ==="

# GET /current — unauthenticated must return 401, not 500
S=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/cooking-challenges/current")
check "GET /current — anon → 401" "401" "$S"

# GET /history — unauthenticated must return 401
S=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/cooking-challenges/history")
check "GET /history — anon → 401" "401" "$S"

# POST /current/submit — unauthenticated must return 401
S=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"photoUrl":"http://example.com/a.jpg","blurb":"test"}' \
  "$BASE/api/cooking-challenges/current/submit")
check "POST /current/submit — anon → 401" "401" "$S"

# POST /entries/:id/vote — unauthenticated must return 401
S=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{}' \
  "$BASE/api/cooking-challenges/entries/fake-entry-id/vote")
check "POST /entries/:id/vote — anon → 401" "401" "$S"

echo ""
echo "=== Cooking Classes ==="

# GET /tracks/beginner — unauthenticated must return 401
S=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/cooking-classes/tracks/beginner")
check "GET /tracks/beginner — anon → 401" "401" "$S"

# GET /class/:id — unauthenticated must return 401
S=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/cooking-classes/class/fake-id")
check "GET /class/:id — anon → 401" "401" "$S"

# GET /progress/:userId/:track — unauthenticated must return 401
S=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/cooking-classes/progress/fake-user/beginner")
check "GET /progress/:userId/:track — anon → 401" "401" "$S"

# POST /journal/submit — unauthenticated must return 401
S=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"userId":"fake","classId":"fake","photoUrl":"http://x.com","blurb":"hi"}' \
  "$BASE/api/cooking-classes/journal/submit")
check "POST /journal/submit — anon → 401" "401" "$S"

# POST /journal/:id/vote — unauthenticated must return 401
S=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"userId":"fake"}' \
  "$BASE/api/cooking-classes/journal/fake-entry-id/vote")
check "POST /journal/:id/vote — anon → 401" "401" "$S"

# GET /leaderboard/:track — unauthenticated must return 401
S=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/cooking-classes/leaderboard/beginner")
check "GET /leaderboard/beginner — anon → 401" "401" "$S"

echo ""
echo "=== Holiday Feast ==="

# POST /api/holiday-family-recipe — unauthenticated must return 401, not 500
# (This route is doubly-nested: the router handles /api/holiday-family-recipe internally)
S=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"name":"Grandma Pie","description":"2 cups flour 1 stick butter"}' \
  "$BASE/api/holiday-feast/api/holiday-family-recipe")
check "POST /api/holiday-family-recipe — anon → 401" "401" "$S"

echo ""
echo "=== Summary ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "RESULT: FAIL — fix the failures above before shipping."
  exit 1
else
  echo "RESULT: PASS"
  exit 0
fi
