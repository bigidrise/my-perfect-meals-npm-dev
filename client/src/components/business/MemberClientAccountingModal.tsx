import { useEffect, useState } from "react";
import { X, Users, ShieldCheck, ShieldAlert, HelpCircle, Building2, User, Loader2 } from "lucide-react";
import { getAuthToken } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";

interface MemberClientData {
  member: {
    id: string;
    name: string;
    email: string;
    role: string;
    seatStatus: string;
  };
  policy: "org_only" | "allowed_with_disclosure" | "allowed";
  organizationClients: {
    count: number;
    clients: { name: string; assignmentStatus: string; relationshipStatus: string }[];
  };
  personalClients: {
    count: number;
    identitiesVisible: boolean;
  };
  unknownClientCount: number;
  compliance: "compliant" | "unknown" | "violation";
}

const POLICY_LABELS: Record<string, string> = {
  org_only: "Organization Clients Only",
  allowed_with_disclosure: "Personal Clients Allowed — With Disclosure",
  allowed: "Personal Clients Allowed",
};

const POLICY_DESC: Record<string, string> = {
  org_only: "This member may not take personal clients outside this organization.",
  allowed_with_disclosure: "This member may have personal clients but must disclose the relationship.",
  allowed: "This member may freely maintain personal clients without restriction.",
};

interface Props {
  memberId: string;
  onClose: () => void;
}

export default function MemberClientAccountingModal({ memberId, onClose }: Props) {
  const [data, setData] = useState<MemberClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = getAuthToken();
        const res = await fetch(apiUrl(`/api/business/members/${memberId}/clients`), {
          headers: token ? { "x-auth-token": token } : {},
          credentials: "include",
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Failed to load member data.");
        }
        setData(await res.json());
      } catch (e: any) {
        setError(e.message || "Something went wrong.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [memberId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md mx-auto bg-gradient-to-b from-zinc-900 to-black border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm border-b border-white/10 px-4 py-4 flex items-center justify-between rounded-t-2xl sm:rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-orange-400" />
            <span className="text-white font-semibold text-sm">Client Accounting</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-4 text-red-300 text-sm text-center">
              {error}
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* Member identity */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-white font-semibold text-base">{data.member.name}</p>
                <p className="text-white/50 text-xs mt-0.5">{data.member.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] px-2 py-0.5 bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-full capitalize">
                    {data.member.role}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-full capitalize">
                    {data.member.seatStatus}
                  </span>
                </div>
              </div>

              {/* Policy */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-white/50 text-[10px] uppercase tracking-wide font-semibold mb-1">Organization Policy</p>
                <p className="text-orange-300 text-sm font-medium">{POLICY_LABELS[data.policy]}</p>
                <p className="text-white/50 text-xs mt-1 leading-relaxed">{POLICY_DESC[data.policy]}</p>
              </div>

              {/* Client counts — ownership stamping not yet implemented */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Users className="w-4 h-4 text-white/30" />
                  <p className="text-white/50 text-[10px] uppercase tracking-wide font-semibold">Client Count</p>
                </div>
                <p className="text-white/60 text-sm leading-relaxed">
                  Client ownership tracking is coming soon. Once active, org-assigned and personal client counts will appear here.
                </p>
                {data.unknownClientCount > 0 && (
                  <p className="text-white/40 text-xs mt-2 leading-relaxed">
                    {data.unknownClientCount} unclassified client connection{data.unknownClientCount !== 1 ? "s" : ""} detected — classification pending ownership stamping.
                  </p>
                )}
              </div>

              {/* Compliance */}
              <div className={`flex items-start gap-3 rounded-xl p-3 border ${
                data.compliance === "compliant"
                  ? "bg-emerald-900/20 border-emerald-500/30"
                  : data.compliance === "violation"
                  ? "bg-red-900/20 border-red-500/30"
                  : "bg-zinc-800/60 border-zinc-700/50"
              }`}>
                {data.compliance === "compliant" ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : data.compliance === "violation" ? (
                  <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <HelpCircle className="w-4 h-4 text-zinc-400 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={`text-sm font-medium ${
                    data.compliance === "compliant" ? "text-emerald-300"
                    : data.compliance === "violation" ? "text-red-300"
                    : "text-zinc-300"
                  }`}>
                    {data.compliance === "compliant" ? "Policy Compliant"
                      : data.compliance === "violation" ? "Policy Violation Detected"
                      : "Compliance Pending Classification"}
                  </p>
                  <p className="text-white/40 text-xs mt-0.5 leading-relaxed">
                    {data.compliance === "compliant"
                      ? "No policy issues found for this member."
                      : data.compliance === "violation"
                      ? "This member has activity that conflicts with the organization policy."
                      : "Full compliance reporting requires workspace ownership stamping. This will resolve once client enrollment begins through the organization system."}
                  </p>
                </div>
              </div>

              {/* Org clients section */}
              <div>
                <p className="text-white/50 text-[10px] uppercase tracking-wide font-semibold mb-2 px-1">
                  Organization Clients
                </p>
                {data.organizationClients.clients.length > 0 ? (
                  <div className="space-y-2">
                    {data.organizationClients.clients.map((c, i) => (
                      <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                        <p className="text-white text-sm">{c.name}</p>
                        <span className="text-[10px] px-2 py-0.5 bg-orange-600/20 text-orange-300 border border-orange-500/20 rounded-full capitalize">
                          {c.assignmentStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
                    <Building2 className="w-6 h-6 text-white/20 mx-auto mb-2" />
                    <p className="text-white/50 text-sm">No organization clients yet.</p>
                    <p className="text-white/30 text-xs mt-1 leading-relaxed">
                      Clients will appear here as they connect through your organization's workspace, invitations, or access codes.
                    </p>
                  </div>
                )}
              </div>

              {/* Personal clients section */}
              {data.policy !== "org_only" && (
                <div>
                  <p className="text-white/50 text-[10px] uppercase tracking-wide font-semibold mb-2 px-1">
                    Personal Clients
                  </p>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    {data.policy === "allowed_with_disclosure" ? (
                      <>
                        <p className="text-white text-sm font-medium">
                          {data.personalClients.count} personal {data.personalClients.count === 1 ? "client" : "clients"}
                        </p>
                        <p className="text-white/40 text-xs mt-1 leading-relaxed">
                          Personal client identities are private. Your policy permits personal clients with disclosure — only the count is shown here.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-white/50 text-sm">
                          Personal client details are not shown. Your policy allows personal clients freely — no breakdown is required.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {data.policy === "org_only" && (
                <div>
                  <p className="text-white/50 text-[10px] uppercase tracking-wide font-semibold mb-2 px-1">
                    Personal Clients
                  </p>
                  <div className="bg-zinc-900/60 border border-zinc-700 rounded-xl p-4">
                    <p className="text-white/50 text-sm">
                      Personal client enrollment is not permitted under your current policy. Any personal client activity through the sponsored workspace will appear as a compliance issue above.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
