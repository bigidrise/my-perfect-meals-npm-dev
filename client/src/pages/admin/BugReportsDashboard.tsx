import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Bug,
  User,
  MapPin,
  Tag,
  Clock,
  Layers,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

type BugReportStatus = "new" | "reviewing" | "resolved";

interface DiagnosticError {
  message?: string;
  source?: string;
  timestamp?: string;
  [key: string]: unknown;
}

interface DiagnosticRequest {
  url?: string;
  status?: number;
  method?: string;
  timestamp?: string;
  [key: string]: unknown;
}

interface Diagnostics {
  errors?: DiagnosticError[];
  failedRequests?: DiagnosticRequest[];
  [key: string]: unknown;
}

interface BugReport {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  description: string;
  intent: string | null;
  route: string | null;
  buildVersion: string | null;
  environment: string | null;
  userAgent: string | null;
  includeDiagnostics: boolean;
  diagnostics: Diagnostics | null;
  status: BugReportStatus;
  createdAt: string;
}

const STATUS_LABELS: Record<BugReportStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  resolved: "Resolved",
};

const STATUS_COLORS: Record<BugReportStatus, string> = {
  new: "bg-red-100 text-red-700 border-red-200",
  reviewing: "bg-amber-100 text-amber-700 border-amber-200",
  resolved: "bg-green-100 text-green-700 border-green-200",
};

const STATUS_ORDER: BugReportStatus[] = ["new", "reviewing", "resolved"];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

// ── Diagnostic Panel ──────────────────────────────────────────────────────────

function DiagnosticPanel({ diagnostics }: { diagnostics: Diagnostics }) {
  const [open, setOpen] = useState(false);
  const errors = diagnostics.errors ?? [];
  const failedRequests = diagnostics.failedRequests ?? [];
  const hasContent = errors.length > 0 || failedRequests.length > 0;

  return (
    <div className="mt-3 rounded-lg border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Layers size={14} />
          Developer Diagnostic Summary
          {hasContent && (
            <span className="ml-1 text-xs font-normal text-slate-500">
              {errors.length} error{errors.length !== 1 ? "s" : ""} · {failedRequests.length} failed request{failedRequests.length !== 1 ? "s" : ""}
            </span>
          )}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="p-4 bg-white space-y-4 text-xs font-mono">
          {errors.length > 0 && (
            <div>
              <p className="font-sans font-semibold text-slate-600 mb-2 text-xs uppercase tracking-wide">
                Console Errors ({errors.length})
              </p>
              <div className="space-y-2">
                {errors.map((e, i) => (
                  <div key={i} className="rounded bg-red-50 border border-red-100 p-2 text-red-800 break-all whitespace-pre-wrap">
                    {e.timestamp && (
                      <span className="text-red-400 mr-2">[{e.timestamp}]</span>
                    )}
                    {e.message ?? JSON.stringify(e)}
                    {e.source && (
                      <div className="text-red-400 mt-1">at {e.source}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {failedRequests.length > 0 && (
            <div>
              <p className="font-sans font-semibold text-slate-600 mb-2 text-xs uppercase tracking-wide">
                Failed Requests ({failedRequests.length})
              </p>
              <div className="space-y-2">
                {failedRequests.map((r, i) => (
                  <div key={i} className="rounded bg-amber-50 border border-amber-100 p-2 text-amber-900 break-all">
                    <span className="font-semibold">{r.method ?? "?"} </span>
                    <span className="text-amber-700">{r.url ?? "unknown"}</span>
                    {r.status != null && (
                      <span className="ml-2 text-amber-500">→ {r.status}</span>
                    )}
                    {r.timestamp && (
                      <div className="text-amber-400 mt-1">{r.timestamp}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasContent && (
            <p className="font-sans text-slate-400 italic">No structured diagnostic data.</p>
          )}

          {/* Raw dump for any extra fields */}
          {Object.keys(diagnostics).filter((k) => k !== "errors" && k !== "failedRequests").length > 0 && (
            <div>
              <p className="font-sans font-semibold text-slate-600 mb-2 text-xs uppercase tracking-wide">Raw Extras</p>
              <pre className="rounded bg-slate-50 border border-slate-200 p-2 text-slate-700 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(
                  Object.fromEntries(
                    Object.entries(diagnostics).filter(([k]) => k !== "errors" && k !== "failedRequests")
                  ),
                  null,
                  2
                )}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Report Card ───────────────────────────────────────────────────────────────

function ReportCard({
  report,
  onStatusChange,
}: {
  report: BugReport;
  onStatusChange: (id: string, status: BugReportStatus) => void;
}) {
  const [updating, setUpdating] = useState(false);

  async function handleStatusChange(newStatus: BugReportStatus) {
    if (newStatus === report.status || updating) return;
    setUpdating(true);
    try {
      await apiRequest(`/api/bug-reports/${report.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      onStatusChange(report.id, newStatus);
    } catch (err) {
      console.error("[BugReportsDashboard] status update failed:", err);
    } finally {
      setUpdating(false);
    }
  }

  const hasDiagnostics =
    report.includeDiagnostics && report.diagnostics != null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">
            #{shortId(report.id)}
          </span>
          <span
            className={`text-xs font-medium border rounded-full px-2 py-0.5 ${STATUS_COLORS[report.status]}`}
          >
            {STATUS_LABELS[report.status]}
          </span>
        </div>

        {/* Status changer */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_ORDER.filter((s) => s !== report.status).map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              disabled={updating}
              className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors disabled:opacity-50 ${STATUS_COLORS[s]} hover:opacity-80`}
            >
              {updating ? "…" : `Mark ${STATUS_LABELS[s]}`}
            </button>
          ))}
        </div>
      </div>

      {/* Meta row */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {(report.userName || report.userEmail) && (
          <span className="flex items-center gap-1">
            <User size={11} />
            {report.userName ?? report.userEmail}
            {report.userEmail && report.userName && (
              <span className="text-slate-400">({report.userEmail})</span>
            )}
          </span>
        )}
        {report.route && (
          <span className="flex items-center gap-1">
            <MapPin size={11} />
            {report.route}
          </span>
        )}
        {report.buildVersion && (
          <span className="flex items-center gap-1">
            <Tag size={11} />
            v{report.buildVersion}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock size={11} />
          {formatDate(report.createdAt)}
        </span>
      </div>

      {/* Description */}
      <p className="mt-3 text-sm text-slate-800 leading-relaxed">
        {report.description}
      </p>

      {/* Intent */}
      {report.intent && (
        <p className="mt-1.5 text-xs text-slate-500 italic">
          Intent: {report.intent}
        </p>
      )}

      {/* Diagnostics */}
      {hasDiagnostics && (
        <DiagnosticPanel diagnostics={report.diagnostics!} />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BugReportsDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<BugReportStatus | "all">("all");
  const [refreshing, setRefreshing] = useState(false);

  // Redirect non-admins
  useEffect(() => {
    if (user && !(user as any).isAdmin) {
      navigate("/");
    }
  }, [user, navigate]);

  async function fetchReports() {
    try {
      const data = await apiRequest("/api/bug-reports");
      setReports(data as BugReport[]);
      setError(null);
    } catch (err: any) {
      setError("Failed to load bug reports.");
    }
  }

  useEffect(() => {
    setLoading(true);
    fetchReports().finally(() => setLoading(false));
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchReports();
    setRefreshing(false);
  }

  function handleStatusChange(id: string, newStatus: BugReportStatus) {
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    );
  }

  const filtered =
    filterStatus === "all"
      ? reports
      : reports.filter((r) => r.status === filterStatus);

  const counts: Record<BugReportStatus | "all", number> = {
    all: reports.length,
    new: reports.filter((r) => r.status === "new").length,
    reviewing: reports.filter((r) => r.status === "reviewing").length,
    resolved: reports.filter((r) => r.status === "resolved").length,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/admin")}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <Bug size={18} className="text-slate-600" />
            <h1 className="text-base font-semibold text-slate-800">Bug Reports</h1>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Filter tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "new", "reviewing", "resolved"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border font-medium transition-colors ${
                filterStatus === s
                  ? s === "all"
                    ? "bg-slate-800 text-white border-slate-800"
                    : `${STATUS_COLORS[s as BugReportStatus]} border-current`
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
            >
              {s === "all" ? "All" : STATUS_LABELS[s as BugReportStatus]}
              <span
                className={`text-xs rounded-full px-1.5 py-0.5 ${
                  filterStatus === s ? "bg-white/20" : "bg-slate-100 text-slate-500"
                }`}
              >
                {counts[s]}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading && (
          <div className="text-center py-16 text-slate-400 text-sm">Loading bug reports…</div>
        )}

        {!loading && error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm">
            {filterStatus === "all" ? "No bug reports yet." : `No ${filterStatus} reports.`}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-4">
            {filtered.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
