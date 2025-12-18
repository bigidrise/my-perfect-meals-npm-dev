/**
 * Multi-Page Walkthrough Flow Configuration
 * 
 * Defines the complete walkthrough journey across multiple pages:
 * 1. Macro Calculator → 2. Biometrics → 3. Weekly Meal Builder → 4. Shopping List
 */

export interface WalkthroughStep {
  selector: string;
  text?: string;
  showArrow?: boolean;
}

export interface PageSegment {
  route: string;
  pageId: string;
  steps: WalkthroughStep[];
  completionEvent?: string;
  nextRoute?: string;
  autoNavigate?: boolean;
}

export interface WalkthroughFlow {
  id: string;
  name: string;
  pages: PageSegment[];
}

export const ONBOARDING_FLOW: WalkthroughFlow = {
  id: 'onboarding',
  name: 'Getting Started',
  pages: [
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
          selector: '#details-card',
          text: 'Enter your stats - age, height, weight, and activity level',
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
    },
    {
      route: '/my-biometrics',
      pageId: 'biometrics',
      steps: [
        {
          selector: '[data-testid="biometrics-save-weight-button"], #save-weight-button, [data-walkthrough="save-weight"]',
          text: 'Save your current body weight to track your progress',
          showArrow: true
        }
      ],
      completionEvent: 'biometrics:weightSaved',
      nextRoute: '/weekly-meal-board',
      autoNavigate: true
    },
    {
      route: '/weekly-meal-board',
      pageId: 'weekly-meal-builder',
      steps: [
        {
          selector: '[data-walkthrough="day-chip"], [data-testid="day-chip"], .day-chip',
          text: 'Pick a day to start planning your meals',
          showArrow: true
        },
        {
          selector: '[data-walkthrough="add-meal"], [data-testid="add-meal-button"], button:has(.plus-icon)',
          text: 'Tap to add a meal - breakfast, lunch, dinner, or snacks',
          showArrow: true
        }
      ],
      completionEvent: 'mealBuilder:planGenerated',
      nextRoute: '/shopping-list-v2',
      autoNavigate: true
    },
    {
      route: '/shopping-list-v2',
      pageId: 'shopping-list',
      steps: [
        {
          selector: '[data-testid="shopping-summary-card"]',
          text: 'Here is your shopping list summary with all your ingredients',
          showArrow: true
        },
        {
          selector: '[data-testid="shopping-list"]',
          text: 'Your ingredients organized by category - check them off as you shop',
          showArrow: true
        },
        {
          selector: '[data-testid="shopping-send-to-store"]',
          text: 'Send your list to your favorite store for easy pickup or delivery',
          showArrow: true
        }
      ],
      completionEvent: 'shoppingList:viewed'
    }
  ]
};

export const CARETEAM_FLOW: WalkthroughFlow = {
  id: 'careteam',
  name: 'Care Team Setup',
  pages: [
    {
      route: '/care-team',
      pageId: 'careteam-join',
      steps: [
        {
          selector: '[data-testid="input-careteam-code"], #careteam-code-input',
          text: 'Enter the code your coach or doctor gave you',
          showArrow: true
        },
        {
          selector: '[data-testid="button-submit-code"], #careteam-submit-button',
          text: 'Tap Connect to link your account to your professional',
          showArrow: true
        }
      ],
      completionEvent: 'careteam:linked',
      nextRoute: '/pro/clients',
      autoNavigate: true
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
      autoNavigate: false
    },
    {
      route: '/pro/clients/:id',
      pageId: 'pro-client-dashboard',
      steps: [
        {
          selector: '[data-testid="form-client-macros"], #client-macros-form',
          text: "Set your client's calories, protein, carbs, and fats here",
          showArrow: true
        },
        {
          selector: '[data-testid="button-save-macros"], #button-save-macros',
          text: 'Tap Save to store these targets',
          showArrow: true
        },
        {
          selector: '[data-testid="button-send-macros-to-biometrics"]',
          text: "Now push these macros into the client's biometrics so the app can use them everywhere",
          showArrow: true
        }
      ],
      completionEvent: 'pro:macrosSent',
      nextRoute: '/my-biometrics',
      autoNavigate: true
    },
    {
      route: '/my-biometrics',
      pageId: 'biometrics-careteam',
      steps: [
        {
          selector: '[data-testid="section-biometrics-summary"], #biometrics-summary',
          text: 'Review your biometrics and the targets your coach set',
          showArrow: true
        },
        {
          selector: '[data-testid="button-save-biometrics"], #save-biometrics-button, #save-weight-button',
          text: 'Tap Save to confirm everything',
          showArrow: true
        }
      ],
      completionEvent: 'biometrics:saved',
      autoNavigate: false
    }
  ]
};

export const ALL_FLOWS: Record<string, WalkthroughFlow> = {
  'onboarding': ONBOARDING_FLOW,
  'careteam': CARETEAM_FLOW
};

export function getFlowById(flowId: string): WalkthroughFlow | undefined {
  return ALL_FLOWS[flowId];
}

/**
 * Match a pathname against a route pattern (supports :param syntax)
 */
function matchRoute(pattern: string, pathname: string): boolean {
  const patternParts = pattern.split('/');
  const pathParts = pathname.split('/');
  
  if (patternParts.length !== pathParts.length) return false;
  
  return patternParts.every((part, i) => {
    return part.startsWith(':') || part === pathParts[i];
  });
}

export function getPageSegment(flowId: string, route: string): PageSegment | undefined {
  const flow = getFlowById(flowId);
  if (!flow) return undefined;
  
  // Try exact match first
  let page = flow.pages.find(p => p.route === route);
  
  // If no exact match, try pattern matching for dynamic routes
  if (!page) {
    page = flow.pages.find(p => matchRoute(p.route, route));
  }
  
  return page;
}

export function getNextPageSegment(flowId: string, currentRoute: string): PageSegment | undefined {
  const flow = getFlowById(flowId);
  if (!flow) return undefined;
  
  // Try exact match first
  let currentIndex = flow.pages.findIndex(p => p.route === currentRoute);
  
  // If no exact match, try pattern matching for dynamic routes
  if (currentIndex === -1) {
    currentIndex = flow.pages.findIndex(p => matchRoute(p.route, currentRoute));
  }
  
  if (currentIndex === -1 || currentIndex >= flow.pages.length - 1) return undefined;
  return flow.pages[currentIndex + 1];
}
