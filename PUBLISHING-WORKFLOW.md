# My Perfect Meals — Publishing Workflow

The founder's [November 4 deployment cheat sheet](docs/DEPLOYMENT_CHEAT_SHEET_NOVEMBER_4.md) remains the authoritative human procedure. This document describes the guarded Development push entrypoints, not a replacement publishing procedure.

**Development → GitHub `dev` → Founder-reviewed PR → GitHub `production` → Replit Production → Publish → Verify.**

`main` and `staging` are not release targets.

## Development push

Review, stage, and commit intended Development changes manually. Then, from clean local `dev`, run one of these equivalent commands, without a commit message:

```bash
npm run push
# or: ./push.sh
# or: ./validate-and-push.sh
```

All entrypoints verify the GitHub destination and ancestry, run validation with `--no-start`, recheck clean state and HEAD, and push only `refs/heads/dev:refs/heads/dev`.

Dirty files, failed Git commands, failed validation, the wrong branch, remote-ahead history, and divergence stop the operation. No helper stages files, creates commits, changes author settings, starts an application, merges, synchronizes Production, or publishes.

## Review and publication

Open a PR with `production` explicitly selected as its base. Obtain founder review and approval. Do not enable automatic merging.

For Production synchronization, follow the November 4 cheat sheet. Dirty files, local-only commits, or divergence require investigation and founder review; never automatically merge, rebase, or reset Production.

Publish explicitly from Replit Production only after its approved checks, then verify the released app. A successful Git push is not a publication or proof of live health.

## Push safeguards

The installed pre-push hook checks actual remote destination refs, including explicit refspecs and multiple updates. Direct GitHub updates to `main`, `staging`, and `production` are refused. Legitimate Replit internal checkpoint backups remain separate and exempt.

Local hooks are bypassable; GitHub branch protection remains a separate founder-approved safeguard and is not changed by this repair.
