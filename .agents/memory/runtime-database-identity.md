---
name: Runtime database identity
description: How to compare development and production databases when the platform inspector cannot resolve the deployed database.
---

When development and production database inspectors disagree with the running application, compare a read-only, one-way fingerprint generated from the active PostgreSQL connection in each runtime.

**Why:** The deployment may have a valid database connection that is not visible through the workspace's production database inspection surface, so inspector results alone cannot establish whether environments share a database.

**How to apply:** Use an authenticated, administrator-only temporary diagnostic that hashes database/server identity inputs without returning hosts, credentials, user data, or connection strings; remove it after comparison.