# Production Promotion Checklist

## Pre-Promotion (In Staging)

- [ ] All changes tested and working in Staging
- [ ] No console errors in browser
- [ ] App runs correctly on mobile (if applicable)
- [ ] Changes pushed to GitHub from Staging

## Identify Changed Files

Run in Staging terminal:
```bash
git diff --name-only HEAD~1
```

Or for multiple commits:
```bash
git diff --name-only <commit-hash>..HEAD
```

## Record Changes

| File Path | Change Type | Notes |
|-----------|-------------|-------|
| | Added/Modified/Deleted | |
| | Added/Modified/Deleted | |
| | Added/Modified/Deleted | |

## Transfer to Production

- [ ] Download changed files from Staging
- [ ] Verify file contents are correct
- [ ] Upload files to Production Repl (same paths)
- [ ] Confirm files are in correct locations

## Production Build

Run in Production terminal:
```bash
npm install          # Only if package.json changed
npm run build
```

- [ ] Build completes without errors
- [ ] No TypeScript errors
- [ ] No missing dependencies

## Production Verification

- [ ] Run the app locally in Production Repl
- [ ] Test the specific features that changed
- [ ] Verify no regressions in other features
- [ ] Check console for errors

## iOS Sync (If Applicable)

```bash
npx cap sync ios
```

- [ ] Sync completes successfully
- [ ] No plugin errors

## Deploy Production

- [ ] Redeploy/Publish the Production Repl
- [ ] Verify live site works correctly
- [ ] Test on mobile device if applicable

## Post-Deployment

- [ ] Document what was promoted (date, files, features)
- [ ] Note any issues encountered
- [ ] Update version number if applicable

---

## Emergency Rollback

If something goes wrong:
1. Identify the broken file(s)
2. Restore from backup or previous known-good version
3. Rebuild and redeploy
4. Document what happened

---

## Golden Rules

1. **NEVER run `git pull` in Production**
2. Only transfer files that have been tested in Staging
3. Always verify the build before deploying
4. Keep Production as a clean, controlled environment
