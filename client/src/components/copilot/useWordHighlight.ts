import { useEffect, useRef, useState } from "react";

/**
 * useWordHighlight
 *
 * Advances a word index in sync with audio playback (or at a fixed reading
 * pace when in text-only mode). Used by CopilotSheet to render synchronized
 * closed-caption-style text while Copilot speaks.
 *
 * @param spokenText      - The full text being spoken / displayed
 * @param isActive        - True while audio is playing OR text-only mode is running
 * @param audioDurationMs - Duration of the audio clip in ms. Pass null for text-only
 *                          mode (falls back to 150 WPM fixed pace).
 */
export function useWordHighlight(
  spokenText: string | undefined,
  isActive: boolean,
  audioDurationMs: number | null,
) {
  const words = (spokenText ?? "").split(/\s+/).filter(Boolean);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    if (!isActive || words.length === 0) {
      clearTimer();
      if (!isActive) setCurrentWordIndex(-1);
      return;
    }

    // 150 WPM ≈ 400ms per word (comfortable reading pace for text-only mode)
    // When audio duration is known, pace to exactly match the clip length
    const msPerWord =
      audioDurationMs !== null
        ? Math.max(80, audioDurationMs / words.length)
        : 400;

    setCurrentWordIndex(0);
    let idx = 0;

    intervalRef.current = setInterval(() => {
      idx++;
      if (idx >= words.length) {
        clearTimer();
        setCurrentWordIndex(words.length); // Show all words as "past"
      } else {
        setCurrentWordIndex(idx);
      }
    }, msPerWord);

    return clearTimer;
  }, [isActive, spokenText, audioDurationMs]); // eslint-disable-line react-hooks/exhaustive-deps

  return { words, currentWordIndex };
}
