---
name: Runtime database identity
description: How to compare development and production databases when the platform inspector cannot resolve the deployed database.
---

This project uses an external Neon PostgreSQL database through the application's `DATABASE_URL`; it does not use Replit's managed database. When development and production database inspectors disagree with the running application, compare a read-only, one-way fingerprint generated from the active PostgreSQL connection in each runtime.

**Why:** Replit's database inspection surface is not authoritative for this project and may show no rows or a different database even while the application has a valid Neon connection.

**How to apply:** Use the application's configured Neon connection without displaying or logging `DATABASE_URL`. Use an authenticated, administrator-only temporary diagnostic when comparing environments; hash identity inputs and remove the diagnostic afterward.