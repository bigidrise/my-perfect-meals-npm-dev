import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { getAuthHeaders } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import PendingActivationQueue from "@/components/pro/PendingActivationQueue";
import PendingCoachInvites from "@/components/pro/PendingCoachInvites";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  proStore,
  ClientProfile,
  ProRole,
  WorkspaceType,
  BuilderType,
} from "@/lib/proData";
import {
  Plus,
  ArrowLeft,
  Archive,
  RotateCcw,
  LinkIcon,
  FolderOpen,
} from "lucide-react";
import TrashButton from "@/components/ui/TrashButton";
import ProClientFolderModal from "@/components/pro/ProClientFolderModal";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { resolveClinicalProtocolLabel } from "@shared/clinical/clinicalModeResolver";

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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dbSynced, setDbSynced] = useState(false);
  const [folderClient, setFolderClient] = useState<ClientProfile | null>(null);
  const [folderOpen, setFolderOpen] = useState(false);

  const defaultRole: ProRole = isPhysician ? "doctor" : "trainer";

  useEffect(() => {
    syncDbClients();
  }, []);

  async function syncDbClients() {
    try {
      const headers: Record<string, string> = { ...getAuthHeaders() };

      const studioRes = await fetch("/api/studios/my-studio", { headers });
      if (!studioRes.ok) return;
      const { studio } = await studioRes.json();
      if (!studio) return;

      const clientsRes = await fetch(
        `/api/studios/${studio.id}/clients?workspace=${resolvedWorkspace}`,
        { headers },
      );
      if (!clientsRes.ok) return;
      const { clients: dbClients } = await clientsRes.json();
      if (!dbClients || dbClients.length === 0) return;

      const localClients = proStore.listClients(resolvedWorkspace);

      for (const dbClient of dbClients) {
        // Skip any client the pro explicitly deleted — tombstone prevents resurrection
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
          archived: existing?.archived,
          notes: existing?.notes,
        };

        proStore.upsertClient(profile);
      }

      // Deduplicate within this workspace: remove ghost entries created by
      // previous sync runs where the same client ended up with two local records.
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
        // Replace only this workspace's clients; leave other workspaces untouched
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

  const add = () => {
    if (!name.trim()) return;
    const c: ClientProfile = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: email.trim() || undefined,
      role: defaultRole,
      workspace: resolvedWorkspace,
    };
    proStore.upsertClient(c);
    setClients([...proStore.listClients(resolvedWorkspace)]);
    setName("");
    setEmail("");
  };

  const archiveClient = (id: string) => {
    proStore.archiveClient(id);
    setClients([...proStore.listClients(resolvedWorkspace)]);
  };

  const restoreClient = (id: string) => {
    proStore.restoreClient(id);
    setClients([...proStore.listClients(resolvedWorkspace)]);
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
        const studioRes = await fetch("/api/studios/my-studio", { headers });
        if (studioRes.ok) {
          const { studio } = await studioRes.json();
          if (studio) {
            const clientsRes = await fetch(
              `/api/studios/${studio.id}/clients?workspace=${resolvedWorkspace}`,
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

  const backPath = isPhysician ? "/care-team/physician" : "/care-team/trainer";
  const portalTitle = isPhysician
    ? "Physicians Clinic Portal"
    : "Trainer Studio Portal";
  const addLabel = isPhysician ? "Add Patient" : "Add Client";
  const entityLabel = isPhysician ? "patient" : "client";

  const quickTour = useQuickTour(`pro-clients-${resolvedWorkspace}`);

  const PRO_CLIENTS_TOUR_STEPS: TourStep[] = [
    {
      icon: "1",
      title: `Add a ${isPhysician ? "Patient" : "Client"}`,
      description: `Enter your ${entityLabel}'s name and email to add them to your ${isPhysician ? "clinic" : "studio"}.`,
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
      className="min-h-screen text-white bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
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
          <h1 className="text-lg font-bold text-white">{portalTitle}</h1>
          <div className="ml-auto flex items-center gap-2">
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

        <PendingCoachInvites />


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
              .map((c) => (
                <Card
                  key={c.id}
                  className="bg-white/5 border border-white/20"
                  data-testid="pro-client-row"
                >
                  <CardContent className="p-4 flex flex-col gap-3">
                    {/* Row 1: name */}
                    <div className="text-white font-bold text-base leading-tight">
                      {c.name}
                    </div>

                    {/* Row 2: action buttons */}
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
                            className="bg-purple-600 text-white active:scale-[0.98]"
                            data-testid="button-open-client"
                          >
                            <FolderOpen className="h-4 w-4 mr-1" />
                            Open
                          </Button>
                        </>
                      )}
                    </div>

                    {/* Row 3: linked / role / builder badges */}
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
              ))
          )}
        </div>
      </div>

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
        onOpenChange={setFolderOpen}
        onNavigate={setLocation}
        isPhysician={isPhysician}
      />
    </motion.div>
  );
}
