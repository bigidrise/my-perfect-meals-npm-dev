#!/bin/bash
# ============================================================================
#  Provision the migration-manifest.json storage canary in the production bucket.
#
#  Run this once when setting up a new production bucket, and again after any
#  bucket rotation. The upload is idempotent — safe to re-run at any time.
#
#  This object is required by:
#    - scripts/run-prod-acceptance.sh  Gate 5 (HTTP canary)
#    - scripts/pre-publish-validate.sh Section 5 (storage reachability)
#
#  Must be run in the production workspace where DEFAULT_OBJECT_STORAGE_BUCKET_ID
#  is set to the production bucket.
#
#  Usage:
#    bash scripts/provision-storage-canary.sh
# ============================================================================

set -euo pipefail

DEV_BUCKET="replit-objstore-2a68d585-4c50-4c2e-a7ff-a9973358bc5b"

if [ -z "${DEFAULT_OBJECT_STORAGE_BUCKET_ID:-}" ]; then
  echo "❌ DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set."
  echo "   Run this script in the production workspace where the secret is configured."
  exit 1
fi

if [ "$DEFAULT_OBJECT_STORAGE_BUCKET_ID" = "$DEV_BUCKET" ]; then
  echo "❌ DEFAULT_OBJECT_STORAGE_BUCKET_ID is the DEV bucket."
  echo "   This script must only be run in the production workspace."
  exit 1
fi

echo "Running canary provisioning script..."
npx tsx scripts/provision-storage-canary.ts
