# Staging to Production Change Tracker

Use this template to track each promotion from Staging to Production.

---

## Promotion Record

### Promotion Date: _______________

### Staging Commit Hash: _______________

### Summary of Changes:
_Brief description of what was changed and why_

---

### Files Changed:

| # | File Path | Change Type | Promoted? | Verified? |
|---|-----------|-------------|-----------|-----------|
| 1 | | Modified | [ ] | [ ] |
| 2 | | Modified | [ ] | [ ] |
| 3 | | Modified | [ ] | [ ] |
| 4 | | Added | [ ] | [ ] |
| 5 | | Deleted | [ ] | [ ] |

---

### Dependencies Changed?

- [ ] No dependency changes
- [ ] package.json updated (ran npm install in Production)
- [ ] New packages added: _______________
- [ ] Packages removed: _______________

---

### Pre-Promotion Checklist:

- [ ] Changes tested in Staging
- [ ] No console errors
- [ ] Mobile tested (if applicable)
- [ ] Ready for production

---

### Production Steps Completed:

- [ ] Files transferred to Production
- [ ] npm install (if needed)
- [ ] npm run build - successful
- [ ] Local verification passed
- [ ] Production deployed
- [ ] Live site verified
- [ ] npx cap sync ios (if applicable)

---

### Issues Encountered:
_Document any problems and how they were resolved_

---

### Sign-off:

Promoted by: _______________
Verified by: _______________
Date/Time: _______________

---

# Change History

| Date | Commit | Files Changed | Status | Notes |
|------|--------|---------------|--------|-------|
| | | | | |
| | | | | |
| | | | | |
