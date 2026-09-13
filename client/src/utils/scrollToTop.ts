
/**
 * Universal scroll to top utility
 * Handles all possible scroll containers and edge cases
 */
export function scrollToTop(behavior: ScrollBehavior = "instant") {
  // RootViewport is the app's authoritative page scroller.
  const rootViewport = document.getElementById("root-viewport");
  if (rootViewport) {
    rootViewport.scrollTo({ top: 0, left: 0, behavior });
    return;
  }

  // Legacy custom scroller fallback.
  const legacyScroller = document.getElementById("appScroll");
  if (legacyScroller) {
    legacyScroller.scrollTo({ top: 0, left: 0, behavior });
    return;
  }

  // Document scrolling is only a fallback for pages outside RootViewport.
  window.scrollTo({ top: 0, left: 0, behavior });

  // Handle document.documentElement
  if (document.documentElement && document.documentElement.scrollTo) {
    document.documentElement.scrollTo({ top: 0, left: 0, behavior });
  }

  // Handle document.body as fallback
  if (document.body) {
    document.body.scrollTop = 0;
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
