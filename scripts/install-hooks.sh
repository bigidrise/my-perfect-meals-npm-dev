#!/bin/bash
# MPM Git Hook Installer
# Run once after cloning to wire up the pre-push validation hook.
#
# Usage: bash scripts/install-hooks.sh

set -e

HOOK_DIR=".git/hooks"
HOOK_FILE="$HOOK_DIR/pre-push"

if [ ! -d "$HOOK_DIR" ]; then
  echo "❌  .git/hooks directory not found. Run this from the repo root."
  exit 1
fi

cat > "$HOOK_FILE" <<'EOF'
#!/bin/bash
# MPM pre-push hook — runs validate.sh before every push.
# Bypass in emergencies: git push --no-verify
bash scripts/validate.sh
EOF

chmod +x "$HOOK_FILE"

echo "✅  Pre-push hook installed at $HOOK_FILE"
echo "    'npm run validate' will now run automatically on every git push."
echo ""
echo "    To bypass in an emergency: git push --no-verify"
