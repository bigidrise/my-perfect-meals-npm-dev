#!/bin/bash
set -e

npm install --prefer-offline --no-audit --no-fund --ignore-scripts
npx patch-package || true
