import { useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { useLocation } from 'wouter';
import { useCopilot } from './CopilotContext';
import { getPageExplanation } from './CopilotPageExplanations';
import { CopilotExplanationStore } from './CopilotExplanationStore';
import { shouldAllowAutoOpen } from './CopilotRespectGuard';

/**
 * Hook that triggers page explanations when navigating to new pages.
 * 
 * AUTO-OPEN BEHAVIOR:
 * - When Guide mode is ON, Copilot auto-opens ONCE per page (first visit in session)
 * - After auto-opening, it won't auto-open again for that page
 * - User can manually press the Copilot button to see the explanation anytime
 * - Never auto-talks (user must tap Listen)
 * 
 * The CopilotButton provides on-demand access to page explanations at any time.
 */
export function useCopilotPageExplanation() {
  const [pathname] = useLocation();
  const { isOpen, open, setLastResponse } = useCopilot();
  const explanationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to explanation store changes
  const storeVersion = useSyncExternalStore(
    CopilotExplanationStore.subscribe.bind(CopilotExplanationStore),
    CopilotExplanationStore.getSnapshot.bind(CopilotExplanationStore)
  );

  // Normalize path helper
  const normalizePath = useCallback((path: string) => {
    return path.replace(/\/+$/, '').split('?')[0];
  }, []);

  // Main explanation effect - auto-opens on EVERY page visit
  // ONLY blocked if user explicitly turned off that specific page via "Turn Off" button
  useEffect(() => {
    if (!shouldAllowAutoOpen()) return;

    const normalizedPath = normalizePath(pathname);

    // Check if user has permanently disabled auto-open for this specific page
    // This is the ONLY thing that prevents auto-open (besides global Guide toggle)
    if (CopilotExplanationStore.isPathDisabled(normalizedPath)) return;

    // Get page explanation
    const explanation = getPageExplanation(normalizedPath);
    if (!explanation) return;

    // Clear any previous timer
    if (explanationTimerRef.current) {
      clearTimeout(explanationTimerRef.current);
      explanationTimerRef.current = null;
    }

    const triggerExplanation = () => {
      // Open Copilot if it's not already open
      if (!isOpen) {
        open();
      }

      // Small delay so the sheet is visually open before we push text/voice
      setTimeout(() => {
        // Set response with autoClose flag - CopilotSheet handles the timing
        // based on actual audio completion events
        setLastResponse({
          title: explanation.title,
          description: explanation.description,
          spokenText: explanation.spokenText,
          autoClose: explanation.autoClose ?? true, // Default to auto-close for explanations
        });
      }, 300);
    };

    explanationTimerRef.current = setTimeout(triggerExplanation, 800);

    return () => {
      if (explanationTimerRef.current) {
        clearTimeout(explanationTimerRef.current);
        explanationTimerRef.current = null;
      }
    };
  }, [pathname, isOpen, open, setLastResponse, normalizePath, storeVersion]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (explanationTimerRef.current) {
        clearTimeout(explanationTimerRef.current);
      }
    };
  }, []);
}
