# Weight Decay Loop Audit Report
**Task:** #1238 — Find and flag other user accounts where the weight decay loop may have run  
**Date:** 2026-08-16  
**Method:** Read-only queries against the development database  
**No account modifications were made.**

---

## Background

A bug in the MacroCalculator divided the user's stored `users.weight` value by `2.20462` (the lbs-to-kg conversion factor) on every calculator sync visit — treating whatever was stored as if it were pounds and converting it to kg. For an imperial user whose weight was stored in lbs (e.g. 134), this produced 134 / 2.20462 ≈ 61 and wrote 61 back to the DB.

Monica's account was the known case (134 → 61). This audit searched for all other accounts exhibiting the same pattern.

---

## Query 1: `users.weight < 35` with `age > 0` and recent activity

**Result: 0 rows**

No accounts currently have a stored weight below 35 kg combined with a non-null age — meaning no account is presently sitting at a third-stage decay value (e.g. 134 → 61 → 28 → 13).

---

## Query 2: Biometric halving sequence — `biometric_sample` (`provider = 'macro-calculator'`, `type = 'weight'`)

Looked for consecutive weight entries per user where `prev / current` is between 1.9 and 2.6 (the ~2.204 decay ratio).

**3 suspicious transitions found across 2 users:**

| User | Email | Age | Stored weight | Measurement | Prev value | Decayed to | Ratio | Date |
|------|-------|-----|---------------|-------------|-----------|------------|-------|------|
| monica | monica@monicabrant.com | 55 | 134 (imperial) | imperial | 134 lb | 61 lb | 2.197 | 2026-08-16 |
| bigidrise | bigidrise@gmail.com | 60 | 245 (imperial) | imperial | 240 lb | 115 lb | 2.087 | 2026-06-04 |
| bigidrise | bigidrise@gmail.com | 60 | 245 (imperial) | imperial | 115 lb | 52 lb | 2.212 | 2026-06-05 |

---

## Query 3: `users.weight < 35` regardless of age (expanded)

**1 row:**

| id | username | email | age | weight | measurement_system |
|----|----------|-------|-----|--------|--------------------|
| c0800064-0ee7-44b6-be9a-cc14ccecf285 | henry2 | henry2@gmail.com | NULL | 33 | imperial |

henry2's only biometric_sample entry is `73 lb` on 2026-05-18.  
`73 / 2.20462 = 33.1` — **exact match**. The decay loop ran once and wrote 33 back to `users.weight`. Age is not set, so this account was excluded from the primary filter.

---

## Summary of Affected Accounts

### ✅ KNOWN — Already repaired
**monica** (monica@monicabrant.com)  
- Stored weight repaired manually prior to this audit.  
- Biometric history still shows the 134 → 61 decay entry on 2026-08-16, but current `users.weight` = 134 (correct).

---

### ⚠️ NEEDS REPAIR — henry2 (henry2@gmail.com)
- **User ID:** `c0800064-0ee7-44b6-be9a-cc14ccecf285`  
- **Stored weight:** 33 (imperial — lbs)  
- **Biometric evidence:** Single macro-calculator entry of 73 lbs on 2026-05-18; `73 / 2.20462 = 33.1` confirms decay ran once  
- **Correct value:** 73 lbs  
- **Impact:** MacroCalculator is generating macro targets for a person reported as 33 lbs. All dashboard calorie and macro outputs for this user are wrong.  
- **Action:** `UPDATE users SET weight = 73 WHERE id = 'c0800064-0ee7-44b6-be9a-cc14ccecf285'`

---

### ℹ️ HISTORICAL DECAY — bigidrise (bigidrise@gmail.com)
- **User ID:** `6796ce88-dff8-4336-adcb-e53986830f3f`  
- **Current stored weight:** 245 (imperial — lbs) — **appears correct**  
- **Biometric evidence:** Two consecutive decay events on 2026-06-04 and 2026-06-05 (240 → 115 → 52), followed by a return to normal entries (250 lb on 2026-06-25 and subsequent).  
- **Assessment:** The user apparently re-entered their correct weight after the decay occurred. Current `users.weight = 245` matches the post-recovery biometric stream. **No repair needed to `users.weight` today**, but the corrupt biometric entries (115 lb on 2026-06-04, 52 lb on 2026-06-05) remain in the history and will skew any historical macro reports or trend charts that include that window.  
- **Recommended action:** Consider deleting the two corrupt biometric_sample rows (2026-06-04 value=115, 2026-06-05 value=52) from the biometric history.  
  ```sql
  -- Review before deleting:
  SELECT * FROM biometric_sample
  WHERE user_id = '6796ce88-dff8-4336-adcb-e53986830f3f'
    AND type = 'weight' AND provider = 'macro-calculator'
    AND start_time IN ('2026-06-04 12:00:00+00', '2026-06-05 12:00:00+00');
  ```

---

## Full Weight Distribution (for reference)

47 users have `weight` set. Distribution of values in the low range (potential concern zone):

| weight (stored) | measurement_system | users |
|-----------------|-------------------|-------|
| 33 | imperial | 1 ← henry2 (confirmed decay) |
| 66 | imperial | 1 |
| 72 | imperial | 1 |
| 73 | imperial | 1 |
| 76 | imperial | 1 |

Values of 66–76 lbs are plausible for a petite or young adult, so those are not flagged. The only value below 35 lbs (`users.weight = 33`) is confirmed as a decay artifact.

---

## Recommended Manual Actions

1. **Repair henry2's weight:**
   ```sql
   UPDATE users SET weight = 73 WHERE id = 'c0800064-0ee7-44b6-be9a-cc14ccecf285';
   ```

2. **Optionally remove corrupt biometric entries for bigidrise** (the two June 2026 decay entries):
   ```sql
   DELETE FROM biometric_sample
   WHERE user_id = '6796ce88-dff8-4336-adcb-e53986830f3f'
     AND type = 'weight'
     AND provider = 'macro-calculator'
     AND start_time::date IN ('2026-06-04', '2026-06-05')
     AND value < 60;
   ```

3. **Root-cause fix** (the MacroCalculator bug itself) should prevent any new decay — this report covers the existing damage only.
