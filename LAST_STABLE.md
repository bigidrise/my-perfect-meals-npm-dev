# Last Known-Good Production Deploy

Update this file manually only after live Production acceptance passes.
It is your rollback anchor — the first thing to check when production breaks.

---

## Current Stable Commit

| Field | Value |
|---|---|
| **Commit hash** | `6028c458` |
| **Date deployed** | 2026-05-23 |
| **What was in this deploy** | Image drift fix (prevent ephemeral OpenAI URLs from persisting), admin image cache repair endpoint |
| **Deployed by** | Dev → GitHub merge → git pull in production |

---

## How to Roll Back Production

If production breaks after an update, follow `ROLLBACK.md`. Start with
read-only inspection in the **Production workspace**:

```bash
git status --short --branch
git --no-optional-locks log --oneline -5
```

Preserve uncommitted work and obtain approval before restoring code or
checkpoints. A workflow restart or Git push does not update the published app.
Do not restore the shared database as part of a code rollback.

---

## How to Update This File After a Successful Deploy

Only after `bash scripts/run-prod-acceptance.sh --sha <published-commit-sha>`
passes on the customer-facing Production app and warnings are reviewed:

1. Open this file
2. Replace the commit hash with the actual published SHA verified by acceptance, not an unverified local HEAD or a later documentation-only commit
3. Update the date and deploy notes
4. In the Production workspace, confirm the branch is `production`, then review and commit only `LAST_STABLE.md` and push explicitly to `origin production`. Do not push this record to `main` or update the stable entry before live verification.

---

## Deploy History

| Date | Commit | Notes |
|---|---|---|
| 2026-05-23 | `6028c458` | Image drift fix + enterprise readiness docs (role matrix, security runbook, vendor/BAA map) |
| 2026-05-22 | `d4b9c26a` | Role permission matrix + security runbook |
| 2026-05-22 | `3d6b296e` | Vendor/BAA mapping document |
