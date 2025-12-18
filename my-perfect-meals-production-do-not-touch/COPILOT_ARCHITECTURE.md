# My Perfect Meals - Copilot Walkthrough System Architecture

## Overview
Our Copilot system provides guided walkthroughs for users across multiple pages. It supports two modes:
1. **FLOW mode**: Multi-page sequences with automatic navigation (e.g., Onboarding flow)
2. **PAGE mode**: Single-page walkthroughs (e.g., Restaurant Guide)

---

## Architecture Components

### 1. FlowOrchestrator
**Location:** `client/src/components/copilot/FlowOrchestrator.ts`

**Purpose:** Manages multi-page flow sequences and auto-navigation between pages.

**Key Features:**
- Listens for **named CustomEvents** to advance flows
- Auto-navigates to next page after step completion
- Tracks current flow state (flowId, stepIndex)

**Flow Sequences:**
```typescript
const FLOW_SEQUENCES: FlowMap = {
  onboarding: ['/macro-counter', '/my-biometrics', '/weekly-meal-board', '/shopping-list-v2'],
  careteam: ['/care-team', '/pro/clients', '/pro/clients/:id', '/my-biometrics'],
};
```

**Event Listeners (hardcoded):**
```typescript
// Onboarding flow
window.addEventListener('macro:saved', () => this.handleFlowStepComplete('/macro-counter'));
window.addEventListener('biometrics:weightSaved', () => this.handleFlowStepComplete('/my-biometrics'));
window.addEventListener('mealBuilder:planGenerated', () => this.handleFlowStepComplete('/weekly-meal-board'));
window.addEventListener('shoppingList:viewed', () => this.handleFlowStepComplete('/shopping-list-v2'));

// CareTeam flow
window.addEventListener('careteam:linked', () => this.handleFlowStepComplete('/care-team'));
window.addEventListener('pro:clientOpened', () => this.handleFlowStepComplete('/pro/clients'));
window.addEventListener('pro:macrosSent', () => this.handleFlowStepComplete('/pro/clients/:id'));
window.addEventListener('biometrics:saved', () => this.handleFlowStepComplete('/my-biometrics'));
```

**AutoNavigate Logic:**
Before auto-navigating, FlowOrchestrator checks if the current PageSegment has `autoNavigate: false`. If so, it skips navigation and lets the page handle routing manually:
```typescript
const currentSegment = getPageSegment(this.currentFlowId, pathname);
if (currentSegment && currentSegment.autoNavigate === false) {
  this.notifyListeners();
  return; // Skip auto-navigation
}
```

---

### 2. WalkthroughRegistry
**Location:** `client/src/components/copilot/WalkthroughRegistry.ts`

**Purpose:** Maps routes to walkthrough configurations.

**Config Structure:**
```typescript
interface WalkthroughConfig {
  mode: 'flow' | 'page';
  scriptId?: string;      // Maps to script in simpleWalkthroughFlows.ts
  flowId?: string;        // Maps to FLOW_SEQUENCES
  autoStartDelay?: number;
}
```

**Example Registration:**
```typescript
registerWalkthrough('/macro-counter', {
  mode: 'flow',
  flowId: 'onboarding',
  scriptId: 'macro-calculator',
  autoStartDelay: 500,
});
```

**PAGE_SCRIPTS (embedded in registry):**
```typescript
const PAGE_SCRIPTS: Record<string, any[]> = {
  'restaurant-guide': [
    { selector: '[data-walkthrough="restaurant-list"]', text: 'Browse your saved restaurants', showArrow: true },
  ],
};
```

---

### 3. simpleWalkthroughFlows.ts
**Location:** `client/src/components/copilot/simple-walkthrough/simpleWalkthroughFlows.ts`

**Purpose:** Defines walkthrough steps for each page in a flow.

**Critical Structure:**
```typescript
export interface WalkthroughStep {
  selector: string;       // CSS selector (NOT testId!)
  text?: string;
  showArrow?: boolean;
}

export interface PageSegment {
  route: string;              // Supports dynamic segments (e.g., '/pro/clients/:id')
  pageId: string;
  steps: WalkthroughStep[];
  completionEvent?: string;   // Event name FlowOrchestrator listens for
  nextRoute?: string;
  autoNavigate?: boolean;     // If false, page handles navigation manually
}
```

**Dynamic Route Matching:**
The system supports parameterized routes using `:param` syntax (e.g., `/pro/clients/:id`). A `matchRoute()` helper function is used across all three core files:
- **WalkthroughRegistry**: Match routes to find walkthrough configs
- **FlowOrchestrator**: Match routes to initialize and advance flows
- **simpleWalkthroughFlows**: Match routes to find page segments

Example:
- Pattern: `/pro/clients/:id`
- Actual path: `/pro/clients/123`
- Result: ✅ Match (`:id` acts as wildcard)

**AutoNavigate Flag:**
When `autoNavigate: false`, FlowOrchestrator skips automatic navigation and lets the page handle routing manually. This prevents conflicts when pages need to navigate to dynamic URLs (e.g., `/pro/clients/${clientId}`).

**Example (Macro Calculator):**
```typescript
{
  route: '/macro-counter',
  pageId: 'macro-calculator',
  steps: [
    {
      selector: '#goal-card',
      text: 'Pick your fitness goal - weight loss, maintenance, or muscle gain',
      showArrow: true
    },
    {
      selector: '#bodytype-card',
      text: 'Pick your body type - ectomorph burns fast, mesomorph is balanced, endomorph holds weight',
      showArrow: true
    },
    {
      selector: '#set-targets-button',
      text: 'Tap here to save your personalized macros',
      showArrow: true
    }
  ],
  completionEvent: 'macro:saved',
  nextRoute: '/my-biometrics',
  autoNavigate: true
}
```

**Key Points:**
- ✅ Uses **CSS selectors** (IDs, classes, data attributes)
- ✅ Supports **multiple fallback selectors** with commas
- ✅ Example: `'#save-weight-button, [data-testid="biometrics-save-weight-button"], [data-walkthrough="save-weight"]'`

---

### 4. Event Dispatch Pattern
**Location:** Pages fire events using this helper

**Helper Function:**
```typescript
// client/src/components/copilot/simple-walkthrough/SimpleWalkthroughFlowController.tsx
export function dispatchWalkthroughCompletion(eventName: string) {
  console.log("[SimpleWalkthrough] Dispatching completion:", eventName);
  window.dispatchEvent(new CustomEvent(eventName));
}
```

**Usage in Pages:**
```typescript
import { dispatchWalkthroughCompletion } from "@/components/copilot/simple-walkthrough/SimpleWalkthroughFlowController";

// When user completes the action (e.g., saves macros)
async function handleSave() {
  await saveMacros();
  dispatchWalkthroughCompletion("macro:saved");
  toast({ title: "Macros saved!" });
}
```

**Event Names:**
- Must match `completionEvent` in simpleWalkthroughFlows.ts
- Must have listener in FlowOrchestrator.ts
- Convention: `feature:action` (e.g., `macro:saved`, `biometrics:weightSaved`)

---

### 5. usePageWalkthrough Hook
**Location:** `client/src/hooks/usePageWalkthrough.ts`

**Purpose:** Automatically starts walkthroughs when Guided Mode is enabled.

**When it triggers:**
1. User navigates to a registered route
2. Guided Mode is ON
3. Waits for `autoStartDelay` (default 500ms)
4. Opens Copilot
5. Starts walkthrough after 3s

---

## How to Add a New Flow

### Example: Adding CareTeam Flow

**Step 1: Add to FLOW_SEQUENCES in FlowOrchestrator.ts**
```typescript
const FLOW_SEQUENCES: FlowMap = {
  onboarding: ['/macro-counter', '/my-biometrics', '/weekly-meal-board', '/shopping-list-v2'],
  careteam: ['/care-team', '/pro/clients', '/pro/clients/:id', '/my-biometrics'],  // NEW
};
```

**Step 2: Add Event Listeners in FlowOrchestrator constructor**
```typescript
window.addEventListener('careteam:linked', () => this.handleFlowStepComplete('/care-team'));
window.addEventListener('pro:clientOpened', () => this.handleFlowStepComplete('/pro/clients'));
window.addEventListener('pro:macrosSent', () => this.handleFlowStepComplete('/pro/clients/:id'));
window.addEventListener('biometrics:saved', () => this.handleFlowStepComplete('/my-biometrics'));
```

**Step 3: Add PageSegments to simpleWalkthroughFlows.ts**
```typescript
export const CARETEAM_FLOW: WalkthroughFlow = {
  id: 'careteam',
  name: 'Care Team Setup',
  pages: [
    {
      route: '/care-team',
      pageId: 'careteam-join',
      steps: [
        {
          selector: '[data-testid="input-careteam-code"]',
          text: 'Enter the code your coach gave you',
          showArrow: true
        },
        {
          selector: '[data-testid="button-submit-code"]',
          text: 'Tap Connect to link your account',
          showArrow: true
        }
      ],
      completionEvent: 'careteam:linked',
      nextRoute: '/pro/clients',
      autoNavigate: true  // FlowOrchestrator handles navigation
    },
    {
      route: '/pro/clients',
      pageId: 'pro-clients-list',
      steps: [
        {
          selector: '[data-testid="pro-client-row"]',
          text: 'This is your client list. Select the client you want to configure',
          showArrow: true
        },
        {
          selector: '[data-testid="button-open-client"]',
          text: "Tap Open to go to this client's dashboard",
          showArrow: true
        }
      ],
      completionEvent: 'pro:clientOpened',
      nextRoute: '/pro/clients/:id',
      autoNavigate: false  // Page handles navigation to /pro/clients/${id}
    },
    {
      route: '/pro/clients/:id',  // Dynamic route - matches /pro/clients/123
      pageId: 'pro-client-dashboard',
      steps: [
        {
          selector: '[data-testid="button-send-macros"]',
          text: 'Send your macros to this client',
          showArrow: true
        }
      ],
      completionEvent: 'pro:macrosSent',
      nextRoute: '/my-biometrics',
      autoNavigate: true
    },
    {
      route: '/my-biometrics',
      pageId: 'biometrics-page',
      steps: [
        {
          selector: '[data-testid="input-weight"]',
          text: 'Enter your weight',
          showArrow: true
        },
        {
          selector: '[data-testid="button-save-weight"]',
          text: 'Tap Save to complete',
          showArrow: true
        }
      ],
      completionEvent: 'biometrics:saved',
      autoNavigate: true
    }
  ]
};

export const ALL_FLOWS: Record<string, WalkthroughFlow> = {
  'onboarding': ONBOARDING_FLOW,
  'careteam': CARETEAM_FLOW,  // NEW
};
```

**Step 4: Register in WalkthroughRegistry.ts**
```typescript
export function registerCareTeamFlow(): void {
  registerWalkthrough('/care-team', {
    mode: 'flow',
    flowId: 'careteam',
    scriptId: 'careteam-join',
    autoStartDelay: 500,
  });

  registerWalkthrough('/pro/clients', {
    mode: 'flow',
    flowId: 'careteam',
    scriptId: 'pro-clients-list',
    autoStartDelay: 500,
  });

  // Dynamic route - uses :id placeholder
  registerWalkthrough('/pro/clients/:id', {
    mode: 'flow',
    flowId: 'careteam',
    scriptId: 'pro-client-dashboard',
    autoStartDelay: 500,
  });

  registerWalkthrough('/my-biometrics', {
    mode: 'flow',
    flowId: 'careteam',
    scriptId: 'biometrics-page',
    autoStartDelay: 500,
  });
}

// Call it at the bottom
registerCareTeamFlow();
```

**Step 5: Add Event Dispatches in Pages**
```typescript
// client/src/pages/CareTeam.tsx
import { dispatchWalkthroughCompletion } from "@/components/copilot/simple-walkthrough/SimpleWalkthroughFlowController";

async function handleConnectCode() {
  await connectWithCode();
  dispatchWalkthroughCompletion("careteam:linked");
}
```

---

## Critical Requirements for ChatGPT

### ✅ DO:
1. Use **CSS selectors** in steps (IDs, classes, `[data-testid="..."]`)
2. Use **named CustomEvents** for completion (e.g., `careteam:linked`)
3. Match event names between:
   - `completionEvent` in simpleWalkthroughFlows.ts
   - `addEventListener` in FlowOrchestrator.ts
   - `dispatchWalkthroughCompletion()` calls in pages
4. Add routes to `FLOW_SEQUENCES`
5. Register routes in WalkthroughRegistry
6. Use `dispatchWalkthroughCompletion(eventName)` helper

### ❌ DON'T:
1. Use `testId` or `waitFor` fields (not supported)
2. Use `emitWalkthrough()` (doesn't exist)
3. Reference testIds directly in step definitions
4. Create new event systems

---

## Selector Best Practices

**Multiple fallbacks (recommended):**
```typescript
selector: '#save-button, [data-testid="save-btn"], .save-button'
```

**Data attributes (recommended for clarity):**
```typescript
selector: '[data-testid="button-submit-code"]'
```

**IDs (fast, but less flexible):**
```typescript
selector: '#submit-button'
```

---

## Example Event Flow

1. User lands on `/macro-counter`
2. usePageWalkthrough detects registered route
3. Opens Copilot, starts walkthrough from simpleWalkthroughFlows.ts
4. User completes form, clicks "Set Targets"
5. Page fires: `dispatchWalkthroughCompletion("macro:saved")`
6. FlowOrchestrator receives `macro:saved` event
7. FlowOrchestrator navigates to `/my-biometrics`
8. Cycle repeats for next page

---

## Summary for ChatGPT

**Our system uses:**
- ✅ CSS selector-based step definitions
- ✅ Named CustomEvents for flow advancement
- ✅ dispatchWalkthroughCompletion() helper
- ✅ FlowOrchestrator for multi-page flows
- ✅ WalkthroughRegistry for route mapping
- ✅ simpleWalkthroughFlows for step content

**Our system does NOT use:**
- ❌ testId/waitFor fields in step definitions
- ❌ emitWalkthrough() helper
- ❌ walkthrough:event generic events
- ❌ Copilot state machines

**When creating scripts, follow the exact pattern shown in ONBOARDING_FLOW.**
