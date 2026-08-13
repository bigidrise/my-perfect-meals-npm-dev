/**
 * BugReportButton — amber/gold bug icon beside the Hub control.
 *
 * Placed in:
 *   - client/src/layout/DesktopHeader.tsx (desktop)
 *   - client/src/pages/DashboardNew.tsx   (mobile)
 *
 * Opens BugReportModal on click.
 * Requires authentication — not rendered for unauthenticated users.
 */

import { useState } from "react";
import { Bug } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { BugReportModal } from "./BugReportModal";

export function BugReportButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // Only render for authenticated users
  if (!user) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/5 transition-colors"
        aria-label="Report a Bug"
        title="Report a Bug"
        data-testid="bug-report-button"
      >
        <Bug className="w-4 h-4 text-amber-400" strokeWidth={1.75} />
      </button>

      <BugReportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
