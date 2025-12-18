
# GUIDED TOUR SYSTEM - Complete Implementation Summary

## 🎯 OVERVIEW

We have implemented a **Guided Tour System** (aka "Coach Mode") for My Perfect Meals that guides new users step-by-step through the core workflow using visual cues (flashing/pulsing elements) and automatic navigation.

**Status:** ✅ Foundation Complete | 🚧 Additional Tours In Progress

---

## 📋 WHAT WE BUILT

### 1. **WelcomeGate Component** ✅ COMPLETE
- **File:** `client/src/components/WelcomeGate.tsx`
- **Purpose:** First-time users choose between "Intuitive Coach Mode" (guided) or "Self-Guided Mode"
- **Storage:** User choice saved to `localStorage.coachMode` ("guided" or "self")
- **Location:** Shown by `AppRouter.tsx` before dashboard access

### 2. **TourContext & Provider** ✅ COMPLETE
- **File:** `client/src/contexts/TourContext.tsx`
- **Purpose:** Manages tour state, current step, and progression
- **Key Functions:**
  - `startTour(steps)` - Initialize tour with array of steps
  - `nextStep()` - Advance to next step
  - `completeTour()` - Mark tour complete (sets `localStorage.tourCompleted`)
  - `skipTour()` - Allow users to exit tour
  - `getCurrentStepTarget()` - Get current element to highlight
  - `getCurrentStepMessage()` - Get current tooltip message

### 3. **TourHighlight Component** ✅ COMPLETE
- **File:** `client/src/components/TourHighlight.tsx`
- **Purpose:** Visual wrapper that adds pulsing ring + tooltip to any element
- **Features:**
  - Animated pulsing white ring around target element
  - Positioned tooltip with message
  - Auto-advances after duration (default 8s)
  - Configurable position (top/bottom/left/right)

### 4. **Dashboard Tour Implementation** ✅ COMPLETE
- **File:** `client/src/pages/DashboardNew.tsx`
- **Tour Steps:**
  1. "Macro Calculator" card - "Start here: Set up your nutrition targets"
  2. "My Biometrics" card - "Next: Track your progress"
  3. "Meal Creator" card - "Then: Create your first meal"
- **Integration:** Uses `TourHighlight` wrapper around feature cards
- **Activation:** Tour starts automatically if `coachMode === "guided"` and `!tourCompleted`

### 5. **Biometrics Guided Tour** ✅ COMPLETE
- **File:** `client/src/components/guided/BiometricsGuidedTour.tsx`
- **Flow:**
  1. Shows floating green CTA: "Click to add your weight & start making meals"
  2. On click: Scrolls to weight section
  3. Shows "Persistent numbers" info card explaining data persistence
  4. Flashes "Save" button with green pulse
  5. On save: Auto-navigates to `/planner`
- **Requirements:** Target page needs these IDs:
  - `id="weight-section"` on weight input container
  - `id="save-weight-btn"` on save button
  - `id="persistent-info-anchor"` (optional) for info card positioning

### 6. **CSS Animations** ✅ COMPLETE
- **File:** `client/src/index.css`
- **Classes:**
  - `.flash-green` - Gentle pulsing animation (1.4s)
  - `.flash-green-strong` - Strong pulsing with outline (1.1s)
- **Animation:** `pulseGreen` keyframes with emerald shadow

---

## 🔧 TECHNICAL ARCHITECTURE

### Flow Control
```
User first visit → WelcomeGate appears
                 ↓
User chooses mode → localStorage.coachMode = "guided" | "self"
                 ↓
Dashboard loads → TourContext.startTour() if guided mode
                 ↓
User clicks cards → TourHighlight shows next step
                 ↓
Navigate to /my-biometrics → BiometricsGuidedTour activates
                 ↓
User saves weight → Auto-route to /planner
                 ↓
[NEXT: Planner tour, then Meal Builder tour]
```

### localStorage Keys
- `coachMode`: "guided" | "self" | null
- `tourCompleted`: "true" | null
- `onboardingCompleted`: "true" | null (auto-set for guests)
- `disclaimerAccepted`: "true" | null (auto-set for guests)

### Integration Points
1. **AppRouter.tsx** - Shows WelcomeGate, wraps app in TourProvider
2. **DashboardNew.tsx** - Initializes dashboard tour steps
3. **my-biometrics.tsx** - Renders BiometricsGuidedTour component
4. **TourContext** - Centralized state management
5. **TourHighlight** - Reusable visual wrapper

- **File:** `client/src/components/guided/MealProgressCoach.tsx`
- **Utility:** `client/src/lib/mealProgress.ts`
- **Flow:**
  1. Tracks meal completion for today (localStorage, auto-resets daily)
  2. Highlights next incomplete meal's "Create AI Meal" button
  3. Listens for `meal:saved` events to advance progression
  4. Works across all meal boards (Weekly, Diabetic, GLP-1)
  5. Only runs when Coach Mode is enabled
- **Integration:** Added to all meal builder boards:
  - `WeeklyMealBoard.tsx` ✅
  - `DiabeticMenuBuilder.tsx` ✅
  - `GLP1MealBuilder.tsx` ✅
  - `AthleteBoard.tsx` ✅
- **Requirements:** Meal sections need:
  - `data-meal-id="breakfast|lunch|dinner|snack1|snack2"` on section container
  - `data-role="create-ai-meal"` on Create AI Meal button
  - Dispatch `meal:saved` event with mealId when meal is completed

---

## 🚧 REMAINING WORK

### 7. **Planner Guided Tour** ✅ COMPLETE
- **File:** `client/src/components/guided/PlannerGuidedTour.tsx`
- **Flow:**
  1. Shows floating white pulsing "?" icon in top-right
  2. On click: Opens overlay explaining all planner hubs
  3. All hub buttons pulse with white animation
  4. User clicks a hub → Routes to that planner
  5. Next: Meal Builder tour will activate
- **CSS:** Added `.flash-white` animation (pulseWhite keyframes)
- **Integration:** Added to `Planner.tsx`

### 8. **Meal Builder Guided Tour** ✅ COMPLETE
- **File:** `client/src/components/guided/MealBuilderGuidedTour.tsx`
- **Flow:**
  1. Flashing "Create AI Meal" button on first meal card
  2. When picker opens: Shows flashing "?" help icon
  3. On click: Overlay explains "Protein required, carbs/fats optional"
  4. Sequential highlights: Protein → Carbs → Fats → Done
  5. Auto-advances after 8s per step
  6. Returns to board after Done
- **Integration:** Added to `WeeklyMealBoard.tsx`
- **Requirements:** Picker needs these IDs:
  - `id="meal-picker-drawer"` with `className="open"` when visible
  - `id="picker-protein-section"` on protein picker section
  - `id="picker-carb-section"` on carb picker section
  - `id="picker-fat-section"` on fat picker section
  - `id="picker-done-btn"` on Done button

### 9. **Meal Progress Coach** ✅ COMPLETE
- **File:** `client/src/components/guided/MealProgressCoach.tsx`
- **Utility:** `client/src/lib/mealProgress.ts`
- **Flow:**
  1. Tracks meal completion for today (localStorage, auto-resets daily)
  2. Highlights next incomplete meal's "Create AI Meal" button
  3. Listens for `meal:saved` events to advance progression
  4. Works across all meal boards (Weekly, Diabetic, GLP-1, Athlete)
  5. Only runs when Coach Mode is enabled
- **Integration:** Added to all meal builder boards:
  - `WeeklyMealBoard.tsx` ✅
  - `DiabeticMenuBuilder.tsx` ✅
  - `GLP1MealBuilder.tsx` ✅
  - `AthleteBoard.tsx` ✅
- **Requirements:** Meal sections need:
  - `data-meal-id="breakfast|lunch|dinner|snack1|snack2"` on section container
  - `data-role="create-ai-meal"` on Create AI Meal button
  - Dispatch `meal:saved` event with mealId when meal is completed

### 10. **Daily Meal Progress Bar** ✅ COMPLETE
- **File:** `client/src/components/guided/DailyMealProgressBar.tsx`
- **Flow:**
  1. Visual progress bar showing % of meals completed
  2. Updates in real-time as meals are saved
  3. Resets daily at midnight
  4. Shows 0-100% based on completion of all 5 meals (Breakfast, Lunch, Dinner, Snack 1, Snack 2)
  5. Green gradient fill with percentage text overlay
- **Integration:** Added to all meal builder boards:
  - `WeeklyMealBoard.tsx` ✅
  - `DiabeticMenuBuilder.tsx` ✅
  - `GLP1MealBuilder.tsx` ✅
  - `AthleteBoard.tsx` ✅
- **Requirements:** 
  - Relies on same `mealProgress.ts` utility
  - Listens for `meal:saved` events
  - Works seamlessly with MealProgressCoach

---

## 📝 CODE PATTERNS TO MAINTAIN

### Pattern 1: DOM-Safe Tour Components
```tsx
// ✅ Good: Check if element exists before manipulation
const saveBtn = document.getElementById("save-weight-btn");
if (saveBtn) {
  saveBtn.classList.add("flash-green-strong");
}

// ❌ Bad: Assumes element exists
document.getElementById("save-weight-btn").classList.add("flash-green-strong");
```

### Pattern 2: Conditional Rendering Based on Coach Mode
```tsx
const isGuided = () => localStorage.getItem("coachMode") === "guided";

export function SomeTourComponent() {
  const [active, setActive] = useState(isGuided());
  
  if (!active) return null;
  
  return <div>Tour UI...</div>;
}
```

### Pattern 3: TourHighlight Wrapper
```tsx
<TourHighlight
  active={isActive && getCurrentStepTarget() === "target-id"}
  message={getCurrentStepMessage() || undefined}
  position="bottom"
  onComplete={nextStep}
>
  <Card data-tour-target="target-id">
    {/* Your content */}
  </Card>
</TourHighlight>
```

### Pattern 4: Auto-Navigation After Action
```tsx
useEffect(() => {
  if (!active) return;
  
  const targetBtn = document.getElementById("action-btn");
  
  const onAction = () => {
    setTimeout(() => setLocation("/next-page"), 350);
  };
  
  if (targetBtn) {
    targetBtn.addEventListener("click", onAction, { once: true });
  }
  
  return () => {
    if (targetBtn) targetBtn.removeEventListener("click", onAction);
  };
}, [active, setLocation]);
```

---

## 🎨 DESIGN PRINCIPLES

1. **Non-Intrusive**: Tours only appear for users who chose "Coach Mode"
2. **Skippable**: Users can always exit or ignore tours
3. **Progressive**: Each tour step builds on the previous
4. **Context-Aware**: Tours activate based on route and localStorage state
5. **Persistent State**: Once `tourCompleted` is set, tours don't re-trigger
6. **DOM-Safe**: All element queries check for existence before manipulation
7. **Accessible**: Visual cues (pulsing, tooltips) are clear and noticeable

---

## 🔍 TESTING CHECKLIST

- [ ] Clear localStorage and visit site → WelcomeGate appears
- [ ] Choose "Intuitive Coach Mode" → Dashboard tour starts
- [ ] Click Macro Calculator → Highlights, shows message
- [ ] Click My Biometrics → Highlights, routes to biometrics
- [ ] Biometrics page → Green CTA appears
- [ ] Click CTA → Scrolls to weight, shows info card, flashes Save
- [ ] Click Save → Routes to /planner
- [ ] Choose "Self-Guided Mode" → No tours appear
- [ ] Tour completion → Set `tourCompleted` → Tours don't re-trigger

---

## 💾 FILES MODIFIED/CREATED

### Created:
- `client/src/components/WelcomeGate.tsx`
- `client/src/components/TourHighlight.tsx`
- `client/src/contexts/TourContext.tsx`
- `client/src/components/guided/BiometricsGuidedTour.tsx`
- `client/src/components/guided/PlannerGuidedTour.tsx`
- `client/src/components/guided/MealBuilderGuidedTour.tsx`
- `client/src/components/guided/MealProgressCoach.tsx`
- `client/src/lib/mealProgress.ts`
- `GUIDED_TOUR_SYSTEM_IMPLEMENTATION.md` (this file)

### Modified:
- `client/src/components/AppRouter.tsx` - Added WelcomeGate, TourProvider
- `client/src/pages/DashboardNew.tsx` - Added tour initialization, TourHighlight wrappers
- `client/src/pages/Planner.tsx` - Added PlannerGuidedTour component
- `client/src/pages/WeeklyMealBoard.tsx` - Added MealBuilderGuidedTour component
- `client/src/index.css` - Added `.flash-green`, `.flash-green-strong`, and `.flash-white` animations

### To Be Modified (Next Steps):
- `client/src/pages/my-biometrics.tsx` - Add BiometricsGuidedTour, required IDs
- `client/src/components/pickers/MealPickerDrawer.tsx` - Add required IDs for tour highlighting

---

## 🚀 DEPLOYMENT NOTES

- No environment variables required
- No database migrations needed
- Pure client-side feature using localStorage
- Works in auto-bypass guest mode
- No server-side dependencies

---

## 📞 FOR REPLIT AGENT

**CRITICAL:** This system is foundational for user onboarding. When extending:

1. **Never remove TourProvider** from AppRouter
2. **Always check `coachMode === "guided"`** before showing tour UI
3. **Use DOM IDs for targets** - don't refactor the ID-based selectors
4. **Maintain the flash-green classes** - they're part of the design language
5. **Keep tours optional** - "Self-Guided Mode" must remain fully functional
6. **Test both modes** after any changes to tour system

**Next Steps for Agent:**
1. Add required IDs to `my-biometrics.tsx` (weight-section, save-weight-btn)
2. Import and render `BiometricsGuidedTour` in biometrics page
3. Create `PlannerGuidedTour.tsx` following the same pattern
4. Create `MealBuilderGuidedTour.tsx` for final tour step

---

## 📄 REFERENCE LINKS

- Original Design Doc: `attached_assets/Pasted-Perfect-this-is-exactly-what-I-needed-*.txt`
- Biometrics Tour Spec: `attached_assets/Pasted-Awesome-here-s-a-drop-in-*.txt`
- Welcome Gate: See `WelcomeGate.tsx` for modal pattern
- Tour Context: See `TourContext.tsx` for state management

---

**Last Updated:** January 7, 2025  
**Status:** Foundation Complete, Ready for Planner & Meal Builder Tours  
**Maintained By:** Development team in collaboration with Replit Agent
