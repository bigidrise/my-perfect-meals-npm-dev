# MPM Production Rollback Playbook

> **Use this file the moment a publish goes wrong. Do not improvise.**  
> Every step is here. Follow them in order.

---

## When to use this playbook

Use this playbook when any of the following occur after a Replit Publish:

- `scripts/pre-publish-validate.sh` passed but the live site is broken after publishing
- `GET /api/health` returns an error or wrong environment
- Critical user-facing features (meal generation, auth, images, payments) are failing in production
- A monitoring alert fires within the first 30 minutes of a release
- You manually confirmed production is serving wrong or broken behavior

---

## Step 1 — Detect and confirm the failure

Before rolling back, confirm the failure is real and in production (not a fluke or a local test environment issue).

```bash
# Check the live health endpoint
curl -s https://app.myperfectmeals.com/api/health

# If /api/release exists, confirm which SHA is live
curl -s https://app.myperfectmeals.com/api/release | jq .
```

**Confirm:**
- The failure is reproducible (not a single transient error)
- The failure is on `app.myperfectmeals.com` (not dev workspace)
- The failure affects a P0 surface (auth, meal generation, images, or payments)

If confirmed: proceed to Step 2 immediately.

---

## Step 2 — Post a status note

Before touching anything, post a brief status note so the team is not left guessing.

**Post in your team channel / ops log:**

```
[INCIDENT] Production rollback in progress.
Time: <timestamp>
Reason: <one sentence — what is broken>
Action: Reverting to last known-good checkpoint.
ETA: ~5–10 minutes.
```

This takes 30 seconds and prevents duplicate actions by multiple people.

---

## Step 3 — Identify the last known-good checkpoint

The last known-good commit hash is recorded in `LAST_STABLE.md` at the repo root.

```bash
cat LAST_STABLE.md
```

This gives you the commit hash (e.g. `a83f5d2`) that was confirmed healthy before the failed publish.

**If `LAST_STABLE.md` is missing or unclear:**  
In the Replit production workspace, open **Checkpoints** (the history icon in the left sidebar). Look for the checkpoint taken immediately *before* the publish that broke things. Checkpoints are created automatically before every Publish — it will be labeled with a timestamp.

---

## Step 4 — Roll back

### Option A — Git reset (preferred when commit hash is known)

In the **production workspace** shell:

```bash
# Reset to the last known-good commit
git reset --hard <commit-hash-from-LAST_STABLE.md>

# Confirm the reset landed on the right commit
git log --oneline -3
```

Then click **Publish** in Replit to push the rolled-back code to production.

### Option B — Replit Checkpoint restore (use when git reset is not viable)

1. In the production workspace, click the **Checkpoints** icon (clock/history icon in the left sidebar)
2. Find the checkpoint taken before the failed publish (timestamps help)
3. Click **Restore** on that checkpoint
4. Confirm the workspace files look correct
5. Click **Publish** in Replit

> **Important:** After restoring a checkpoint, always re-run Step 5 before declaring rollback complete.

---

## Step 5 — Verify the rollback

After the rolled-back version has published, run the production acceptance test against the live customer-facing site:

```bash
# Pass the known-good SHA so the script confirms the correct commit is live
bash scripts/run-prod-acceptance.sh --sha <known-good-hash-from-LAST_STABLE.md>
```

This script hits `app.myperfectmeals.com` directly (never localhost) and checks:
- Release identity — live SHA matches the known-good commit
- Storage bucket — production bucket is in use, not the dev bucket
- Auth wall — unauthenticated requests are rejected with HTTP 401
- Storage canary — `migration-manifest.json` returns HTTP 200
- Domain alias — `.ai` and `.com` serve the same SHA
- Core routes — `/api/health`, `/api/weekly-board`, `/api/shopping-list` registered

**All gates must pass (exit 0) before declaring rollback complete.** Warnings are acceptable; failures are not.

If you want to also do a local pre-publish config check before clicking Publish again, run:

```bash
bash scripts/pre-publish-validate.sh
```

That validator checks local environment state (secrets, bundle, DB reachability) — it is a useful pre-flight step but does **not** confirm what is live on the public domain. Always finish with `run-prod-acceptance.sh`.

---

## Step 6 — Record the incident

After the rollback is stable, record it. This is not optional — every incident record prevents the next one.

Create or append to `RELEASE_AUDIT.md` (if it exists) or the ops log with:

```
INCIDENT — <date>
Released SHA:   <the SHA that failed>
Rolled back to: <the SHA that is now live>
Checkpoint:     <checkpoint label or "git reset">
Failure:        <what broke — one paragraph>
Root cause:     <what caused it — one paragraph, or "under investigation">
Tests that caught it: <which check detected the failure, or "manual">
Tests that missed it: <which pre-publish checks should have caught this but didn't>
Follow-up:      <what change prevents recurrence>
```

---

## Last known-good checkpoint tagging convention

After every successful publish — once `bash scripts/run-prod-acceptance.sh` passes:

1. Open `LAST_STABLE.md` at the repo root
2. Update the **Current Stable Commit** table: replace the commit hash, date, and deploy notes
3. Append a row to the **Deploy History** table at the bottom
4. Commit and push:

```bash
HASH=$(git rev-parse --short HEAD)
git add LAST_STABLE.md
git commit -m "update LAST_STABLE to $HASH"
git push origin main
```

**Never update `LAST_STABLE.md` speculatively** — only update it after `run-prod-acceptance.sh` passes on the live site. If acceptance fails and you roll back, `LAST_STABLE.md` must still point to the previous healthy commit.

---

## Quick reference card

| Step | Action | Time |
|------|--------|------|
| 1 | Confirm failure on `app.myperfectmeals.com` | 1–2 min |
| 2 | Post status note to team | 30 sec |
| 3 | Find last-known-good hash in `LAST_STABLE.md` or Checkpoints | 1 min |
| 4A | `git reset --hard <hash>` then Publish | 3–5 min |
| 4B | Restore Replit Checkpoint then Publish | 3–5 min |
| 5 | `bash scripts/run-prod-acceptance.sh --sha <hash>` — must pass | 3–5 min |
| 6 | Record the incident | 5 min |

**Total: ~15 minutes from detection to confirmed recovery.**

---

## Related files

- `LAST_STABLE.md` — last known-good commit hash (update after every healthy release)
- `scripts/run-prod-acceptance.sh` — the live-site verification command to run after rollback (pass `--sha <hash>`)
- `scripts/pre-publish-validate.sh` — pre-publish local config validator (run before clicking Publish, not after)
- `docs/production-release-gate.md` — full release gate architecture (Gates 0–3)
- `replit.md` — full deploy sequence (Steps 1–9)
