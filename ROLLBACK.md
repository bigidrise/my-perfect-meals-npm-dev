# MPM Production Rollback Procedure

Use this document when a production release fails acceptance tests or a user reports
a critical regression. Do not improvise under pressure — follow these steps in order.

---

## Step 1 — Confirm the problem

Run the acceptance test to establish ground truth:

```bash
bash scripts/run-prod-acceptance.sh
```

Note exactly which gates failed. This tells you whether to roll back or apply a
targeted fix (e.g. a storage canary failure alone may be an Object Storage transient —
wait 60 seconds and re-run before rolling back).

---

## Step 2 — Post a status note

Before touching anything, record what is happening:

```
ROLLBACK IN PROGRESS
Time: <now>
Failed release: <releaseId> / SHA: <sha>
Failed gates: <list>
Action: reverting to last known-good checkpoint
```

Keep this note somewhere visible (Slack, doc, even a note to yourself) so you know
what you were doing if you get interrupted.

---

## Step 3 — Roll back via Checkpoints

In the **production workspace** (not dev):

1. Open the Checkpoints panel (top-right in the Replit editor)
2. Find the checkpoint taken **before** the failed publish (labeled by timestamp)
3. Click **Restore** on that checkpoint
4. Wait for the workspace to restore

The checkpoint restores the production workspace's code to the previous state.
It does **not** automatically re-publish — you must manually publish after restoring.

---

## Step 4 — Re-publish the restored checkpoint

After the checkpoint restores:

1. Run `bash scripts/pre-publish-validate.sh` — confirm the restored state passes
2. Click **Publish** in Replit
3. Wait for the deployment to complete

---

## Step 5 — Confirm the rollback worked

```bash
bash scripts/run-prod-acceptance.sh
```

The SHA in `/api/release` will now be the previous known-good SHA.
All gates should pass.

---

## Step 6 — Record the incident

Add an entry to `docs/release-audit.md` (create if it doesn't exist):

```
## <date> — Rollback from <failed-release> to <previous-release>

- Failed release: <releaseId> / SHA: <sha>
- Failed gates: <list from Step 1>
- Rollback time: ~<N> minutes
- Root cause: <brief description>
- Prevention: <what check should have caught this>
```

---

## Quick reference

| Problem | First action |
|---|---|
| Storage canary fails | Re-run in 60s first (transient). If persists: check `DEFAULT_OBJECT_STORAGE_BUCKET_ID` in prod secrets |
| SHA mismatch | Wrong commit deployed — check GitHub, re-publish from correct branch |
| Auth wall broken (profile returns 200 unauthenticated) | Roll back immediately — this is critical |
| Dev bucket in production | Roll back + fix `DEFAULT_OBJECT_STORAGE_BUCKET_ID` secret before re-publishing |
| Domain divergence (.ai ≠ .com) | Recheck domain configuration; .ai may need to be re-pointed to the same deployment |

---

## What rollback cannot fix

- **Database migrations that already ran** — if a migration added a column that the
  previous code doesn't know about, the rollback code will still work (extra columns
  are ignored by ORM). If a migration *removed* a column the previous code needs,
  you'll need a forward fix.
- **Data written by the failed release** — user data created during the bad release
  window is not reverted. Rollback restores the code, not the data.

---

## Prevention

The goal is to never need this document for the same reason twice.

After every rollback, update `scripts/run-prod-acceptance.sh` to add a test that
would have caught the problem before the user did.
