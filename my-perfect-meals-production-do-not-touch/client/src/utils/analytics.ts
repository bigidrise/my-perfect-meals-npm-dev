// Analytics tracking for Plan Builder usage patterns

export interface AnalyticsEvent {
  event: string;
  properties: Record<string, any>;
  timestamp?: Date;
}

class AnalyticsManager {
  private events: AnalyticsEvent[] = [];
  
  track(event: string, properties: Record<string, any> = {}) {
    const analyticsEvent: AnalyticsEvent = {
      event,
      properties,
      timestamp: new Date()
    };
    
    this.events.push(analyticsEvent);
    
    // In a real app, you would send this to your analytics service
    console.log('📊 Analytics Event:', analyticsEvent);
    
    // Store in localStorage for development/testing
    this.persistEvents();
  }
  
  private persistEvents() {
    try {
      localStorage.setItem('analytics_events', JSON.stringify(this.events.slice(-100))); // Keep last 100 events
    } catch (error) {
      console.warn('Failed to persist analytics events:', error);
    }
  }
  
  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }
  
  clearEvents() {
    this.events = [];
    localStorage.removeItem('analytics_events');
  }
}

export const analytics = new AnalyticsManager();

// Plan Builder specific event tracking functions
export const trackPlanBuilderEvents = {
  // Flow selection
  flowView: (flow: 'classic' | 'turbo') => {
    analytics.track('plan_builder_flow_view', { flow });
  },
  
  // Classic flow events
  classicStepView: (step: number) => {
    analytics.track('plan_builder_classic_step_view', { step });
  },
  
  classicStepComplete: (step: number, timeSpent: number) => {
    analytics.track('plan_builder_classic_step_complete', { step, timeSpent });
  },
  
  classicMealSelected: (mealType: string, mealId: string) => {
    analytics.track('plan_builder_classic_meal_selected', { mealType, mealId });
  },
  
  // Turbo flow events
  turboGenerate: (targets: any) => {
    analytics.track('plan_builder_turbo_generate', { targets });
  },
  
  turboGenerateComplete: (timeSpent: number, success: boolean) => {
    analytics.track('plan_builder_turbo_generate_complete', { timeSpent, success });
  },
  
  turboMealReplace: (day: string, mealType: string, oldMealId: string, newMealId: string) => {
    analytics.track('plan_builder_turbo_meal_replace', { 
      day, 
      mealType, 
      oldMealId, 
      newMealId 
    });
  },
  
  // Plan saving
  planSaved: (flow: 'classic' | 'turbo', totalTime: number, planData: any) => {
    analytics.track('plan_saved', { 
      flow, 
      totalTime,
      mealCount: planData.mealCount || 0,
      uniqueMeals: planData.uniqueMeals || 0
    });
  },
  
  // User interactions
  backToHub: (flow: 'classic' | 'turbo', currentStep?: number) => {
    analytics.track('plan_builder_back_to_hub', { flow, currentStep });
  },
  
  stepNavigation: (flow: 'classic' | 'turbo', fromStep: number, toStep: number) => {
    analytics.track('plan_builder_step_navigation', { flow, fromStep, toStep });
  }
};

// A/B Testing support
export interface ABTestConfig {
  testName: string;
  variants: string[];
  defaultVariant: string;
}

export function getABTestVariant(testName: string): string {
  // Check URL parameters first
  const urlParams = new URLSearchParams(window.location.search);
  const urlVariant = urlParams.get('ab');
  if (urlVariant) {
    analytics.track('ab_test_variant_assigned', { 
      testName, 
      variant: urlVariant, 
      source: 'url_param' 
    });
    return urlVariant;
  }
  
  // Check localStorage for consistent assignment
  const storageKey = `ab_test_${testName}`;
  const storedVariant = localStorage.getItem(storageKey);
  if (storedVariant) {
    return storedVariant;
  }
  
  // Random assignment (50/50 split for classic vs turbo)
  const variant = Math.random() < 0.5 ? 'classic' : 'turbo';
  localStorage.setItem(storageKey, variant);
  
  analytics.track('ab_test_variant_assigned', { 
    testName, 
    variant, 
    source: 'random_assignment' 
  });
  
  return variant;
}

// Export for external analytics integration
export function getAnalyticsData() {
  return {
    events: analytics.getEvents(),
    summary: generateAnalyticsSummary()
  };
}

function generateAnalyticsSummary() {
  const events = analytics.getEvents();
  
  const flowViews = events.filter(e => e.event === 'plan_builder_flow_view');
  const classicViews = flowViews.filter(e => e.properties.flow === 'classic').length;
  const turboViews = flowViews.filter(e => e.properties.flow === 'turbo').length;
  
  const plansSaved = events.filter(e => e.event === 'plan_saved');
  const classicSaves = plansSaved.filter(e => e.properties.flow === 'classic').length;
  const turboSaves = plansSaved.filter(e => e.properties.flow === 'turbo').length;
  
  return {
    totalEvents: events.length,
    flowViews: { classic: classicViews, turbo: turboViews },
    plansSaved: { classic: classicSaves, turbo: turboSaves },
    conversionRate: {
      classic: classicViews > 0 ? (classicSaves / classicViews * 100).toFixed(1) + '%' : '0%',
      turbo: turboViews > 0 ? (turboSaves / turboViews * 100).toFixed(1) + '%' : '0%'
    }
  };
}