import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/apiRequest";

type SupportState = { enabled: boolean; legacyPreferenceSaved: boolean };
const endpoint = "/api/health-context/support/anti_inflammatory";

/** Account identity scopes local state, never server authorization. */
export function AntiInflammatorySupportControl({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const scope = useRef(0);
  const [state, setState] = useState<SupportState | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const accept = (value: unknown): SupportState => {
    const next = value as SupportState;
    if (typeof next?.enabled !== "boolean" || typeof next?.legacyPreferenceSaved !== "boolean") {
      throw new Error("Support settings could not be verified.");
    }
    return next;
  };
  const load = async (version: number) => {
    try {
      const next = accept(await apiRequest(endpoint, { cache: "no-store" }));
      if (scope.current === version) { setState(next); setLoadedFor(userId); setError(""); }
    } catch {
      if (scope.current === version) setError("Support settings could not be loaded. Please retry.");
    }
  };
  useEffect(() => {
    const version = ++scope.current;
    setState(null); setLoadedFor(null); setBusy(false); setError("");
    void load(version);
    return () => { scope.current++; };
  }, [userId]);

  const current = loadedFor === userId ? state : null;
  const change = async () => {
    if (!current || busy) return;
    const version = scope.current;
    setBusy(true); setError("");
    try {
      const next = accept(await apiRequest(endpoint, {
        method: "PUT", body: JSON.stringify({ enabled: !current.enabled }), cache: "no-store",
      }));
      if (scope.current !== version) return;
      setState(next);
      // Mark cached food/profile views stale without triggering unrelated
      // requests or changing the meals the member has already saved.
      await queryClient.invalidateQueries({ refetchType: "none" });
      window.dispatchEvent(new CustomEvent("mpm:conditionsUpdated"));
      window.dispatchEvent(new CustomEvent("mpm:dietaryUpdated"));
    } catch {
      if (scope.current === version) {
        setError("The change could not be confirmed. Reload settings before trying again.");
        setState(null); setLoadedFor(null);
      }
    } finally {
      if (scope.current === version) setBusy(false);
    }
  };
  return (
    <section className="rounded-lg border border-white/20 bg-black/30 p-3" aria-label="Anti-Inflammatory Support">
      <h3 className="text-white font-semibold text-sm">Anti-Inflammatory Support</h3>
      <p className="text-white/70 text-xs mt-1">
        Add Anti-Inflammatory ingredient guidance across supported food tools without changing your primary program.
        Allergies, dietary restrictions, diabetic, GLP-1, and clinical requirements still take precedence.
        The standalone Anti-Inflammatory Builder remains separate.
      </p>
      {current && <p role="status" className="text-white/80 text-xs mt-2">Optional support: {current.enabled ? "On" : "Off"}</p>}
      {current?.legacyPreferenceSaved && !current.enabled && (
        <p className="text-amber-200 text-xs mt-2">An earlier preference is saved but is not active. Enable support explicitly to apply it to new food guidance.</p>
      )}
      <div className="mt-3">
        <button type="button" aria-pressed={current?.enabled === true}
          className={`min-h-11 w-full sm:w-auto rounded-full border px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
            current?.enabled ? "border-emerald-400/60 bg-emerald-600/80" : "border-yellow-400/70 bg-yellow-500/20"
          }`}
          disabled={!current || busy} onClick={() => void change()}>
          {busy ? "Saving support…" : !current ? "Loading support…" : current.enabled ? "Turn off Anti-Inflammatory support" : "Enable Anti-Inflammatory support"}
        </button>
      </div>
      {error && <p role="alert" className="text-red-200 text-xs mt-2">{error} <button type="button" className="underline" onClick={() => void load(++scope.current)}>Reload settings</button></p>}
    </section>
  );
}
