
/**
 * Universal scroll to top utility
 * Handles all possible scroll containers and edge cases
 */
export function scrollToTop(behavior: ScrollBehavior = "instant") {
  // Handle custom app scroller
  const scrollerEl = document.getElementById("appScroll");
  if (scrollerEl) {
    scrollerEl.scrollTo({ top: 0, left: 0, behavior });
  }

  // Always handle window scroll
  window.scrollTo({ top: 0, left: 0, behavior });

  // Handle document.documentElement
  if (document.documentElement && document.documentElement.scrollTo) {
    document.documentElement.scrollTo({ top: 0, left: 0, behavior });
  }

  // Handle document.body as fallback
  if (document.body) {
    document.body.scrollTop = 0;
  }

  // Force repaint to ensure scroll position is applied
  if (behavior === "instant") {
    document.body.offsetHeight;
  }
}

/**
 * Enhanced scroll to top with multiple attempts
 * Use this for navigation scenarios where timing is critical
 */
export function forceScrollToTop(location?: string) {
  const executeScroll = () => scrollToTop("instant");

  // Clear any stored scroll positions
  if (location) {
    sessionStorage.removeItem(`scroll:${location}`);
  }

  // Execute immediately
  executeScroll();

  // Execute after DOM updates
  requestAnimationFrame(() => {
    requestAnimationFrame(executeScroll);
  });

  // Final safety check
  setTimeout(executeScroll, 50);
}
