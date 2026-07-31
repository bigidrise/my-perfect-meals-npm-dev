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
