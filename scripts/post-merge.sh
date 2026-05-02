#!/bin/bash
set -e

echo "[post-merge] Installing dependencies..."
npm install --include=dev --prefer-offline --no-audit --no-fund

echo "[post-merge] Building client and server..."
npm run build

echo "[post-merge] Done."
