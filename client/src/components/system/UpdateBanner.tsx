import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return String(h);
}

export function UpdateBanner() {
  const message = (import.meta as any).env?.VITE_UPDATE_BANNER?.trim() || "";
  const id = useMemo(() => (message ? hashString(message) : ""), [message]);
  const storageKey = id ? `mpm_update_banner_dismissed_${id}` : "";

  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    setDismissed(localStorage.getItem(storageKey) === "1");
  }, [storageKey]);

  if (!message || dismissed) return null;

  return (
    <div className="w-full bg-black/80 border-b border-white/10 text-white">
      <div className="mx-auto max-w-6xl px-4 py-2 flex items-center gap-3">
        <div className="text-sm leading-5">
          <span className="font-semibold">Update:</span> {message}
        </div>

        <button
          className="ml-auto opacity-80 hover:opacity-100"
          onClick={() => {
            if (storageKey) localStorage.setItem(storageKey, "1");
            setDismissed(true);
          }}
          aria-label="Dismiss update banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
