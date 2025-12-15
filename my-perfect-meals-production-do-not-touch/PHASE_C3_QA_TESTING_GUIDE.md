# 🔥 PHASE C.3 QA TESTING GUIDE
## Weekly Meal Builder Walkthrough - READY FOR TESTING

**Status:** ✅ ALL SYSTEMS GO  
**Date:** November 24, 2025  
**Verification:** Pre-flight checks complete

---

## ✅ PRE-FLIGHT VERIFICATION (COMPLETED)

### Code Components Verified:
- ✅ `uiReady: true` in WeeklyMealBuilderScript.ts
- ✅ All 17 data-testid anchors installed
- ✅ All 4 custom events wired (filled, ready, chosen, done)
- ✅ Event dispatchers confirmed in code
- ✅ Walkthrough script engine active
- ✅ Voice + text routing configured

### Test IDs Confirmed:
```
✅ weekly-builder-header
✅ meal-slot-breakfast, meal-slot-lunch, meal-slot-dinner, meal-slot-snack
✅ meal-filled-breakfast, meal-filled-lunch, meal-filled-dinner, meal-filled-snack
✅ daily-totals-card
✅ daily-totals-ready
✅ duplicate-button
✅ send-week-to-shopping
✅ shopping-week-sent
```

### Event Dispatchers Confirmed:
```javascript
✅ dispatchEvent(new CustomEvent('filled'))  // Meal slots
✅ dispatchEvent(new CustomEvent('ready'))   // Totals calculation
✅ dispatchEvent(new CustomEvent('chosen'))  // Duplicate days selected
✅ dispatchEvent(new CustomEvent('done'))    // Export to shopping
```

---

## 🧪 MANUAL QA TEST SCRIPT

### Prerequisites:
1. Navigate to home page
2. Copilot should be visible at bottom
3. No errors in console

---

### TEST GROUP 1: VOICE & TEXT LAUNCH

#### Test 1.1: Voice Launch - Full Command
**Action:** Say "Weekly Meal Builder"  
**Expected:**
- ✅ Navigation to /weekly-meal-board
- ✅ Spotlight overlay appears
- ✅ First element highlights (header or breakfast)
- ✅ Copilot speaks intro text

**Result:** PASS / FAIL / NOTES:

---

#### Test 1.2: Text Launch - Full Command
**Action:** Type "weekly builder" into Copilot input  
**Expected:**
- ✅ Same navigation behavior as voice
- ✅ Walkthrough activates

**Result:** PASS / FAIL / NOTES:

---

#### Test 1.3: Partial Utterance - "weekly"
**Action:** Say "weekly"  
**Expected:**
- ✅ Routes to /weekly-meal-board
- ✅ Walkthrough starts

**Result:** PASS / FAIL / NOTES:

---

#### Test 1.4: Partial Utterance - "week plan"
**Action:** Say "week plan"  
**Expected:**
- ✅ Routes correctly
- ✅ Walkthrough starts

**Result:** PASS / FAIL / NOTES:

---

#### Test 1.5: Partial Utterance - "meal week"
**Action:** Say "meal week"  
**Expected:**
- ✅ Routes correctly
- ✅ Walkthrough starts

**Result:** PASS / FAIL / NOTES:

---

### TEST GROUP 2: MEAL SLOT INTERACTIONS

#### Test 2.1: Breakfast Slot
**Action:** Tap breakfast add button → Add any meal  
**Expected:**
- ✅ Meal card appears
- ✅ `filled` event fires (check console for event)
- ✅ Spotlight advances to Lunch slot
- ✅ Copilot prompts for lunch

**Result:** PASS / FAIL / NOTES:

---

#### Test 2.2: Lunch Slot
**Action:** Tap lunch add button → Add any meal  
**Expected:**
- ✅ Meal card appears
- ✅ `filled` event fires
- ✅ Spotlight advances to Dinner slot
- ✅ Copilot prompts for dinner

**Result:** PASS / FAIL / NOTES:

---

#### Test 2.3: Dinner Slot
**Action:** Tap dinner add button → Add any meal  
**Expected:**
- ✅ Meal card appears
- ✅ `filled` event fires
- ✅ Spotlight advances to Snack slot
- ✅ Copilot prompts for snack

**Result:** PASS / FAIL / NOTES:

---

#### Test 2.4: Snack Slot
**Action:** Tap snack add button → Add any snack  
**Expected:**
- ✅ Snack card appears
- ✅ `filled` event fires
- ✅ Spotlight advances to Totals section
- ✅ Copilot says "Your daily totals are ready"

**Result:** PASS / FAIL / NOTES:

---

### TEST GROUP 3: TOTALS CALCULATION

#### Test 3.1: Daily Totals Display
**Action:** Wait for totals to render (after 4 meals added)  
**Expected:**
- ✅ Totals card displays correctly
- ✅ After 500ms delay, `ready` event fires
- ✅ Spotlight advances to Duplicate button
- ✅ No double-trigger behavior
- ✅ No UI flicker or scroll issues

**Result:** PASS / FAIL / NOTES:

---

### TEST GROUP 4: DUPLICATE DAYS MODAL

#### Test 4.1: Open Duplicate Modal
**Action:** Tap "Duplicate" button on the day card  
**Expected:**
- ✅ Modal opens
- ✅ Modal is spotlight-highlighted
- ✅ Copilot instructs: "Select your days"
- ✅ Day checkboxes visible

**Result:** PASS / FAIL / NOTES:

---

#### Test 4.2: Select Multiple Days
**Action:** Tap Monday, Tuesday, Wednesday checkboxes  
**Expected:**
- ✅ Checkboxes toggle correctly
- ✅ Visual feedback on selection
- ✅ No console errors

**Result:** PASS / FAIL / NOTES:

---

#### Test 4.3: Confirm Selection
**Action:** Tap "Confirm" button  
**Expected:**
- ✅ `chosen` event fires (check console)
- ✅ Modal closes
- ✅ Meals duplicated to selected days
- ✅ Spotlight advances to Shopping step
- ✅ Copilot prompts for shopping export

**Result:** PASS / FAIL / NOTES:

---

### TEST GROUP 5: EXPORT TO SHOPPING

#### Test 5.1: Send to Shopping
**Action:** Tap "Send to Shopping" button  
**Expected:**
- ✅ `done` event fires (check console)
- ✅ Spotlight clears completely
- ✅ Walkthrough ends cleanly
- ✅ Copilot says "Weekly plan completed"
- ✅ Navigation to shopping list (or confirmation message)

**Result:** PASS / FAIL / NOTES:

---

### TEST GROUP 6: FAILURE MODE TESTING

#### Test 6.1: Wrong Meal Slot Order
**Action:** Try adding dinner before breakfast  
**Expected:**
- ✅ Spotlight prevents out-of-order interaction
- ✅ Copilot redirects to correct slot
- ✅ No advancement until correct slot filled

**Result:** PASS / FAIL / NOTES:

---

#### Test 6.2: Rapid Step Changes
**Action:** Quickly add all 4 meals in rapid succession  
**Expected:**
- ✅ No race conditions
- ✅ Events fire in correct order
- ✅ Spotlight advances smoothly
- ✅ No stuck states

**Result:** PASS / FAIL / NOTES:

---

#### Test 6.3: Duplicate Modal Early Access
**Action:** Try opening duplicate modal before completing all meals  
**Expected:**
- ✅ Spotlight prevents early access
- ✅ Walkthrough doesn't advance incorrectly
- ✅ User redirected to current step

**Result:** PASS / FAIL / NOTES:

---

#### Test 6.4: Slow Totals Render
**Action:** Add meals on slow device/connection  
**Expected:**
- ✅ 500ms delay handles render timing gracefully
- ✅ `ready` event fires after totals appear
- ✅ No premature advancement
- ✅ No UI freezing

**Result:** PASS / FAIL / NOTES:

---

## 🎯 ACCEPTANCE CRITERIA

### Required for PASS:
- [ ] All voice/text launch methods work (Tests 1.1-1.5)
- [ ] All meal slots trigger `filled` events (Tests 2.1-2.4)
- [ ] Totals calculation triggers `ready` event correctly (Test 3.1)
- [ ] Duplicate modal triggers `chosen` event (Tests 4.1-4.3)
- [ ] Shopping export triggers `done` event (Test 5.1)
- [ ] Failure modes handled gracefully (Tests 6.1-6.4)
- [ ] Zero console errors during walkthrough
- [ ] Spotlight clears completely at end

### Optional for ENHANCEMENT:
- [ ] Voice mishear fallback works ("Try typing instead")
- [ ] Walkthrough can be cancelled/restarted mid-flow
- [ ] Mobile device testing (iOS/Android)
- [ ] Different screen sizes (phone/tablet/desktop)

---

## 📊 TEST RESULTS SUMMARY

**Total Tests:** 16  
**Passed:** _____  
**Failed:** _____  
**Notes/Issues:**

---

## 🐛 BUG REPORT TEMPLATE

If you find issues, document them like this:

```
Test #: [Test number]
Issue: [What went wrong]
Expected: [What should happen]
Actual: [What actually happened]
Steps to Reproduce:
1. 
2. 
3. 
Console Errors: [Yes/No - paste if yes]
Browser: [Chrome/Safari/Firefox]
Device: [Desktop/Mobile]
```

---

## 🚀 NEXT STEPS AFTER QA PASS

1. ✅ Mark Phase C.3 as COMPLETE
2. Archive this QA document
3. Update replit.md with completion status
4. Choose next walkthrough feature:
   - Shopping List Walkthrough
   - Craving Creator Walkthrough
   - Diabetic Builder Walkthrough
   - GLP-1 Builder Walkthrough

---

**Tester Name:** _____________________  
**Date Tested:** _____________________  
**Overall Status:** PASS / FAIL / NEEDS REVISION
