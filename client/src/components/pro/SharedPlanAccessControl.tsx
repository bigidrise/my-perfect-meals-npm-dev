import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { PillButton } from "@/components/ui/pill-button";
import { Loader2 } from "lucide-react";

interface SharedPlanAccessControlProps {
  clientId: string;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function SharedPlanAccessControl({ clientId }: SharedPlanAccessControlProps) {
  const [clientCanEdit, setClientCanEdit] = useState<boolean | null>(null);
  const [lastChangedAt, setLastChangedAt] = useState<string | null>(null);
  const [lastChangedByRole, setLastChangedByRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchAccess = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const res = await fetch(
        apiUrl(`/api/pro/board/clients/${clientId}/board-access`),
        { headers: { ...getAuthHeaders() }, credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        setClientCanEdit(data.clientCanEdit ?? false);
        setLastChangedAt(data.clientEditLastChangedAt ?? null);
        setLastChangedByRole(data.clientEditLastChangedByRole ?? null);
      } else if (res.status === 403) {
        setClientCanEdit(null);
      }
    } catch {
      setClientCanEdit(null);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchAccess();
  }, [fetchAccess]);

  const toggle = async (newValue: boolean) => {
    if (saving || clientCanEdit === newValue) return;
    setSaving(true);
    try {
      const res = await fetch(
        apiUrl(`/api/pro/board/clients/${clientId}/board-access`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          credentials: "include",
          body: JSON.stringify({ clientCanEdit: newValue }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setClientCanEdit(data.clientCanEdit);
        setLastChangedAt(data.clientEditLastChangedAt ?? null);
        setLastChangedByRole(data.clientEditLastChangedByRole ?? null);
      }
    } catch {
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/5 rounded-lg p-3 border border-white/10">
        <div className="flex items-center gap-2 text-white/40 text-xs">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading plan access...
        </div>
      </div>
    );
  }

  if (clientCanEdit === null) return null;

  const changedByLabel = lastChangedByRole
    ? lastChangedByRole.charAt(0).toUpperCase() + lastChangedByRole.slice(1)
    : null;

  return (
    <div className="bg-white/5 rounded-lg p-3 border border-white/10 space-y-2.5">
      <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">
        Shared Plan Access
      </p>

      <div className="flex items-center gap-2">
        <PillButton
          active={!clientCanEdit}
          variant="amber"
          disabled={saving}
          onClick={() => toggle(false)}
          className="flex-1 justify-center"
        >
          Coach Managed
        </PillButton>
        <PillButton
          active={clientCanEdit}
          variant="emerald"
          disabled={saving}
          onClick={() => toggle(true)}
          className="flex-1 justify-center"
        >
          Collaborative
        </PillButton>
      </div>

      {lastChangedAt && changedByLabel && (
        <p className="text-[10px] text-white/30">
          Last changed by {changedByLabel} · {formatTimestamp(lastChangedAt)}
        </p>
      )}

      <p className="text-[10px] text-white/40 leading-relaxed">
        {clientCanEdit
          ? "Client can edit the shared meal plan normally."
          : "Client has read-only access. Only the coach can make changes."}
      </p>
    </div>
  );
}
