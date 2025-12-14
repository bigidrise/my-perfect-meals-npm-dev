export function saveScrollPosition(key: string) {
  localStorage.setItem(`scroll-${key}`, window.scrollY.toString());
}

export function restoreScrollPosition(key: string) {
  const scrollY = parseInt(localStorage.getItem(`scroll-${key}`) || "0", 10);
  window.scrollTo({ top: scrollY, behavior: "smooth" });
}

export function saveNavigationHistory(from: string, to: string) {
  localStorage.setItem("navFrom", from);
  localStorage.setItem("navTo", to);
}

// Enhanced scroll management for contextual navigation
export function saveNavigationContext(currentPage: string, scrollPosition: number, targetPage: string) {
  const navigationContext = {
    from: currentPage,
    to: targetPage,
    scrollPosition: scrollPosition,
    timestamp: Date.now()
  };
  localStorage.setItem('navigationContext', JSON.stringify(navigationContext));
}

export function getNavigationContext(): { from: string; to: string; scrollPosition: number; timestamp: number } | null {
  const context = localStorage.getItem('navigationContext');
  if (!context) return null;
  
  try {
    const parsed = JSON.parse(context);
    // Clear context if it's older than 30 seconds to prevent stale navigation
    if (Date.now() - parsed.timestamp > 30000) {
      localStorage.removeItem('navigationContext');
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearNavigationContext() {
  localStorage.removeItem('navigationContext');
}

// Calculate appropriate scroll position for dashboard based on origin
export function getDashboardScrollPosition(fromPage: string): number {
  // Map of pages to their corresponding dashboard sections
  const dashboardSections: { [key: string]: string } = {
    '/why-vs-what': 'home-section',
    '/enhanced-shopping': 'shopping-section', 
    '/shopping-list': 'shopping-section',
    '/meal-planning': 'meal-planning-section',
    '/craving-creator': 'meal-planning-section',
    '/ai-meal-creator': 'meal-planning-section',
    '/track-water': 'wellness-section',
    '/body-composition': 'wellness-section',
    '/cycle-tracking': 'wellness-section'
  };

  const targetSection = dashboardSections[fromPage];
  if (!targetSection) return 0; // Default to top if no specific section

  // Try to find the section element and return its position
  setTimeout(() => {
    const element = document.getElementById(targetSection);
    if (element) {
      const offsetTop = element.offsetTop - 100; // Account for header
      window.scrollTo({ top: offsetTop, behavior: 'smooth' });
    }
  }, 100); // Small delay to ensure DOM is ready

  return 0; // Return 0 for immediate use, actual scrolling happens in setTimeout
}
