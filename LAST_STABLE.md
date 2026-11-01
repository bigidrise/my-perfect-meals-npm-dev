# Last Known-Good Production Deploy

Update this file manually after every successful production deploy.
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

If production breaks after a `git pull`, run this in the **production shell**:

```bash
# 1. Check current state
git --no-optional-locks log --oneline -5

# 2. Hard reset to the last known-good commit (copy hash from above)
git reset --hard 6028c458

# 3. Restart the production server
# (however your production server is managed — restart the workflow or process)
```

> ⚠️ `git reset --hard` discards any uncommitted changes. Only run this in the production space, never in dev.

---

## How to Update This File After a Successful Deploy

After you confirm production is healthy:

1. Open this file
2. Replace the commit hash with the new one (get it from `git log --oneline -1` in the production shell)
3. Update the date and deploy notes
4. Commit and push the update: `git add LAST_STABLE.md && git commit -m "update LAST_STABLE to <hash>" && git push`

---

## Deploy History

| Date | Commit | Notes |
|---|---|---|
| 2026-05-23 | `6028c458` | Image drift fix + enterprise readiness docs (role matrix, security runbook, vendor/BAA map) |
| 2026-05-22 | `d4b9c26a` | Role permission matrix + security runbook |
| 2026-05-22 | `3d6b296e` | Vendor/BAA mapping document |
