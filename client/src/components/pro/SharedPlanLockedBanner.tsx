import { useState, useEffect } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { ShieldCheck } from "lucide-react";

export default function SharedPlanLockedBanner() {
  const [locked, setLocked] = useState<boolean | null>(null);

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch(
          apiUrl("/api/client/board-access-status"),
          { headers: { ...getAuthHeaders() }, credentials: "include" }
        );
        if (res.ok) {
          const data = await res.json();
          setLocked(!data.clientCanEdit);
        } else {
          setLocked(false);
        }
      } catch {
        setLocked(false);
      }
    }
    check();
  }, []);

  if (!locked) return null;

  return (
    <div className="rounded-xl bg-indigo-500/10 border border-indigo-400/20 px-4 py-3 flex items-start gap-3">
      <ShieldCheck className="w-4 h-4 text-indigo-300 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs font-semibold text-indigo-300">
          This plan is currently managed by your coach
        </p>
        <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed">
          You can review your meals and message your coach if changes are needed.
        </p>
      </div>
    </div>
  );
}
