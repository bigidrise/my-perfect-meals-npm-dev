/**
 * BugReportModal — compact report-a-bug form.
 *
 * Attaches sanitized diagnostics (when user opts in), authenticated user context,
 * current route, build version, and environment before submitting to
 * POST /api/bug-reports.
 *
 * Rules:
 * - Require authentication (button is hidden for guests anyway, but double-checked here)
 * - Diagnostics are in-memory only; never read from localStorage
 * - Never include passwords, tokens, request/response bodies, cookies, payment data,
 *   medical/chat/meal contents
 * - Email failure never destroys a successfully stored report (server handles this)
 * - Prevent double submission while processing
 * - Show success only after server confirms DB insert
 */

import { useState } from "react";
import { Bug, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { BUILD_VERSION } from "@/buildVersion";
import { snapshotDiagnostics } from "@/lib/diagnosticsBuffer";
import { apiRequest } from "@/lib/queryClient";

interface Props {
  open:    boolean;
  onClose: () => void;
}

type Phase = "form" | "submitting" | "success" | "error";

export function BugReportModal({ open, onClose }: Props) {
  const { user } = useAuth();

  const [description,        setDescription]        = useState("");
  const [intent,             setIntent]             = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [phase,              setPhase]              = useState<Phase>("form");
  const [serverError,        setServerError]        = useState<string | null>(null);

  function handleClose() {
    if (phase === "submitting") return; // block dismiss while in flight
    setDescription("");
    setIntent("");
    setIncludeDiagnostics(true);
    setPhase("form");
    setServerError(null);
    onClose();
  }

  async function handleSubmit() {
    if (!description.trim() || phase === "submitting") return;

    // Proactively detect a fully-cleared session before touching the network.
    // The button is hidden for guests, but the session can vanish while the
    // modal is already open. Catching this here avoids a round-trip 401 and
    // gives a cleaner message while keeping the typed text intact.
    if (!user) {
      setServerError(
        "Your session expired before the report could be sent. Your text is still here — please log back in and hit Send Report again.",
      );
      setPhase("error");
      return;
    }

    setPhase("submitting");
    setServerError(null);

    const diagnostics = includeDiagnostics ? snapshotDiagnostics() : null;

    const payload = {
      description:        description.trim(),
      intent:             intent.trim() || null,
      includeDiagnostics,
      diagnostics,
      route:              window.location.pathname,
      buildVersion:       BUILD_VERSION,
      environment:        import.meta.env.MODE ?? "unknown",
      userAgent:          navigator.userAgent,
    };

    try {
      await apiRequest("/api/bug-reports", {
        method: "POST",
        body:   JSON.stringify(payload),
      });
      setPhase("success");
    } catch (err: any) {
      console.error("[BugReportModal] submission failed:", err);

      // Detect session expiry (401) and show a targeted message.
      // The report text is intentionally preserved in the modal so the user
      // can log back in and re-submit without retyping.
      const is401 =
        err instanceof Error &&
        (err.message.startsWith("401:") || err.message === "401");

      setServerError(
        is401
          ? "Your session expired before the report could be sent. Your text is still here — please log back in and hit Send Report again."
          : "Something went wrong sending your report. Please try again.",
      );
      setPhase("error");
    }
  }

  // Pre-fill name from auth context
  const displayName = user?.name || user?.firstName || "";

  return (
    <Dialog open={open} onOpenChange={open ? handleClose : undefined}>
      <DialogContent showCloseButton={false} className="max-w-md w-full bg-zinc-900 border border-white/10 text-white p-0 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Bug className="w-4 h-4 text-amber-400" strokeWidth={1.75} />
            <h2 className="text-sm font-semibold text-white">Report a Bug</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-red-400/70 hover:text-red-400 transition-colors"
            aria-label="Close"
            disabled={phase === "submitting"}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">

          {/* ── SUCCESS ── */}
          {phase === "success" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
              <p className="text-sm font-medium text-white">
                Report sent. Thank you — this helps us find the problem faster.
              </p>
              <button
                onClick={handleClose}
                className="mt-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {/* ── FORM / SUBMITTING / ERROR ── */}
          {phase !== "success" && (
            <>
              {/* Name (read-only, just for context) */}
              {displayName && (
                <div>
                  <label className="block text-xs text-white/50 mb-1">Name</label>
                  <p className="text-sm text-white/80">{displayName}</p>
                </div>
              )}

              {/* What happened */}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">
                  What happened? <span className="text-amber-400">*</span>
                </label>
                <textarea
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  rows={4}
                  placeholder="Describe what went wrong…"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  disabled={phase === "submitting"}
                  maxLength={2000}
                />
              </div>

              {/* What were you trying to do */}
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">
                  What were you trying to do? <span className="text-white/30 font-normal">(optional)</span>
                </label>
                <textarea
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  rows={2}
                  placeholder="I was trying to…"
                  value={intent}
                  onChange={e => setIntent(e.target.value)}
                  disabled={phase === "submitting"}
                  maxLength={1000}
                />
              </div>

              {/* Diagnostics toggle */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={includeDiagnostics}
                    onChange={e => setIncludeDiagnostics(e.target.checked)}
                    disabled={phase === "submitting"}
                  />
                  <div className="w-4 h-4 rounded border border-white/20 bg-zinc-800 peer-checked:bg-amber-500 peer-checked:border-amber-500 transition-colors flex items-center justify-center">
                    {includeDiagnostics && (
                      <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2.5}>
                        <path d="M1.5 5l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-white/80 leading-tight">Include diagnostic information</p>
                  <p className="text-xs text-white/40 mt-0.5 leading-snug">
                    Contains technical app information such as recent errors and failed requests.
                    Does not include passwords or authentication credentials.
                  </p>
                </div>
              </label>

              {/* Server error */}
              {phase === "error" && serverError && (
                <p className="text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2">{serverError}</p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-xs text-white/50 hover:text-white/80 transition-colors"
                  disabled={phase === "submitting"}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!description.trim() || phase === "submitting"}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black text-xs font-semibold transition-colors"
                >
                  {phase === "submitting" && <Loader2 className="w-3 h-3 animate-spin" />}
                  {phase === "submitting" ? "Sending…" : "Send Report"}
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
