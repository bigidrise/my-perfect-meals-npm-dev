import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarCheck, ChevronDown, ChevronUp, CheckCircle2, Loader2 } from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";
import { useToast } from "@/hooks/use-toast";

interface CheckInRow {
  id: string;
  clientUserId: string;
  clientName: string;
  dueAt: string;
  note: string | null;
  done: boolean;
}

function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const formatted = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  if (diffDays < 0) return `${formatted} (overdue)`;
  if (diffDays === 0) return `${formatted} (today)`;
  if (diffDays === 1) return `${formatted} (tomorrow)`;
  return formatted;
}

function isOverdue(dateStr: string): boolean {
  return new Date(dateStr).getTime() < Date.now();
}

export default function CheckInOverviewPanel() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [schedules, setSchedules] = useState<CheckInRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingDone, setMarkingDone] = useState<Set<string>>(new Set());

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/check-in-schedules/all"), {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setSchedules(data.schedules || []);
    } catch {
      toast({ title: "Error", description: "Could not load check-ins.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      fetchSchedules();
    }
  };

  const markDone = async (id: string) => {
    setMarkingDone((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(apiUrl(`/api/check-in-schedules/${id}/done`), {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed");
      setSchedules((prev) => prev.filter((s) => s.id !== id));
      toast({ title: "Done", description: "Check-in marked as complete." });
    } catch {
      toast({ title: "Error", description: "Could not mark check-in as done.", variant: "destructive" });
    } finally {
      setMarkingDone((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="rounded-xl bg-black/40 backdrop-blur-lg border border-white/10 overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
      >
        <CalendarCheck className="h-4 w-4 text-amber-400 flex-shrink-0" />
        <h2 className="text-sm font-bold text-white flex-1 text-left">
          Upcoming Check-ins
          {!loading && schedules.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold">
              {schedules.length}
            </span>
          )}
        </h2>
        {open ? (
          <ChevronUp className="h-4 w-4 text-white/40" />
        ) : (
          <ChevronDown className="h-4 w-4 text-white/40" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-white/40 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading check-ins…</span>
                </div>
              ) : schedules.length === 0 ? (
                <div className="py-8 text-center text-white/40 text-sm">
                  No pending check-ins.
                </div>
              ) : (
                <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
                  {schedules.map((s) => {
                    const overdue = isOverdue(s.dueAt);
                    const busy = markingDone.has(s.id);
                    return (
                      <div
                        key={s.id}
                        className={`flex items-center gap-3 px-4 py-3 ${overdue ? "bg-red-500/5" : ""}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {s.clientName}
                          </p>
                          <p className={`text-xs mt-0.5 ${overdue ? "text-red-400" : "text-white/50"}`}>
                            {formatDueDate(s.dueAt)}
                          </p>
                          {s.note && (
                            <p className="text-xs text-white/40 truncate mt-0.5 italic">
                              {s.note}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => markDone(s.id)}
                          disabled={busy}
                          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600/20 border border-green-500/30 text-green-300 text-xs font-semibold hover:bg-green-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {busy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          Mark Done
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
