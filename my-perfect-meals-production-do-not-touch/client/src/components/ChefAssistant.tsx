// client/src/components/ChefAssistant.tsx
import { useEffect, useRef, useState } from "react";
import { X, ChefHat } from "lucide-react";

interface ChefAssistantProps {
  avatarSrc: string;        // URL to your chef avatar image/gif
  autoHideMs?: number;      // default 10000 (10s)
  bubbleWidth?: number;     // default 280
  initialOpen?: boolean;    // default true
  title?: string;           // default "Chef Assistant"
  note?: string;            // small line under title
}

export default function ChefAssistant({
  avatarSrc,
  autoHideMs = 10000,
  bubbleWidth = 280,
  initialOpen = true,
  title = "Chef Assistant",
  note = "Tap the chef hat anytime to bring me back.",
}: ChefAssistantProps) {
  // Visible = chef bubble is on screen
  const [visible, setVisible] = useState<boolean>(initialOpen);
  // HatVisible = small chef-hat FAB is shown (when bubble is hidden)
  const [hatVisible, setHatVisible] = useState<boolean>(!initialOpen);

  const hideTimer = useRef<number | null>(null);

  // Handle the auto-hide timer when the chef is visible
  useEffect(() => {
    if (!visible) return;
    // If autoHideMs <= 0, keep the bubble open (no auto-hide)
    if (!autoHideMs || autoHideMs <= 0) {
      setHatVisible(false);
      return;
    }
    setHatVisible(false); // while chef shown, hide hat
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      setVisible(false);
      setHatVisible(true); // show hat when chef hides
    }, autoHideMs);

    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [visible, autoHideMs]);

  const openChef = () => {
    setVisible(true);
    setHatVisible(false);
  };

  const closeChef = () => {
    setVisible(false);
    setHatVisible(true);
  };

  return (
    // Make the wrapper not intercept pointer events.
    // Only specific children enable pointer-events where needed.
    <div aria-live="polite" className="pointer-events-none">
      {/* Chef-hat FAB (shortcut) */}
      {hatVisible && (
        // Visible glass disc that is MOSTLY pass-through
        <div
          className="pointer-events-none fixed z-40 bottom-[calc(env(safe-area-inset-bottom)+16px)] right-4 md:bottom-6 md:right-6
                     h-12 w-12 md:h-12 md:w-12 rounded-full
                     bg-white/10 backdrop-blur-md backdrop-saturate-150
                     ring-1 ring-gray-400/30 shadow-lg"
        >
          {/* Small inner clickable button only around the icon */}
          <button
            aria-label="Open Chef Assistant"
            onClick={openChef}
            className="pointer-events-auto absolute inset-0 m-auto h-7 w-7 rounded-full
                       flex items-center justify-center text-gray-600 bg-transparent hover:bg-gray-500/20
                       focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400/40"
            style={{ inset: 0 }}
          >
            <ChefHat className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Chef bubble */}
      <div
        className={`pointer-events-${visible ? "auto" : "none"} fixed z-40 bottom-[calc(env(safe-area-inset-bottom)+16px)] right-4 md:bottom-6 md:right-6 transition-all duration-300 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
        style={{ width: bubbleWidth }}
        role="dialog"
        aria-modal="false"
        aria-label="Chef assistant"
      >
        <div className="rounded-2xl border border-white/20 bg-white/10
                        backdrop-blur-xl backdrop-saturate-150 shadow-xl p-3
                        flex items-center gap-3">
          <img
            src={avatarSrc}
            alt="Chef avatar"
            className="h-16 w-16 rounded-xl object-cover"
          />
          <div className="flex-1 min-w-0">
            {/* Clean, no corny phrase */}
            <div className="text-sm font-semibold">{title}</div>
            {note ? (
              <div className="text-xs text-white/80">{note}</div>
            ) : null}
          </div>
          <button
            aria-label="Close"
            onClick={closeChef}
            className="pointer-events-auto shrink-0 p-1 rounded-md hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}