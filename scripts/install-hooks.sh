#!/bin/bash
# Installs Git hooks for this repository.
# Called automatically via the postinstall npm script.

HOOKS_DIR=".git/hooks"

if [ ! -d "$HOOKS_DIR" ]; then
  echo "  [hooks] .git/hooks not found — skipping hook installation (not a git repo or hooks dir missing)"
  exit 0
fi

cat > "$HOOKS_DIR/pre-push" << 'EOF'
#!/bin/bash
# MPM pre-push hook — installed by scripts/install-hooks.sh
# Runs npm run validate before every push. Aborts the push on failure.

echo ""
echo "🔍 Running MPM pre-push validation..."
echo ""

npm run validate
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo ""
  echo "❌  Push aborted: validation failed."
  echo "    Fix the issues above, then push again."
  echo ""
  exit 1
fi

exit 0
EOF

chmod +x "$HOOKS_DIR/pre-push"
echo "  [hooks] pre-push hook installed ✅"

cat > "$HOOKS_DIR/pre-commit" << 'EOF'
#!/bin/bash
# MPM pre-commit hook — installed by scripts/install-hooks.sh
# Guards groceryCoach.ts against recurring task-agent merge damage.
# Checks run only when groceryCoach.ts is part of the staged changes.
#
# Design:
#   - esbuild: runs against the staged blob extracted to a temp file.
#   - tsc:     creates an isolated git worktree from HEAD, applies the COMPLETE
#              cached diff (all staged files, not just groceryCoach.ts) so tsc
#              sees the exact state of the incoming commit.  node_modules is
#              symlinked; --incremental false prevents writes to the shared cache.
#              The real working tree is NEVER mutated.
#   - Both checks fail closed if the underlying tool cannot execute.
#   - mktemp syntax is compatible with both GNU/Linux and macOS.

GROCERY_COACH="server/routes/groceryCoach.ts"
REPO_ROOT="$(git rev-parse --show-toplevel)"

# Only run when groceryCoach.ts is among the staged files.
if ! git diff --cached --name-only | grep -qF "$GROCERY_COACH"; then
  exit 0
fi

echo ""
echo "🔍 [pre-commit] Checking staged $GROCERY_COACH for merge damage..."

# ── Shared state & cleanup ────────────────────────────────────────────────────
STAGED_TMP=""
WORKTREE_DIR=""

cleanup() {
  [ -f "$STAGED_TMP" ]   && rm -f "$STAGED_TMP"
  [ -n "$WORKTREE_DIR" ] && git worktree remove --force "$WORKTREE_DIR" 2>/dev/null
  [ -d "$WORKTREE_DIR" ] && rm -rf "$WORKTREE_DIR"
}
trap cleanup EXIT

# ── Extract staged blob ───────────────────────────────────────────────────────
# Create a suffix-free temp file (portable: BSD mktemp requires X-run to end
# the name), then rename to add .ts so esbuild can infer the loader from the
# extension without needing --loader=ts (which only applies to stdin on esbuild).
STAGED_TMP_BASE=$(mktemp)
STAGED_TMP="${STAGED_TMP_BASE}.ts"
mv "$STAGED_TMP_BASE" "$STAGED_TMP"
if ! git show ":$GROCERY_COACH" > "$STAGED_TMP" 2>&1; then
  echo "❌ [pre-commit] Could not extract staged blob for $GROCERY_COACH — aborting."
  exit 1
fi

# ── esbuild parse check (staged blob, no working-tree access) ─────────────────
ESBUILD_OUTPUT=$(npx esbuild "$STAGED_TMP" \
  --platform=node --packages=external --bundle=false --format=esm 2>&1)
ESBUILD_EXIT=$?

ESBUILD_ERRORS=$(printf '%s' "$ESBUILD_OUTPUT" | grep -E "^\s*✘" || true)
if [ -n "$ESBUILD_ERRORS" ]; then
  echo ""
  echo "❌ [pre-commit] Staged $GROCERY_COACH has build errors — likely task-agent merge damage:"
  echo "$ESBUILD_ERRORS"
  echo ""
  echo "   Fix the errors above, then stage the file again and retry the commit."
  echo ""
  exit 1
fi
# Fail closed: non-zero exit with no ✘ lines means esbuild itself couldn't run.
if [ "$ESBUILD_EXIT" -ne 0 ]; then
  echo ""
  echo "❌ [pre-commit] esbuild invocation failed (exit $ESBUILD_EXIT):"
  printf '%s\n' "$ESBUILD_OUTPUT" | head -20
  echo ""
  echo "   Ensure esbuild is installed (npx esbuild --version) and retry."
  echo ""
  exit 1
fi

# ── TypeScript check — isolated worktree with COMPLETE staged state ───────────
# Step 1: create a detached worktree at HEAD (all tracked files, clean baseline).
WORKTREE_DIR=$(mktemp -d /tmp/gcwt_XXXXXX)
if ! git worktree add --detach "$WORKTREE_DIR" HEAD 2>/dev/null; then
  echo "❌ [pre-commit] Could not create git worktree for TypeScript check — aborting."
  exit 1
fi

# Step 2: apply the COMPLETE cached diff so every staged file is reflected,
# not just groceryCoach.ts.  This gives tsc the exact commit snapshot.
# --binary: encodes binary hunks in base64 so git apply can handle image/font
# files staged alongside groceryCoach.ts without failing.
if ! git diff --cached --binary | git -C "$WORKTREE_DIR" apply --allow-empty 2>/dev/null; then
  echo "❌ [pre-commit] Could not apply staged diff to worktree — aborting."
  exit 1
fi

# Step 3: symlink node_modules from the main repo (avoids reinstallation).
if ! ln -s "$REPO_ROOT/node_modules" "$WORKTREE_DIR/node_modules" 2>/dev/null; then
  echo "❌ [pre-commit] Could not link node_modules into worktree — aborting."
  exit 1
fi

# Step 4: run tsc against the complete staged state.
# The project has zero tsc errors at HEAD, so any nonzero exit here is caused
# by the staged changes — whether the error is in groceryCoach.ts itself or
# in any importer (e.g. routes.ts, pregnancyCoach.ts, etc.).
# --incremental false: prevents writes to the shared node_modules tsBuildInfoFile.
TSC_OUTPUT=$(cd "$WORKTREE_DIR" && node_modules/.bin/tsc --noEmit --incremental false --project tsconfig.server.json 2>&1)
TSC_EXIT=$?

if [ "$TSC_EXIT" -ne 0 ]; then
  # Distinguish type errors (tsc ran and found problems) from an invocation
  # failure (tsc could not execute → zero "error TS" diagnostics emitted).
  ALL_TSC_DIAGS=$(printf '%s' "$TSC_OUTPUT" | grep "error TS" || true)
  if [ -z "$ALL_TSC_DIAGS" ]; then
    echo ""
    echo "❌ [pre-commit] tsc invocation failed (exit $TSC_EXIT, zero diagnostics emitted):"
    printf '%s\n' "$TSC_OUTPUT" | head -20
    echo ""
    echo "   Ensure TypeScript is installed and tsconfig.server.json is valid, then retry."
    echo ""
    exit 1
  fi
  echo ""
  echo "❌ [pre-commit] Staged changes introduce TypeScript errors — likely task-agent merge damage:"
  printf '%s\n' "$TSC_OUTPUT" | grep "error TS" | head -20
  echo ""
  echo "   Fix the errors above, then stage the file again and retry the commit."
  echo ""
  exit 1
fi

echo "✅ [pre-commit] Staged $GROCERY_COACH integrity check passed."
echo ""
EOF

chmod +x "$HOOKS_DIR/pre-commit"
echo "  [hooks] pre-commit hook installed ✅"
