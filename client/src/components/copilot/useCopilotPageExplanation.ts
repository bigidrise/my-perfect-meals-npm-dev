import { useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { useLocation } from 'wouter';
import { useCopilot } from './CopilotContext';
import { getPageExplanation } from './CopilotPageExplanations';
import { CopilotExplanationStore } from './CopilotExplanationStore';
import { shouldAllowAutoOpen } from './CopilotRespectGuard';

/**
 * Hook that triggers page explanations when navigating to new pages.
 * 
 * Auto-close is now handled by CopilotSheet based on actual audio completion
 * events rather than word-count estimates. This hook just:
 * 1. Checks if the page should show an explanation
 * 2. Opens the Copilot sheet
 * 3. Sets the response with autoClose: true flag
 * 
 * CopilotSheet listens for TTS onEnd events and closes the sheet when audio finishes.
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

  // Main explanation effect
  useEffect(() => {
    if (!shouldAllowAutoOpen()) return;

    const normalizedPath = normalizePath(pathname);

    // Don't re-run for already explained paths
    if (CopilotExplanationStore.hasExplained(normalizedPath)) return;

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
        // Mark path as explained ONLY after successfully firing
        CopilotExplanationStore.markExplained(normalizedPath);

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
