# Safe Publishing Workflow for App Store

## 🎯 THE GOLDEN RULE
**The push.sh script NOW AUTOMATICALLY ENFORCES ALL CHECKS.**

You **CANNOT** publish unless everything is clean. The script will BLOCK you.

---

## ✅ Simple Publishing Process

### Just Run This:
```bash
./push.sh "describe what you changed"
```

**That's it.** The script automatically:
1. ✅ Checks for unexpected file changes
2. ✅ Runs TypeScript compilation
3. ✅ Verifies critical files
4. ✅ Confirms server is running
5. ✅ Freezes new checksums after successful publish

**If ANY check fails, publishing is BLOCKED.**

---

## 🚨 What Happens If Validation Fails

### TypeScript Errors
```
❌ BLOCKED: TypeScript errors found!
```
**What to do:** Fix the errors shown, then try again.

### Unexpected File Changes
```
❌ BLOCKED: Critical files have changed unexpectedly!
```
**What to do:** 
1. Run `git diff` to see what changed
2. If changes are intentional: `./scripts/freeze-critical-files.sh`
3. If changes are unwanted: `git checkout -- <filename>` to revert
4. Try publishing again

### Server Not Running
```
⚠️  WARNING: Server not responding
```
**What to do:** Restart the workflow, then try again.

---

## 📋 Critical Files Being Protected

These files are monitored for unexpected changes:
- `client/src/components/modals/AIMealCreatorModal.tsx`
- `client/src/components/PreparationModal.tsx`
- `client/src/pages/WeeklyMealBoard.tsx`
- `client/src/pages/BeachBodyMealBoard.tsx`
- `client/src/pages/pro/PerformanceCompetitionBuilder.tsx`
- `client/src/pages/Planner.tsx`
- `server/routes/manualMacros.ts`

---

## 💡 Best Practices

### ✅ DO:
- Make focused, single-purpose changes
- Test your changes before publishing
- Write clear commit messages
- Trust the validation system

### ❌ DON'T:
- Try to bypass validation checks
- Publish without testing
- Make multiple unrelated changes at once
- Ignore validation warnings

---

## 🔧 Manual Verification (Optional)

If you want to check things manually before publishing:

```bash
# Check for unexpected changes
./scripts/verify-critical-files.sh

# Run TypeScript check
npm run check

# See what will be committed
git status
git diff
```

**But you don't HAVE to do this - push.sh does it all automatically.**

---

## 🆘 Emergency: Need to Override?

**DON'T.** If validation is blocking you, there's a reason.

Fix the issue, don't bypass the system.

If you absolutely must investigate:
1. Run `git status` to see what's changed
2. Run `npm run check` to see TypeScript errors
3. Fix the issues
4. Then publish normally

---

## 📊 What You Get

**Every publish is guaranteed to be:**
- ✅ Free of TypeScript errors
- ✅ Free of unexpected changes
- ✅ Tested with server running
- ✅ Tracked with checksums
- ✅ Documented with clear commit message

**You can publish to the App Store with confidence.**
