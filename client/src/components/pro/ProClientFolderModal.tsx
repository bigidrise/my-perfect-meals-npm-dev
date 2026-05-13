import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClientProfile, proStore } from "@/lib/proData";
import { resolveClinicalProtocolLabel } from "@shared/clinical/clinicalModeResolver";
import { LayoutDashboard, Tablet, CheckCircle2, ArrowRight, Send, Loader2, Globe, FileText, MessageSquare, Trash2 } from "lucide-react";
import StudioMetricsSnapshot from "@/components/pro/StudioMetricsSnapshot";
import ProClientWeightSnapshot from "@/components/pro/ProClientWeightSnapshot";
import ProClientLabsSnapshot from "@/components/pro/ProClientLabsSnapshot";
import ProClientComplianceSnapshot from "@/components/pro/ProClientComplianceSnapshot";
import ProClientProgramHistory from "@/components/pro/ProClientProgramHistory";
import CycleProtocolControl from "@/components/pro/CycleProtocolControl";
import ProNutritionStrategyCard from "@/components/pro/ProNutritionStrategyCard";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { QuickTourButton } from "@/components/guided/QuickTourButton";

const FOLDER_TOUR_STEPS: TourStep[] = [
  {
    icon: "1",
    title: "Client Folder Overview",
    description: "This is your complete client workspace. Protocols, communication, compliance, and nutrition strategy all live here. The tour button is always available in the top-right corner.",
  },
  {
    icon: "2",
    title: "Active Clinical Supports",
    description: "The colored dots show which clinical protocols are active for this client. A glowing dot means that protocol is shaping every meal the AI generates. Tap any dot to see exactly what it does. Dots activate from your settings, physician assignment, or automatically when lab values cross clinical thresholds.",
  },
  {
    icon: "3",
    title: "Messages vs. Provider Notes",
    description: "Messages are a shared conversation — your client can read them and reply. Provider Notes are internal only and are never visible to the client. Use notes for clinical observations, progress documentation, or anything that should stay in your professional records.",
  },
  {
    icon: "4",
    title: "Compliance Score",
    description: "Compliance is calculated over the last 30 days across three factors: calorie logging accuracy, protein target adherence, and daily logging frequency. 90%+ is excellent. 70–89% is on track. Below 70% is a signal to reach out.",
  },
  {
    icon: "5",
    title: "Snapshots & History",
    description: "Below the tablet you will find weight trends, lab results (physicians only), program history, and nutrition strategy cards. These update in real time from your client's activity in the app.",
  },
  {
    icon: "6",
    title: "Cycle Protocols",
    description: "Use Cycle Protocols to guide your client through structured nutrition phases — Lower Carb Phase, Higher Carb Push, or Carb Refeed. When you update the strategy, the client is notified and must acknowledge the change before it is marked as seen.",
  },
  {
    icon: "7",
    title: "Client Dashboard",
    description: "Tap 'Go To Client Dashboard' at the bottom to open the full workspace where you can set macro targets, adjust medical directives, assign builders, and view your client's live meal board.",
  },
];

const DOT_TOOLTIPS: Record<string, string> = {
  "anti-inflammatory": "Adjusts meal generation to reduce inflammatory triggers — refined oils, processed foods, and pro-inflammatory proteins. Actively promotes omega-3s, leafy greens, turmeric, berries, and anti-inflammatory fats.",
  "cardiac": "Applies sodium limits, reduces saturated fat, and promotes heart-healthy fats like olive oil and fatty fish. Activates when LDL cholesterol is ≥130 mg/dL or when the Cardiac flag is set in medical directives.",
  "kidney-disease": "Limits phosphorus, potassium, and protein to reduce kidney workload. Designed for CKD patients requiring modified nutrient intake. Activates on elevated creatinine levels or specialist assignment.",
  "liver-support": "Supports hepatic health with anti-inflammatory foods and reduced liver-taxing compounds. Activates when ALT is mildly elevated or when Liver Support is selected in medical directives.",
  "liver-disease": "Applies stricter hepatic nutrient controls for diagnosed liver disease — reduced protein load, sodium, and compounds that stress the liver. Activates on significantly elevated ALT or specialist assignment.",
  "oncology-support": "Applies oncology-safe nutritional guidance — reduces processed foods, supports immune function, and avoids clinically contraindicated ingredients. Physician-assigned only. No treatment claims are implied.",
  "thyroid-support": "Applies thyroid-aware meal guidance — moderates excess goitrogenic foods, supports iodine and selenium intake, and accounts for medication timing where relevant. Activated via medical directives.",
};

interface TabletEntry {
  id: string;
  body: string;
  authorUserId: string;
  entryType: "message" | "note";
  visibility: string;
  sender: "client" | "pro";
  createdAt: string;
  translatedBody?: string;
}

interface ProClientFolderModalProps {
  client: ClientProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (path: string) => void;
  isPhysician: boolean;
}

const BUILDER_LABELS: Record<string, string> = {
  general: "General Nutrition",
  general_nutrition: "General Nutrition",
  performance: "Performance & Competition",
  performance_competition: "Performance & Competition",
  diabetic: "Diabetic",
  glp1: "GLP-1",
  "anti-inflammatory": "Anti-Inflammatory",
  anti_inflammatory: "Anti-Inflammatory",
  weekly: "Weekly",
  beach_body: "Beach Body",
};

function getBuilderLabel(client: ClientProfile): string | null {
  const raw = client.assignedBuilder || client.activeBoardId;
  if (!raw) return null;
  const isAntiInflammatory = raw === 'anti_inflammatory' || raw === 'anti-inflammatory';
  if (isAntiInflammatory) {
    const targets = proStore.getTargets(client.id);
    return resolveClinicalProtocolLabel(targets?.flags);
  }
  return BUILDER_LABELS[raw] || raw.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getRoleLabel(role?: string): string {
  if (!role) return "Professional";
  const map: Record<string, string> = {
    trainer: "Trainer",
    doctor: "Doctor",
    np: "Nurse Practitioner",
    rn: "RN",
    pa: "PA",
    nutritionist: "Nutritionist",
    dietitian: "Dietitian",
  };
  return map[role] || role;
}

const translationCache = new Map<string, string>();

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function ProClientFolderModal({
  client,
  open,
  onOpenChange,
  onNavigate,
  isPhysician,
}: ProClientFolderModalProps) {
  const [messages, setMessages] = useState<TabletEntry[]>([]);
  const [notes, setNotes] = useState<TabletEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"messages" | "notes">("messages");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msgInput, setMsgInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [sending, setSending] = useState(false);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const msgScrollRef = useRef<HTMLDivElement>(null);
  const noteScrollRef = useRef<HTMLDivElement>(null);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  const [clientGoal, setClientGoal] = useState<{
    goalType?: string | null;
    goalTarget?: string | null;
    goalTimelineWeeks?: number | null;
    goalStartDate?: string | null;
  } | null>(null);
  const [labDerivedConditions, setLabDerivedConditions] = useState<string[]>([]);
  const [dotTooltip, setDotTooltip] = useState<string | null>(null);
  const folderTour = useQuickTour("client-folder");

  const [resolvedClientId, setResolvedClientId] = useState<string | null>(null);
  const [resolvedStudioId, setResolvedStudioId] = useState<string | null>(null);
  const clientId = resolvedClientId || client?.clientUserId || client?.userId || null;
  const studioId = resolvedStudioId || client?.studioId || null;
  const hasDbBackedId = !!(client?.clientUserId || client?.userId);

  useEffect(() => {
    if (!open || !client?.email) {
      if (!hasDbBackedId) setResolvedClientId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const headers: Record<string, string> = { ...getAuthHeaders() };
        const studioRes = await fetch(apiUrl("/api/studios/my-studio"), { headers, credentials: "include" });
        if (!studioRes.ok || cancelled) return;
        const { studio } = await studioRes.json();
        if (!studio || cancelled) return;
        if (!cancelled) setResolvedStudioId(studio.id);
        if (!hasDbBackedId) {
          const clientsRes = await fetch(apiUrl(`/api/studios/${studio.id}/clients`), { headers, credentials: "include" });
          if (!clientsRes.ok || cancelled) return;
          const { clients: dbClients } = await clientsRes.json();
          const match = dbClients?.find((dc: any) => dc.email === client.email);
          if (match?.clientUserId && !cancelled) {
            setResolvedClientId(match.clientUserId);
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [open, hasDbBackedId, client?.email]);

  useEffect(() => {
    if (!open || !clientId) { setClientGoal(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl(`/api/users/${clientId}/goal`), {
          headers: { ...getAuthHeaders() },
          credentials: "include",
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setClientGoal(data);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [open, clientId]);

  // Fetch client labs to derive active conditions from lab signal + specialty selections
  useEffect(() => {
    if (!open || !clientId) { setLabDerivedConditions([]); return; }
    let cancelled = false;
    fetch(apiUrl(`/api/biometrics/labs/${clientId}`), {
      headers: { ...getAuthHeaders() },
      credentials: "include",
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled) return;
        const derived: string[] = [];
        if (data?.protocolSignal?.protocol) derived.push(data.protocolSignal.protocol);
        const scMap: Record<string, string> = {
          cardiac: 'heart-failure', renal: 'kidney-disease',
          'liver-disease': 'liver-disease', 'liver-support': 'liver-support',
          'oncology-support': 'oncology-support',
        };
        const scArr: string[] = data?.specialtyConditions ?? (data?.specialtyCondition ? [data.specialtyCondition] : []);
        for (const sc of scArr) {
          const mapped = scMap[sc];
          if (mapped && !derived.includes(mapped)) derived.push(mapped);
        }
        setLabDerivedConditions(derived);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, clientId]);

  const proInitialLoad = useRef(true);

  const fetchTablet = useCallback(async () => {
    if (!clientId) return;
    if (proInitialLoad.current) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/pro/tablet/${clientId}`), {
        headers: { ...getAuthHeaders() },
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        if (res.status === 403) setError("This client hasn't connected to your studio yet. Ask them to enter your access code on their More page.");
        else if (res.status === 401) setError("Session expired. Please log out and log back in.");
        else setError("Failed to load tablet");
        return;
      }
      const data = await res.json();
      const msgs: TabletEntry[] = data.messages || [];
      setMessages((prev) => {
        const prevMap = new Map(prev.map((m) => [m.id, m]));
        return msgs.map((m) => ({
          ...m,
          translatedBody: prevMap.get(m.id)?.translatedBody,
        }));
      });
      setNotes(data.notes || []);

      const lastSeenKey = `mpm.tablet.lastSeen.${clientId}`;
      const lastSeen = localStorage.getItem(lastSeenKey);
      const clientMsgs = msgs.filter((m) => m.sender === "client");
      if (clientMsgs.length > 0) {
        const latestClientMsg = clientMsgs[clientMsgs.length - 1];
        const latestTime = new Date(latestClientMsg.createdAt).getTime();
        const seenTime = lastSeen ? parseInt(lastSeen, 10) : 0;
        setHasUnreadMessages(latestTime > seenTime);
      } else {
        setHasUnreadMessages(false);
      }
    } catch {
      setError("Failed to load tablet");
    } finally {
      setLoading(false);
      proInitialLoad.current = false;
    }
  }, [clientId]);

  useEffect(() => {
    if (open && clientId) {
      proInitialLoad.current = true;
      fetchTablet();
      const interval = setInterval(fetchTablet, 10000);
      return () => clearInterval(interval);
    }
    if (!open) {
      setMessages([]);
      setNotes([]);
      setMsgInput("");
      setNoteInput("");
      setError(null);
      setActiveTab("messages");
    }
  }, [open, clientId, fetchTablet]);

  useEffect(() => {
    if (activeTab === "messages" && clientId && hasUnreadMessages) {
      localStorage.setItem(`mpm.tablet.lastSeen.${clientId}`, Date.now().toString());
      setHasUnreadMessages(false);
    }
  }, [activeTab, clientId, hasUnreadMessages]);

  useEffect(() => {
    if (activeTab === "messages" && msgScrollRef.current) {
      msgScrollRef.current.scrollTop = msgScrollRef.current.scrollHeight;
    }
    if (activeTab === "notes" && noteScrollRef.current) {
      noteScrollRef.current.scrollTop = noteScrollRef.current.scrollHeight;
    }
  }, [messages, notes, activeTab]);

  const handleSendMessage = async () => {
    if (!msgInput.trim() || !clientId || sending) return;
    setSending(true);
    try {
      const res = await fetch(apiUrl(`/api/pro/tablet/${clientId}/message`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ body: msgInput.trim() }),
      });
      if (!res.ok) {
        if (res.status === 422) {
          const errData = await res.json().catch(() => ({}));
          setError(errData.error || "Message blocked by content policy");
          return;
        }
        throw new Error("Failed to send");
      }
      const data = await res.json();
      setMessages((prev) => [...prev, data.entry]);
      setMsgInput("");
    } catch {
      setError("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleSaveNote = async () => {
    if (!noteInput.trim() || !clientId || sending) return;
    setSending(true);
    try {
      const res = await fetch(apiUrl(`/api/pro/tablet/${clientId}/note`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ body: noteInput.trim() }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      setNotes((prev) => [...prev, data.entry]);
      setNoteInput("");
    } catch {
      setError("Failed to save note");
    } finally {
      setSending(false);
    }
  };

  const handleTranslate = async (entry: TabletEntry) => {
    if (translatingId) return;
    const cacheKey = `${entry.id}_translate`;
    if (translationCache.has(cacheKey)) {
      const setFn = entry.entryType === "message" ? setMessages : setNotes;
      setFn((prev) =>
        prev.map((n) =>
          n.id === entry.id
            ? { ...n, translatedBody: n.translatedBody ? undefined : translationCache.get(cacheKey) }
            : n
        )
      );
      return;
    }
    setTranslatingId(entry.id);
    try {
      const res = await fetch(apiUrl("/api/translate"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({
          content: { name: "Tablet Note", description: entry.body },
          targetLanguage: navigator.language?.split("-")[0] || "es",
        }),
      });
      if (!res.ok) throw new Error("Translation failed");
      const data = await res.json();
      const translated = data.translated?.description || data.description || entry.body;
      translationCache.set(cacheKey, translated);
      const setFn = entry.entryType === "message" ? setMessages : setNotes;
      setFn((prev) =>
        prev.map((n) => (n.id === entry.id ? { ...n, translatedBody: translated } : n))
      );
    } catch {
      setError("Translation failed");
    } finally {
      setTranslatingId(null);
    }
  };

  const handleDeleteEntry = async (entry: TabletEntry) => {
    if (!clientId) return;
    try {
      const res = await fetch(apiUrl(`/api/pro/tablet/${clientId}/entry/${entry.id}`), {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      if (entry.entryType === "message") {
        setMessages((prev) => prev.filter((m) => m.id !== entry.id));
      } else {
        setNotes((prev) => prev.filter((n) => n.id !== entry.id));
      }
    } catch {
      setError("Failed to delete entry");
    }
  };

  if (!client) return null;

  const builderLabel = getBuilderLabel(client);
  const workspace = isPhysician ? "clinician" : "trainer";

  const renderEntryList = (entries: TabletEntry[], scrollRef: React.RefObject<HTMLDivElement | null>, showTranslate: boolean) => (
    <div ref={scrollRef} className="max-h-48 overflow-y-auto space-y-2 mb-2">
      {entries.length === 0 && (
        <p className="text-xs text-white/30 py-2">
          {activeTab === "messages" ? "No messages yet" : "No notes yet"}
        </p>
      )}
      {entries.map((entry) => (
        <div
          key={entry.id}
          className={`rounded-md p-2 border ${
            entry.sender === "client"
              ? "bg-blue-500/10 border-blue-500/20 ml-4"
              : "bg-white/5 border-white/5 mr-4"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-white/40">
              {entry.sender === "client" ? "Client" : "Coach"} &middot; {formatTimestamp(entry.createdAt)}
            </span>
            <div className="flex items-center gap-1.5">
              {showTranslate && (
                <button
                  onClick={() => handleTranslate(entry)}
                  disabled={translatingId === entry.id}
                  className="text-blue-400 p-0.5"
                  title="Translate"
                >
                  {translatingId === entry.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Globe className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
              <button
                onClick={() => handleDeleteEntry(entry)}
                className="text-red-500 p-0.5"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap">
            {entry.translatedBody || entry.body}
          </p>
          {entry.translatedBody && (
            <p className="text-[10px] text-white/30 mt-1 italic">
              Original: {entry.body}
            </p>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <DialogTitle className="text-xl text-white">{client.name}</DialogTitle>
              <DialogDescription className="text-white/50">
                {client.email || "No email on file"}
              </DialogDescription>
            </div>
            <QuickTourButton onClick={folderTour.openTour} />
          </div>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              <CheckCircle2 className="h-3 w-3" />
              {client.archived ? "Archived" : "Active"}
            </div>
            {client.role && (
              <div className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-400/30">
                {getRoleLabel(client.role)}
              </div>
            )}
            {builderLabel && (
              <div className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-300 border border-orange-400/30">
                {builderLabel}
              </div>
            )}
          </div>

          {/* Active Clinical Supports */}
          {(() => {
            const flags = proStore.getTargets(client.id)?.flags;
            return (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 rounded-lg bg-zinc-800/50 text-xs mb-1">
                <span className="font-medium text-white/70">Active Clinical Supports:</span>
                {(() => {
                  const conditions = [
                    { key: "anti-inflammatory", label: "Anti-Inflammatory", isActive: true,                    activeColor: "text-green-400",   dotColor: "bg-green-400",   dotGlow: "shadow-[0_0_4px_rgba(74,222,128,0.8)]"   },
                    { key: "cardiac",            label: "Cardiac Health",    isActive: !!flags?.cardiac          || labDerivedConditions.includes('heart-failure'),    activeColor: "text-red-400",     dotColor: "bg-red-400",     dotGlow: "shadow-[0_0_4px_rgba(248,113,113,0.8)]"  },
                    { key: "kidney-disease",     label: "Kidney Disease",    isActive: !!flags?.renal            || labDerivedConditions.includes('kidney-disease'),   activeColor: "text-sky-400",     dotColor: "bg-sky-400",     dotGlow: "shadow-[0_0_4px_rgba(56,189,248,0.8)]"   },
                    { key: "liver-support",      label: "Liver Support",     isActive: !!flags?.liverSupport     || labDerivedConditions.includes('liver-support'),    activeColor: "text-emerald-400", dotColor: "bg-emerald-400", dotGlow: "shadow-[0_0_4px_rgba(52,211,153,0.8)]"   },
                    { key: "liver-disease",      label: "Liver Disease",     isActive: !!flags?.liverDisease     || labDerivedConditions.includes('liver-disease'),    activeColor: "text-amber-400",   dotColor: "bg-amber-400",   dotGlow: "shadow-[0_0_4px_rgba(251,191,36,0.8)]"   },
                    { key: "oncology-support",   label: "Oncology Support",  isActive: !!flags?.oncologySupport  || labDerivedConditions.includes('oncology-support'), activeColor: "text-pink-400",   dotColor: "bg-pink-400",   dotGlow: "shadow-[0_0_4px_rgba(244,114,182,0.9)]" },
                    { key: "thyroid-support",    label: "Thyroid Support",   isActive: !!flags?.thyroidSupport,                                                        activeColor: "text-teal-400",   dotColor: "bg-teal-400",   dotGlow: "shadow-[0_0_4px_rgba(45,212,191,0.9)]"  },
                  ];
                  return (
                    <>
                      {conditions.map(({ key, label, isActive, activeColor, dotColor, dotGlow }) => (
                        <span
                          key={key}
                          className={`flex items-center gap-1 cursor-pointer select-none ${isActive ? `${activeColor} font-semibold` : "text-white/25"}`}
                          onClick={() => setDotTooltip(dotTooltip === key ? null : key)}
                        >
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${isActive ? `${dotColor} ${dotGlow}` : "bg-white/15"}`} />
                          {label}
                        </span>
                      ))}
                      {dotTooltip && DOT_TOOLTIPS[dotTooltip] && (
                        <div className="w-full mt-1 text-[11px] text-white/70 bg-zinc-700/60 rounded-md px-2.5 py-2 leading-relaxed border border-white/10">
                          <span className="text-white/90 font-semibold">
                            {conditions.find((c) => c.key === dotTooltip)?.label}:
                          </span>{" "}
                          {DOT_TOOLTIPS[dotTooltip]}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            );
          })()}

          {clientGoal?.goalType && (
            <div className="flex items-center gap-2.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2">
              <span className="text-base">
                {clientGoal.goalType === "lose" ? "🔥" : clientGoal.goalType === "gain" ? "💪" : "⚖️"}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] text-white/50 uppercase tracking-wide font-medium">Client Goal</p>
                <p className="text-xs font-semibold text-white leading-snug">
                  {clientGoal.goalType === "lose" ? "Lose Weight" : clientGoal.goalType === "gain" ? "Gain Muscle" : "Maintain Weight"}
                  {clientGoal.goalTarget ? ` — ${clientGoal.goalTarget}` : ""}
                  {clientGoal.goalTimelineWeeks ? ` in ${clientGoal.goalTimelineWeeks >= 52 ? "1 year" : clientGoal.goalTimelineWeeks >= 26 ? "6 months" : `${clientGoal.goalTimelineWeeks} wks`}` : ""}
                </p>
              </div>
            </div>
          )}

          <div className="border-t border-white/10 pt-3 space-y-2">
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-2 text-white/60 text-xs mb-2">
                <Tablet className="w-3.5 h-3.5" />
                Client Tablet
              </div>

              <p className="text-[10px] text-white/40 mb-2 leading-snug">
                <span className="text-orange-400 font-medium">Messages</span> are visible to your client and they can reply.{" "}
                <span className="text-white/60 font-medium">Provider Notes</span> are internal only — never shown to the client.
              </p>
              <div className="flex rounded-md overflow-hidden border border-white/10 mb-3">
                <button
                  onClick={() => setActiveTab("messages")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === "messages"
                      ? "bg-purple-600 text-white"
                      : "bg-white/5 text-white/50 hover:text-white/70"
                  }`}
                >
                  <MessageSquare className="w-3 h-3" />
                  Messages
                  {hasUnreadMessages && activeTab !== "messages" && (
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("notes")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === "notes"
                      ? "bg-purple-600 text-white"
                      : "bg-white/5 text-white/50 hover:text-white/70"
                  }`}
                >
                  <FileText className="w-3 h-3" />
                  Provider Notes
                </button>
              </div>

              {loading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-white/40" />
                </div>
              )}

              {error && (
                <p className="text-sm text-red-400 mb-2">{error}</p>
              )}

              {!loading && !error && activeTab === "messages" && (
                <>
                  {renderEntryList(messages, msgScrollRef, true)}
                  <div className="flex gap-2">
                    <textarea
                      value={msgInput}
                      onChange={(e) => setMsgInput(e.target.value)}
                      placeholder="Write a message to client..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-white/20"
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      disabled={!msgInput.trim() || sending}
                      onClick={handleSendMessage}
                      className="bg-purple-600 hover:bg-purple-700 px-3 self-end"
                    >
                      {sending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </>
              )}

              {!loading && !error && activeTab === "notes" && (
                <>
                  {renderEntryList(notes, noteScrollRef, false)}
                  <div className="flex gap-2">
                    <textarea
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="Write a private note..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-white/20"
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSaveNote();
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      disabled={!noteInput.trim() || sending}
                      onClick={handleSaveNote}
                      className="bg-zinc-700 hover:bg-zinc-600 px-3 self-end"
                    >
                      {sending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileText className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>

            {clientId && <StudioMetricsSnapshot clientId={clientId} />}

            {clientId && <ProClientComplianceSnapshot clientId={clientId} />}

            {clientId && <ProClientProgramHistory clientId={clientId} />}

            {clientId && <ProClientWeightSnapshot clientId={clientId} />}

            {clientId && isPhysician && <ProClientLabsSnapshot clientId={clientId} />}

            {clientId && <ProNutritionStrategyCard clientId={clientId} isPhysician={isPhysician} />}

            {clientId && studioId && (
              <CycleProtocolControl studioId={studioId} clientUserId={clientId} />
            )}

            <Button
              className="w-full justify-between bg-purple-600 text-white hover:bg-purple-700"
              onClick={() => {
                onOpenChange(false);
                onNavigate(`/pro/clients/${client.id}/${workspace}`);
              }}
            >
              <span className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" />
                Go To Client Dashboard
              </span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <QuickTourModal
      steps={FOLDER_TOUR_STEPS}
      isOpen={folderTour.isOpen}
      onClose={folderTour.closeTour}
      tourKey="client-folder"
    />
    </>
  );
}
