import { useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { useLocation } from 'wouter';
import { useCopilot } from './CopilotContext';
import { getGuestPageExplanation } from './CopilotPageExplanations';
import { CopilotExplanationStore } from './CopilotExplanationStore';
import { shouldAllowAutoOpen } from './CopilotRespectGuard';
import { isGuestMode } from '@/lib/guestMode';

/**
 * Pages that form the App Library area of the app.
 * Co-Pilot mentions the amber bug-report icon once on first visit to any of these.
 */
const APP_LIBRARY_PAGES = new Set(['/learn', '/tutorials', '/tips', '/learning']);

const BUG_REPORT_INTRO_FLAG = 'bug-report-intro-seen';

const BUG_REPORT_INTRO_SENTENCE =
  ' One more thing — look for the amber bug icon in the top right corner of the app. ' +
  "That's the Report a Bug button. If something ever looks wrong or behaves unexpectedly, " +
  'tap it to send us a note. We check every report.';

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

    // Check if we already opened for THIS navigation session
    // This prevents re-opening after skip/close while still on same page
    if (CopilotExplanationStore.hasSessionOpened(normalizedPath)) return;

    // Get page explanation - use guest-specific marketing copy when in guest mode
    const explanation = getGuestPageExplanation(normalizedPath, isGuestMode());
    if (!explanation) return;

    // Clear any previous timer
    if (explanationTimerRef.current) {
      clearTimeout(explanationTimerRef.current);
      explanationTimerRef.current = null;
    }

    const triggerExplanation = () => {
      // Mark as opened for this session BEFORE opening
      // This prevents the infinite loop
      CopilotExplanationStore.markSessionOpened(normalizedPath);

      // On the first visit ever to any App Library page, append the bug-report intro.
      // Uses a persistent localStorage flag so it fires at most once across all sessions.
      let spokenText = explanation.spokenText;
      if (
        APP_LIBRARY_PAGES.has(normalizedPath) &&
        localStorage.getItem(BUG_REPORT_INTRO_FLAG) !== 'true'
      ) {
        spokenText = spokenText + BUG_REPORT_INTRO_SENTENCE;
        // Mark as seen so no other App Library page repeats it
        localStorage.setItem(BUG_REPORT_INTRO_FLAG, 'true');
      }

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
          spokenText,
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
