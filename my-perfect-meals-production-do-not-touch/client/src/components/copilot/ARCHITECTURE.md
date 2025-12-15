# Copilot Spotlight Walkthrough System - Architecture

**Version:** 1.0  
**Status:** Design Document  
**Feature Flag:** `FEATURES.copilotSpotlight` (default: `false`)

---

## Overview

The Spotlight Walkthrough System provides guided, step-by-step tutorials for app features through visual highlighting and automated navigation. When users mention feature keywords via voice or text, Copilot automatically navigates to the feature and initiates an interactive walkthrough.

**Core Principles:**
- **Non-Breaking:** Zero impact when feature flag is disabled
- **Isolated:** Portal-based rendering prevents layout interference
- **Scoped:** Event listeners live only during active walkthroughs
- **Graceful:** Retry logic and fallbacks prevent null-target crashes

---

## 1. Overlay Lifecycle

### 1.1 Mount Strategy

The SpotlightOverlay component mounts via React Portal into a dedicated overlay root:

```tsx
// Mounting location: CopilotSheet.tsx
{FEATURES.copilotSpotlight && walkthroughActive && (
  <SpotlightOverlay 
    currentStep={currentStep}
    onAdvance={handleAdvance}
    onExit={handleExit}
  />
)}
```

**Portal Target:** `document.body` (ensures highest z-index, isolated from app layout)

**Mount Triggers:**
- User says feature keyword (e.g., "fridge rescue", "weekly board")
- Keyword detection matches feature in KeywordFeatureMap
- Navigation completes to target page
- Walkthrough state transitions to `active`

### 1.2 Update Cycle

SpotlightOverlay re-renders on:
- `currentStep` prop changes (user advances to next step)
- Target element position changes (scroll, resize)
- Walkthrough state updates (paused, resumed)

**Optimization:** Uses `ResizeObserver` and `MutationObserver` to track target element position without constant polling.

### 1.3 Unmount Strategy

Cleanup occurs when:
- User completes all walkthrough steps
- User clicks "Exit Walkthrough" button
- User navigates away from feature page
- Feature flag is toggled OFF

**Critical Cleanup:**
```typescript
useEffect(() => {
  return () => {
    // Remove all event listeners
    cleanupActionListeners();
    // Disconnect observers
    resizeObserver?.disconnect();
    mutationObserver?.disconnect();
    // Clear retry timers
    clearTimeout(navigationRetryTimer);
    // Reset walkthrough state
    resetWalkthroughState();
  };
}, []);
```

---

## 2. Pointer Events & Passthrough

### 2.1 Overlay Layers

The overlay consists of three stacked layers:

```
┌─────────────────────────────────────┐
│ Dimmed Background                   │ ← pointer-events: none
│ (black-glass, 70% opacity)          │
│                                     │
│   ┌───────────────┐                 │
│   │ Spotlight     │                 │ ← pointer-events: auto
│   │ (highlighted) │                 │    (allows interaction)
│   └───────────────┘                 │
│                                     │
│ [Instruction Card]                  │ ← pointer-events: auto
└─────────────────────────────────────┘
```

### 2.2 CSS Pointer Control

```css
.spotlight-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none; /* Entire overlay is non-blocking by default */
}

.spotlight-dimmed-area {
  background: rgba(0, 0, 0, 0.7);
  pointer-events: none; /* Dimmed area blocks nothing */
}

.spotlight-highlight {
  pointer-events: auto; /* Only highlighted element is interactive */
  border: 2px solid var(--accent-glow);
  box-shadow: 0 0 20px var(--accent-glow);
}

.spotlight-instruction-card {
  pointer-events: auto; /* Instruction card is clickable */
}
```

### 2.3 Interaction Safety

**Passthrough Verification:**
- Click events outside spotlight should reach underlying app
- Highlighted element should be fully interactive
- Scroll should work normally
- Escape key exits walkthrough

**Testing Checkpoints:**
- Click dimmed area → no effect (app continues normally)
- Click highlighted button → button executes
- Scroll while spotlighted → page scrolls, spotlight follows
- Press ESC → walkthrough exits cleanly

---

## 3. Command Routing Order

### 3.1 Processing Hierarchy

Copilot processes user input through a strict priority order:

```
User Input (voice or text)
    ↓
┌───────────────────────────────────────┐
│ 1. EXPLICIT INTENTS                   │ ← Hardcoded commands (highest priority)
│    - "start fridge rescue walkthrough" │
│    - "explain weekly meal board"       │
│    - "navigate to shopping list"       │
└───────────────────────────────────────┘
    ↓ (if no match)
┌───────────────────────────────────────┐
│ 2. KEYWORD DETECTION (NEW)            │ ← Fuzzy feature matching
│    - "fridge" → /fridge-rescue        │
│    - "weekly" → /weekly-meal-board    │
│    - "diabetic" → /clinical/diabetes  │
│    (ONLY if FEATURES.copilotSpotlight)│
└───────────────────────────────────────┘
    ↓ (if no match)
┌───────────────────────────────────────┐
│ 3. KNOWLEDGE FALLBACK                 │ ← Explains feature without nav
│    - Returns knowledge card            │
│    - No navigation or walkthrough      │
└───────────────────────────────────────┘
    ↓ (if no match)
┌───────────────────────────────────────┐
│ 4. "I'M STILL LEARNING"               │ ← Final fallback
└───────────────────────────────────────┘
```

### 3.2 Implementation in CopilotCommandRegistry.ts

```typescript
async function handleVoiceQuery(query: string) {
  // PRIORITY 1: Explicit intents (existing system)
  const explicitMatch = matchExplicitIntent(query);
  if (explicitMatch) {
    return await executeIntent(explicitMatch);
  }

  // PRIORITY 2: Keyword detection (NEW - gated by feature flag)
  if (FEATURES.copilotSpotlight) {
    const featureMatch = findFeatureFromKeywords(query);
    if (featureMatch) {
      await navigateToFeature(featureMatch.path);
      await startWalkthrough(featureMatch.walkthroughId);
      return { type: "walkthrough", feature: featureMatch.walkthroughId };
    }
  }

  // PRIORITY 3: Knowledge fallback (existing system)
  const knowledgeMatch = findKnowledgeByKeyword(query);
  if (knowledgeMatch) {
    return await explainFeature(knowledgeMatch.id);
  }

  // PRIORITY 4: Still learning (existing system)
  return { type: "unknown", message: "I'm still learning about that!" };
}
```

### 3.3 Debounce & Deduplication

To prevent double-triggering from rapid voice events:

```typescript
const debouncedHandleQuery = debounce(handleVoiceQuery, 300);
```

**Rationale:** Voice transcription can fire multiple near-identical queries within milliseconds. Debouncing prevents navigation loops.

---

## 4. Event Listener Scoping & Cleanup

### 4.1 Listener Lifecycle

Event listeners are **per-step scoped** and **immediately cleaned up** when:
- User advances to next step
- User exits walkthrough
- Component unmounts

**Anti-Pattern (BAD):**
```typescript
// ❌ Global listener that persists forever
document.addEventListener('click', handleClick);
```

**Correct Pattern (GOOD):**
```typescript
// ✅ Scoped listener with cleanup
useEffect(() => {
  if (!walkthroughActive) return;

  const targetElement = document.querySelector(currentStep.target);
  if (!targetElement) return;

  const handleStepComplete = () => {
    advanceWalkthrough();
  };

  targetElement.addEventListener('click', handleStepComplete);

  return () => {
    targetElement.removeEventListener('click', handleStepComplete);
  };
}, [walkthroughActive, currentStep]);
```

### 4.2 Observer Management

**MutationObserver:** Tracks DOM changes to detect step completion (e.g., form submission adds success message)

```typescript
const observer = new MutationObserver((mutations) => {
  if (mutations.some(m => m.target.matches('.success-indicator'))) {
    advanceWalkthrough();
    observer.disconnect(); // Immediate cleanup
  }
});

observer.observe(targetContainer, { childList: true, subtree: true });
```

**ResizeObserver:** Updates spotlight position when target element moves

```typescript
const resizeObserver = new ResizeObserver(() => {
  updateSpotlightPosition();
});

resizeObserver.observe(targetElement);
```

**Critical:** All observers must disconnect in cleanup:

```typescript
useEffect(() => {
  return () => {
    mutationObserver?.disconnect();
    resizeObserver?.disconnect();
  };
}, []);
```

### 4.3 Action Detection Strategy

Each step defines completion criteria via data attributes:

```typescript
// In page component:
<button 
  data-walkthrough-target="generate-button"
  data-walkthrough-action="click"
>
  Generate Meal
</button>
```

WalkthroughEngine reads action type and attaches appropriate listener:

```typescript
const actionType = targetElement.getAttribute('data-walkthrough-action');

switch (actionType) {
  case 'click':
    targetElement.addEventListener('click', handleAdvance);
    break;
  case 'input':
    targetElement.addEventListener('input', handleAdvance);
    break;
  case 'change':
    targetElement.addEventListener('change', handleAdvance);
    break;
}
```

**Fallback:** If no action completes within 10 seconds, pulse the spotlight and show "Click Next to continue" button.

---

## 5. Navigation Timing & Retry Strategy

### 5.1 The Timing Problem

When Copilot triggers navigation + walkthrough:

1. `setLocation('/fridge-rescue')` fires
2. React Router begins navigation
3. Old component unmounts
4. New component mounts
5. **Spotlight tries to query target element** ← May not exist yet!

**Result:** `querySelector` returns `null` → spotlight fails

### 5.2 Solution: Await Navigation Ready

```typescript
async function startSpotlightWalkthrough(featurePath: string, walkthroughId: string) {
  // Step 1: Navigate
  setLocation(featurePath);

  // Step 2: Wait for navigation to complete
  await waitForNavigationReady(featurePath);

  // Step 3: Wait for target element to exist
  const targetElement = await waitForElement(firstStep.target, { timeout: 5000 });

  if (!targetElement) {
    console.warn(`Walkthrough target not found: ${firstStep.target}`);
    return showKnowledgeFallback(walkthroughId);
  }

  // Step 4: Start walkthrough
  activateWalkthrough(walkthroughId);
}
```

### 5.3 Navigation Ready Detection

```typescript
function waitForNavigationReady(targetPath: string, timeout = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkReady = () => {
      if (window.location.pathname === targetPath) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Navigation timeout'));
      } else {
        requestAnimationFrame(checkReady);
      }
    };

    checkReady();
  });
}
```

### 5.4 Element Ready Detection with Retry

```typescript
function waitForElement(
  selector: string, 
  { timeout = 5000, retryInterval = 100 }
): Promise<Element | null> {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const checkElement = () => {
      const element = document.querySelector(selector);

      if (element) {
        resolve(element);
      } else if (Date.now() - startTime > timeout) {
        resolve(null); // Graceful failure
      } else {
        setTimeout(checkElement, retryInterval);
      }
    };

    checkElement();
  });
}
```

### 5.5 Graceful Fallback

If target element never appears:

```typescript
if (!targetElement) {
  // Show knowledge card instead of crashing
  return {
    type: "knowledge",
    message: "I can explain this feature! Let me show you what it does.",
    featureId: walkthroughId
  };
}
```

**User Experience:**
- Copilot navigates to feature ✅
- Spotlight fails to activate (target missing) ⚠️
- Copilot shows knowledge card explaining feature instead ✅
- User can still use the feature manually ✅

---

## 6. Data Attribute Strategy

### 6.1 Why Data Attributes?

**Problem:** Hardcoded IDs create tight coupling between walkthrough system and feature components.

```typescript
// ❌ BAD: Hardcoded ID
target: "#fridge-input"
```

If feature component changes ID → walkthrough breaks.

**Solution:** Use semantic data attributes:

```typescript
// ✅ GOOD: Data attribute
target: "[data-walkthrough-target='fridge-input']"
```

If feature component changes ID → walkthrough still works.

### 6.2 Standard Attributes

```html
<!-- Walkthrough target identification -->
<input data-walkthrough-target="fridge-input" />

<!-- Action type for listener -->
<button 
  data-walkthrough-target="generate-button"
  data-walkthrough-action="click"
>

<!-- Step completion indicator -->
<div data-walkthrough-complete="meal-generated">
  <!-- Appears after meal generation -->
</div>
```

### 6.3 Feature Component Integration

Minimal changes to existing feature components:

```tsx
// Before:
<input id="fridge-input" />

// After:
<input 
  id="fridge-input" 
  data-walkthrough-target="fridge-input"
/>
```

**Impact:** Zero functional change, only adds walkthrough compatibility.

---

## 7. Feature Flag Integration

### 7.1 Flag Definition

```typescript
// client/src/featureFlags.ts
export const FEATURES = {
  copilotSpotlight: import.meta.env.MODE === 'development',
  // ... other flags
};
```

**Environments:**
- **Development:** `true` (Replit workspace)
- **Staging:** `true` (beta testing)
- **Production:** `false` (disabled until approved)

### 7.2 Flag Usage

```typescript
// In CopilotCommandRegistry.ts
if (FEATURES.copilotSpotlight) {
  const featureMatch = findFeatureFromKeywords(query);
  if (featureMatch) {
    await startSpotlightWalkthrough(featureMatch);
  }
}

// In CopilotSheet.tsx
{FEATURES.copilotSpotlight && walkthroughActive && (
  <SpotlightOverlay currentStep={currentStep} />
)}
```

### 7.3 Runtime Toggle

For debugging/testing, expose runtime toggle:

```typescript
// Development only
if (import.meta.env.MODE === 'development') {
  window.__toggleSpotlight = () => {
    FEATURES.copilotSpotlight = !FEATURES.copilotSpotlight;
    console.log(`Spotlight: ${FEATURES.copilotSpotlight ? 'ON' : 'OFF'}`);
  };
}
```

---

## 8. Testing Strategy

### 8.1 Flag OFF (Regression)

**Objective:** Verify zero breaking changes when feature is disabled.

**Test Cases:**
- All existing voice commands work
- All existing text commands work
- Knowledge cards display correctly
- Navigation still works manually
- No console errors

### 8.2 Flag ON (Spotlight)

**Objective:** Verify spotlight flows work correctly.

**Test Cases:**

| Feature | Keyword | Expected Behavior |
|---------|---------|-------------------|
| Fridge Rescue | "fridge", "rescue" | Navigate → Spotlight input → Advance on type → Highlight generate → Advance on click |
| Weekly Meal Board | "weekly", "board" | Navigate → Spotlight day selector → Advance on click → Highlight AI creator |
| Beach Body | "beach", "beach body" | Navigate → Spotlight meal card → Advance on interact |
| Diabetic Hub | "diabetic", "diabetes" | Navigate → Spotlight guardrails → Advance on save |
| GLP-1 Hub | "glp", "glp1" | Navigate → Spotlight tracker → Advance on dose log |
| Alcohol Hub | "alcohol", "drinks" | Navigate → Spotlight smart sips → Advance on selection |

### 8.3 Edge Cases

- User navigates away mid-walkthrough → Cleanup fires
- User closes Copilot mid-walkthrough → Spotlight dismisses
- Target element doesn't exist → Shows knowledge fallback
- Network delay on page load → Retry logic succeeds
- Rapid repeated commands → Debounce prevents double-nav

---

## 9. Performance Considerations

### 9.1 Optimization Techniques

**Portal Rendering:** Overlay renders in separate root, prevents re-renders of main app.

**Observer Throttling:** ResizeObserver updates throttled to 60fps max.

**Lazy Target Queries:** Elements queried only when needed, not on every render.

**Event Delegation:** Where possible, use delegated listeners instead of per-element.

### 9.2 Memory Management

**Critical Cleanup Points:**
- Event listener removal on step change
- Observer disconnection on unmount
- Timer clearance on exit
- Ref nullification on cleanup

**Memory Leak Prevention:**
```typescript
useEffect(() => {
  const listeners = [];
  const observers = [];

  // ... setup code

  return () => {
    listeners.forEach(l => l.remove());
    observers.forEach(o => o.disconnect());
  };
}, [dependencies]);
```

---

## 10. Rollout Plan

### 10.1 Development Phase
- Feature flag: `true`
- Spotlight system fully enabled
- Developer testing on all features

### 10.2 Staging Phase
- Feature flag: `true`
- Beta tester validation
- Regression testing on all Copilot commands
- Performance monitoring

### 10.3 Production Phase
- Feature flag: `false` initially
- Gradual rollout after approval
- Monitoring for errors/performance issues
- User feedback collection

### 10.4 Rollback Plan

If critical issues emerge:

```typescript
// Emergency disable
FEATURES.copilotSpotlight = false;
```

System immediately reverts to previous behavior (knowledge cards only).

---

## 11. Success Metrics

**Technical Metrics:**
- Zero console errors when flag OFF
- < 100ms spotlight activation time
- < 50ms per step advance
- 100% cleanup verification (no memory leaks)

**User Experience Metrics:**
- Keyword detection accuracy > 90%
- Walkthrough completion rate
- Time to feature proficiency
- User satisfaction scores

---

## Appendix: File Structure

```
client/src/components/copilot/
├── ARCHITECTURE.md (this file)
├── CopilotCommandRegistry.ts (keyword routing)
├── CopilotSheet.tsx (overlay mounting)
├── SpotlightOverlay.tsx (NEW - visual overlay)
├── WalkthroughEngine.ts (NEW - action detection)
├── KeywordFeatureMap.ts (NEW - keyword mapping)
└── commands/
    └── startWalkthrough.ts (existing)
```

---

**Document Status:** ✅ Ready for Implementation  
**Last Updated:** November 23, 2025  
**Review Required:** Before Phase 2 begins
