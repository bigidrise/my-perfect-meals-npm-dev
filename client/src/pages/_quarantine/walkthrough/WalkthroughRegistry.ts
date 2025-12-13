type WalkthroughMode = 'flow' | 'page';

export interface WalkthroughConfig {
  mode: WalkthroughMode;
  scriptId?: string;
  flowId?: string;
  autoStartDelay?: number;
}

const registry: Record<string, WalkthroughConfig> = {};

const PAGE_SCRIPTS: Record<string, any[]> = {
  'restaurant-guide': [
    { selector: '[data-testid="restaurant-guide-form"]', text: 'Tell us what you are craving and where you want to eat', showArrow: true },
    { selector: '[data-testid="restaurant-guide-craving"]', text: 'Type your craving here - pizza, sushi, healthy salad, anything!', showArrow: true },
    { selector: '[data-testid="restaurant-guide-restaurant"]', text: 'Enter the restaurant name or let us suggest one', showArrow: true },
    { selector: '[data-testid="restaurant-guide-search"]', text: 'Tap Search to find the best meal options for you', showArrow: true },
  ],
  'craving-creator': [
    { selector: '[data-testid="cravingcreator-input-box"]', text: 'Describe what you are craving - be as specific as you like!', showArrow: true },
    { selector: '[data-testid="cravingcreator-create-button"]', text: 'Tap Create to generate a meal that satisfies your craving', showArrow: true },
    { selector: '[data-testid="cravingcreator-results"]', text: 'Your personalized meal will appear here with full nutrition info', showArrow: true },
  ],
  'shopping-list': [
    { selector: '[data-testid="shopping-summary-card"]', text: 'Here is your shopping list summary with all your ingredients', showArrow: true },
    { selector: '[data-testid="shopping-list"]', text: 'Your ingredients organized by category - check them off as you shop', showArrow: true },
    { selector: '[data-testid="shopping-send-to-store"]', text: 'Send your list to your favorite store for easy pickup or delivery', showArrow: true },
  ],
};

export function getPageScript(scriptId: string): any[] | null {
  return PAGE_SCRIPTS[scriptId] || null;
}

export function registerWalkthrough(pathname: string, config: WalkthroughConfig): void {
  registry[pathname] = config;
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

export function getWalkthroughConfig(pathname: string): WalkthroughConfig | null {
  // First try exact match
  if (registry[pathname]) return registry[pathname];
  
  // Then try pattern matching for dynamic routes
  for (const [pattern, config] of Object.entries(registry)) {
    if (matchRoute(pattern, pathname)) {
      return config;
    }
  }
  
  return null;
}

export function registerOnboardingFlow(): void {
  registerWalkthrough('/macro-counter', {
    mode: 'flow',
    flowId: 'onboarding',
    scriptId: 'macro-calculator',
    autoStartDelay: 500,
  });

  registerWalkthrough('/my-biometrics', {
    mode: 'flow',
    flowId: 'onboarding',
    scriptId: 'biometrics',
    autoStartDelay: 500,
  });

  registerWalkthrough('/weekly-meal-board', {
    mode: 'flow',
    flowId: 'onboarding',
    scriptId: 'weekly-meal-builder',
    autoStartDelay: 500,
  });

  registerWalkthrough('/shopping-list-v2', {
    mode: 'flow',
    flowId: 'onboarding',
    scriptId: 'shopping-list',
    autoStartDelay: 500,
  });
}

export function registerPageWalkthroughs(): void {
  registerWalkthrough('/restaurant-guide', {
    mode: 'page',
    scriptId: 'restaurant-guide',
    autoStartDelay: 500,
  });

  registerWalkthrough('/craving-creator', {
    mode: 'page',
    scriptId: 'craving-creator',
    autoStartDelay: 500,
  });

  registerWalkthrough('/shopping-list', {
    mode: 'page',
    scriptId: 'shopping-list',
    autoStartDelay: 500,
  });
}

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

  registerWalkthrough('/pro/clients/:id', {
    mode: 'flow',
    flowId: 'careteam',
    scriptId: 'pro-client-dashboard',
    autoStartDelay: 500,
  });
}

registerOnboardingFlow();
registerPageWalkthroughs();
registerCareTeamFlow();
