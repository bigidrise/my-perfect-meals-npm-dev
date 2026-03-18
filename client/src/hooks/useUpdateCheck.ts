import { useEffect, useState } from "react";
import { BUILD_VERSION } from "@/buildVersion";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function useUpdateCheck() {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/release-manifest.json?ts=" + Date.now(), { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.version && data.version !== BUILD_VERSION && BUILD_VERSION !== "dev") {
          setShowUpdate(true);
        }
      } catch {}
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return showUpdate;
}
