import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useCopilot } from './CopilotContext';
import { getPageExplanation } from './CopilotPageExplanations';
import { shouldAllowAutoOpen } from './CopilotRespectGuard';

/**
 * Hook that triggers page explanations when navigating to new pages.
 * 
 * PERSISTENT ASSISTANT MODEL:
 * - When Guide mode is ON, Copilot auto-opens on EVERY page visit
 * - User can close it, but navigating away and back will re-open it
 * - Closing the sheet does NOT disable Copilot globally
 * - Only the Guide toggle controls whether auto-open is enabled
 * 
 * This is the "always available, never intrusive" pattern:
 * - Auto-opens visually (page-aware)
 * - Never auto-talks (user must tap Listen)
 * - User-controlled (can close anytime)
 * - Default-present (opens again on next navigation)
 */
export function useCopilotPageExplanation() {
  const [pathname] = useLocation();
  const { isOpen, open, setLastResponse } = useCopilot();
  const explanationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Normalize path helper
  const normalizePath = useCallback((path: string) => {
    return path.replace(/\/+$/, '').split('?')[0];
  }, []);

  // Main explanation effect
  // When Guide mode is ON, Copilot auto-opens on EVERY page visit (not just first visit)
  // User can close it, but navigating away and back will re-open it
  // This is the "persistent assistant" model - always available, never intrusive
  useEffect(() => {
    if (!shouldAllowAutoOpen()) return;

    const normalizedPath = normalizePath(pathname);

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
  }, [pathname, isOpen, open, setLastResponse, normalizePath]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (explanationTimerRef.current) {
        clearTimeout(explanationTimerRef.current);
      }
    };
  }, []);
}
