import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { getAuthHeaders } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";
import { Button } from "@/components/ui/button";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import PendingActivationQueue from "@/components/pro/PendingActivationQueue";
import { Card, CardContent } from "@/components/ui/card";
import {
  proStore,
  ClientProfile,
  ProRole,
  WorkspaceType,
  BuilderType,
} from "@/lib/proData";
import {
  ArrowLeft,
  Archive,
  RotateCcw,
  LinkIcon,
  FolderOpen,
  MessageSquare,
  Bell,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import TrashButton from "@/components/ui/TrashButton";
import ProClientFolderModal from "@/components/pro/ProClientFolderModal";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { resolveClinicalProtocolLabel } from "@shared/clinical/clinicalModeResolver";

interface UnreadClient {
  clientUserId: string;
  unreadCount: number;
  lastMessageAt: string;
  lastMessageBody: string;
}

interface AggregatedMessage {
  id: string;
  body: string;
  clientUserId: string;
  clientName: string;
  createdAt: string;
  isUnread: boolean;
}

interface ProClientsProps {
  workspace?: WorkspaceType;
}

export default function ProClients({ workspace }: ProClientsProps = {}) {
  const resolvedWorkspace = workspace || "trainer";
  const isPhysician = resolvedWorkspace === "clinician";

  const [, setLocation] = useLocation();
  const [clients, setClients] = useState<ClientProfile[]>(() =>
    proStore.listClients(resolvedWorkspace),
  );
  const [showArchived, setShowArchived] = useState(false);
  const [dbSynced, setDbSynced] = useState(false);
  const [folderClient, setFolderClient] = useState<ClientProfile | null>(null);
  const [folderOpen, setFolderOpen] = useState(false);

  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [totalUnread, setTotalUnread] = useState(0);
  const [showInbox, setShowInbox] = useState(false);
  const [inboxMessages, setInboxMessages] = useState<AggregatedMessage[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const prevTotalUnread = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const defaultRole: ProRole = isPhysician ? "doctor" : "trainer";

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  const fetchUnreadSummary = useCallback(async () => {
    try {
      const headers: Record<string, string> = { ...getAuthHeaders() };
      const res = await fetch(apiUrl("/api/pro/tablet/unread-summary"), { headers });
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, number> = {};
      for (const c of (data.clients as UnreadClient[])) {
        if (c.unreadCount > 0) map[c.clientUserId] = c.unreadCount;
      }
      setUnreadMap(map);
      const total = data.totalUnread as number;
      setTotalUnread(total);

      if (prevTotalUnread.current > 0 && total > prevTotalUnread.current) {
        const diff = total - prevTotalUnread.current;
        showToast(`${diff} new client message${diff > 1 ? "s" : ""} received`);
      }
      prevTotalUnread.current = total;
    } catch {
    }
  }, [showToast]);

  const fetchInboxMessages = useCallback(async () => {
    setInboxLoading(true);
    try {
      const headers: Record<string, string> = { ...getAuthHeaders() };
      const res = await fetch(apiUrl("/api/pro/tablet/all-messages"), { headers });
      if (!res.ok) return;
      const data = await res.json();
      setInboxMessages(data.messages || []);
    } catch {
    } finally {
      setInboxLoading(false);
    }
  }, []);

  useEffect(() => {
    syncDbClients();
    fetchUnreadSummary();
    const interval = setInterval(fetchUnreadSummary, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadSummary]);

  useEffect(() => {
    if (showInbox) {
      fetchInboxMessages();
    }
  }, [showInbox, fetchInboxMessages]);

  async function syncDbClients() {
    try {
      const headers: Record<string, string> = { ...getAuthHeaders() };

      const studioRes = await fetch(apiUrl("/api/studios/my-studio"), { headers });
      if (!studioRes.ok) {
        console.warn(`[ProClients] my-studio fetch failed: ${studioRes.status}`);
        return;
      }
      const { studio } = await studioRes.json();
      if (!studio) {
        console.warn("[ProClients] my-studio returned null studio");
        return;
      }

      const clientsRes = await fetch(
        apiUrl(`/api/studios/${studio.id}/clients?workspace=${resolvedWorkspace}`),
        { headers },
      );
      if (!clientsRes.ok) {
        console.warn(`[ProClients] clients fetch failed: ${clientsRes.status}`);
        return;
      }
      const { clients: dbClients } = await clientsRes.json();
      if (!dbClients || dbClients.length === 0) {
        console.warn("[ProClients] DB returned 0 clients for workspace:", resolvedWorkspace);
        return;
      }
      console.log(`[ProClients] DB returned ${dbClients.length} clients for workspace: ${resolvedWorkspace}`);

      const localClients = proStore.listClients(resolvedWorkspace);

      for (const dbClient of dbClients) {
        if (proStore.isClientTombstoned(dbClient.clientUserId, dbClient.email)) {
          continue;
        }

        const builderMap: Record<string, BuilderType> = {
          weekly: "weekly",
          diabetic: "diabetic",
          glp1: "glp1",
          anti_inflammatory: "anti_inflammatory",
          beach_body: "beach_body",
          general_nutrition: "general_nutrition",
          performance_competition: "performance_competition",
        };

        const dbEmail = dbClient.email?.toLowerCase();
        const existing = localClients.find(
          (lc) =>
            (lc.clientUserId && lc.clientUserId === dbClient.clientUserId) ||
            (lc.email && dbEmail && lc.email.toLowerCase() === dbEmail),
        );

        const resolvedBuilder: BuilderType | undefined =
          dbClient.assignedBuilder
            ? builderMap[dbClient.assignedBuilder]
            : existing?.assignedBuilder;

        const profile: ClientProfile = {
          id: existing?.id || dbClient.id,
          name:
            (existing?.name && existing.name !== "Client"
              ? existing.name
              : null) ||
            dbClient.name ||
            existing?.name ||
            `Client`,
          email: dbClient.email || existing?.email,
          role: existing?.role || defaultRole,
          workspace: resolvedWorkspace,
          userId: dbClient.clientUserId,
          clientUserId: dbClient.clientUserId,
          studioId: studio.id,
          ...(resolvedBuilder ? { assignedBuilder: resolvedBuilder } : {}),
          activeBoardId: dbClient.activeBoardId || existing?.activeBoardId,
          dbBacked: true,
          archived: dbClient.isArchived ?? existing?.archived ?? false,
          builderSource: (dbClient.builderSource as "clinical" | "trainer" | "manual") ?? existing?.builderSource ?? "manual",
          notes: existing?.notes,
        };

        proStore.upsertClient(profile);
      }

      const wsClients = proStore.listClients(resolvedWorkspace);
      const deduped: ClientProfile[] = [];
      const seenByClientUserId = new Map<string, number>();

      for (const c of wsClients) {
        if (!c.clientUserId) {
          deduped.push(c);
          continue;
        }
        const existingIdx = seenByClientUserId.get(c.clientUserId);
        if (existingIdx === undefined) {
          seenByClientUserId.set(c.clientUserId, deduped.length);
          deduped.push(c);
        } else if (c.archived && !deduped[existingIdx].archived) {
          deduped[existingIdx] = { ...deduped[existingIdx], ...c, archived: true };
        }
      }

      if (deduped.length < wsClients.length) {
        const otherClients = proStore.listClients().filter(
          (c) => (c.workspace || "trainer") !== resolvedWorkspace
        );
        proStore.saveClients([...otherClients, ...deduped]);
      }

      setClients([...proStore.listClients(resolvedWorkspace)]);
      setDbSynced(true);
    } catch (err) {
      console.warn("Could not sync DB clients:", err);
    }
  }

  const archiveClient = async (id: string) => {
    proStore.archiveClient(id);
    setClients([...proStore.listClients(resolvedWorkspace)]);
    const client = proStore.getClient(id);
    if (client?.studioId && client?.clientUserId) {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json", ...getAuthHeaders() };
        await fetch(apiUrl(`/api/studios/${client.studioId}/clients/${client.clientUserId}/archive`), { method: "PATCH", headers });
      } catch { }
    }
  };

  const restoreClient = async (id: string) => {
    proStore.restoreClient(id);
    setClients([...proStore.listClients(resolvedWorkspace)]);
    const client = proStore.getClient(id);
    if (client?.studioId && client?.clientUserId) {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json", ...getAuthHeaders() };
        await fetch(apiUrl(`/api/studios/${client.studioId}/clients/${client.clientUserId}/restore`), { method: "PATCH", headers });
      } catch { }
    }
  };

  const deleteClient = (id: string, _name: string) => {
    proStore.deleteClient(id);
    setClients([...proStore.listClients(resolvedWorkspace)]);
  };

  const go = (id: string) => {
    setLocation(`/pro/clients/${id}/${resolvedWorkspace}`);
  };

  const openFolder = async (c: ClientProfile) => {
    if (!c.clientUserId && !c.userId && c.email) {
      try {
        const headers: Record<string, string> = { ...getAuthHeaders() };
        const studioRes = await fetch(apiUrl("/api/studios/my-studio"), { headers });
        if (studioRes.ok) {
          const { studio } = await studioRes.json();
          if (studio) {
            const clientsRes = await fetch(
              apiUrl(`/api/studios/${studio.id}/clients?workspace=${resolvedWorkspace}`),
              { headers },
            );
            if (clientsRes.ok) {
              const { clients: dbClients } = await clientsRes.json();
              const match = dbClients?.find((dc: any) => dc.email === c.email);
              if (match?.clientUserId) {
                c = {
                  ...c,
                  clientUserId: match.clientUserId,
                  userId: match.clientUserId,
                  studioId: studio.id,
                  dbBacked: true,
                };
                proStore.upsertClient(c);
                setClients([...proStore.listClients(resolvedWorkspace)]);
              }
            }
          }
        }
      } catch {}
    }
    setFolderClient(c);
    setFolderOpen(true);
    if (c.clientUserId && unreadMap[c.clientUserId]) {
      setUnreadMap(prev => {
        const next = { ...prev };
        delete next[c.clientUserId!];
        return next;
      });
      setTotalUnread(prev => Math.max(0, prev - (unreadMap[c.clientUserId!] || 0)));
    }
  };

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
  };

  const getBuilderBadge = (c: ClientProfile): string | null => {
    const raw = c.assignedBuilder || c.activeBoardId;
    if (!raw) return null;
    const isAntiInflammatory = raw === 'anti_inflammatory' || raw === 'anti-inflammatory';
    if (isAntiInflammatory) {
      const targets = proStore.getTargets(c.id);
      return resolveClinicalProtocolLabel(targets?.flags);
    }
    return (
      BUILDER_LABELS[raw] ||
      raw.replace(/[-_]/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase())
    );
  };

  function formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d ago`;
  }

  const backPath = isPhysician ? "/care-team/physician" : "/care-team/trainer";
  const portalTitle = isPhysician
    ? "Physicians Clinic Portal"
    : "Trainer Studio Portal";
  const entityLabel = isPhysician ? "patient" : "client";

  const quickTour = useQuickTour(`pro-clients-${resolvedWorkspace}`);

  const PRO_CLIENTS_TOUR_STEPS: TourStep[] = [
    {
      icon: "1",
      title: `Pending Activation`,
      description: `${isPhysician ? "Patients" : "Clients"} who have completed payment appear here. Tap Activate to move them to your active roster.`,
    },
    {
      icon: "2",
      title: `Open ${isPhysician ? "Patient" : "Client"}`,
      description: `Click Open to access the ${entityLabel} workspace and begin setting macros or plans.`,
    },
    {
      icon: "3",
      title: `Archived ${isPhysician ? "Patients" : "Clients"}`,
      description: `Archived ${entityLabel}s are hidden from your active list but can be restored anytime.`,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen text-white bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav-generous"
    >
      <MobileHeaderGuard>
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-8 py-3 flex items-center gap-3">
          <button
            onClick={() => setLocation(backPath)}
            className="flex items-center gap-2 text-white transition-all duration-200 p-2 rounded-lg active:scale-[0.98]"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <h1 className="text-lg font-bold text-white flex-1 truncate min-w-0">{portalTitle}</h1>
          <div className="flex-shrink-0 flex items-center gap-2">
            <QuickTourButton onClick={quickTour.openTour} />
          </div>
        </div>
      </div>
      </MobileHeaderGuard>

      <div
        className="max-w-6xl mx-auto px-6 space-y-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        <PendingActivationQueue onActivated={() => syncDbClients()} />

        {totalUnread > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-orange-500/15 border border-orange-500/40 px-4 py-3 flex items-center gap-3 cursor-pointer active:scale-[0.98]"
            onClick={() => setShowInbox(!showInbox)}
          >
            <div className="relative">
              <Bell className="h-5 w-5 text-orange-400" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-300">
                {totalUnread} unread client message{totalUnread > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-white/50">Tap to view ProCare inbox</p>
            </div>
            {showInbox ? (
              <ChevronUp className="h-4 w-4 text-white/40" />
            ) : (
              <ChevronDown className="h-4 w-4 text-white/40" />
            )}
          </motion.div>
        )}

        <AnimatePresence>
          {showInbox && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-black/40 backdrop-blur-lg border border-white/10 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-purple-400" />
                  <h2 className="text-sm font-bold text-white">ProCare Messages Inbox</h2>
                  <span className="ml-auto text-xs text-white/40">All client messages</span>
                </div>

                {inboxLoading ? (
                  <div className="px-4 py-6 text-center text-white/40 text-sm">Loading messages…</div>
                ) : inboxMessages.length === 0 ? (
                  <div className="px-4 py-6 text-center text-white/40 text-sm">No client messages yet.</div>
                ) : (
                  <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
                    {inboxMessages.map((msg) => {
                      const clientProfile = clients.find(c => c.clientUserId === msg.clientUserId);
                      const displayName = clientProfile?.name || msg.clientName;
                      return (
                        <div
                          key={msg.id}
                          className={`px-4 py-3 flex gap-3 cursor-pointer hover:bg-white/5 active:scale-[0.99] transition-all ${msg.isUnread ? "bg-orange-500/5" : ""}`}
                          onClick={() => {
                            if (clientProfile) {
                              openFolder(clientProfile);
                              setShowInbox(false);
                            }
                          }}
                        >
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/30 flex items-center justify-center text-xs font-bold text-purple-300">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-white">{displayName}</span>
                              {msg.isUnread && (
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                              )}
                              <span className="ml-auto text-xs text-white/40 flex-shrink-0">
                                {formatRelativeTime(msg.createdAt)}
                              </span>
                            </div>
                            <p className="text-xs text-white/60 truncate mt-0.5">{msg.body}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-end mb-2">
          <Button
            onClick={() => setShowArchived(!showArchived)}
            variant="outline"
            size="sm"
            className="bg-white/5 border-white/20 text-white"
          >
            {showArchived
              ? `Show Active ${isPhysician ? "Patients" : "Clients"}`
              : `Show Archived ${isPhysician ? "Patients" : "Clients"}`}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.filter((c) => (showArchived ? c.archived : !c.archived))
            .length === 0 ? (
            <div className="text-white">
              {showArchived
                ? `No archived ${entityLabel}s.`
                : `No active ${entityLabel}s yet. Add one above.`}
            </div>
          ) : (
            clients
              .filter((c) => (showArchived ? c.archived : !c.archived))
              .map((c) => {
                const clientUnread = c.clientUserId ? (unreadMap[c.clientUserId] || 0) : 0;
                return (
                  <Card
                    key={c.id}
                    className={`bg-white/5 border transition-all ${clientUnread > 0 ? "border-orange-500/50 bg-orange-500/5" : "border-white/20"}`}
                    data-testid="pro-client-row"
                  >
                    <CardContent className="p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-white font-bold text-base leading-tight">
                          {c.name}
                        </div>
                        {clientUnread > 0 && (
                          <div className="flex items-center gap-1.5 bg-orange-500/20 border border-orange-500/40 rounded-full px-2 py-0.5 flex-shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                            <span className="text-xs font-semibold text-orange-300">
                              {clientUnread} new
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {c.archived ? (
                          <>
                            <Button
                              onClick={() => restoreClient(c.id)}
                              variant="outline"
                              size="sm"
                              className="bg-green-600/20 border-green-500/30 text-green-300"
                              data-testid={`button-restore-client-${c.id}`}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Restore
                            </Button>
                            <TrashButton
                              onClick={() => deleteClient(c.id, c.name)}
                              size="sm"
                              confirm
                              confirmMessage={`Delete ${c.name} permanently? This will remove all data and cannot be undone.`}
                              ariaLabel={`Permanently delete ${c.name}`}
                              data-testid={`button-delete-client-${c.id}`}
                            />
                          </>
                        ) : (
                          <>
                            <Button
                              onClick={() => archiveClient(c.id)}
                              variant="outline"
                              size="sm"
                              className="bg-orange-600/20 border-orange-500/30 text-orange-300"
                              data-testid={`button-archive-client-${c.id}`}
                            >
                              <Archive className="h-4 w-4 mr-1" />
                              Archive
                            </Button>
                            <Button
                              onClick={() => openFolder(c)}
                              size="sm"
                              className={`text-white active:scale-[0.98] ${clientUnread > 0 ? "bg-orange-500 hover:bg-orange-600" : "bg-purple-600"}`}
                              data-testid="button-open-client"
                            >
                              <FolderOpen className="h-4 w-4 mr-1" />
                              Open{clientUnread > 0 ? ` (${clientUnread})` : ""}
                            </Button>
                          </>
                        )}
                      </div>

                      {(c.dbBacked || c.role || getBuilderBadge(c)) && (
                        <div className="flex gap-2 flex-wrap">
                          {c.dbBacked && (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/30 text-green-200 border border-green-400/30">
                              <LinkIcon className="h-3 w-3" />
                              Linked
                            </div>
                          )}
                          {c.role && (
                            <div className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/30 text-purple-200 border border-purple-400/30">
                              {c.role === "doctor"
                                ? "Doctor"
                                : c.role === "np"
                                  ? "NP"
                                  : c.role === "rn"
                                    ? "RN"
                                    : c.role === "pa"
                                      ? "PA"
                                      : c.role === "nutritionist"
                                        ? "Nutritionist"
                                        : c.role === "dietitian"
                                          ? "Dietitian"
                                          : "Trainer"}
                            </div>
                          )}
                          {getBuilderBadge(c) && (
                            <div className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/30 text-orange-200 border border-orange-400/30">
                              {getBuilderBadge(c)}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
          )}
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            className="fixed bottom-24 left-1/2 z-50 flex items-center gap-3 bg-black/90 border border-orange-500/40 rounded-full px-4 py-3 shadow-2xl"
            style={{ transform: "translateX(-50%)", maxWidth: "calc(100vw - 32px)" }}
          >
            <div className="relative">
              <MessageSquare className="h-4 w-4 text-orange-400" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            </div>
            <span className="text-sm text-white font-medium whitespace-nowrap">{toast}</span>
            <button onClick={() => setToast(null)} className="text-white/40 hover:text-white ml-1">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <QuickTourModal
        isOpen={quickTour.shouldShow}
        onClose={quickTour.closeTour}
        title={`${portalTitle} Guide`}
        steps={PRO_CLIENTS_TOUR_STEPS}
        onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
      />

      <ProClientFolderModal
        client={folderClient}
        open={folderOpen}
        onOpenChange={(open) => {
          setFolderOpen(open);
          if (!open) {
            fetchUnreadSummary();
          }
        }}
        onNavigate={setLocation}
        isPhysician={isPhysician}
      />
    </motion.div>
  );
}
