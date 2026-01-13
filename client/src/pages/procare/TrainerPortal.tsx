import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { proStore, ClientProfile } from "@/lib/proData";
import {
  ArrowLeft,
  Dumbbell,
  Plus,
  User2,
  ArrowRight,
  Target,
  Trophy,
  Archive,
  RotateCcw,
} from "lucide-react";
import TrashButton from "@/components/ui/TrashButton";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";

const TRAINER_TOUR_STEPS: TourStep[] = [
  {
    icon: "1",
    title: "Add Athletes",
    description: "Enter your client's name to add them to your roster.",
  },
  {
    icon: "2",
    title: "Open Client Workspace",
    description: "Click Open to access macro targets and meal planning tools.",
  },
  {
    icon: "3",
    title: "Build Performance Plans",
    description: "Use General Nutrition or Competition builders for your athletes.",
  },
];

export default function TrainerPortal() {
  const [, setLocation] = useLocation();
  const [clients, setClients] = useState<ClientProfile[]>(() => 
    proStore.listClients().filter(c => c.role === "trainer" || !c.role)
  );
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState("");
  const quickTour = useQuickTour("trainer-portal");

  useEffect(() => {
    localStorage.setItem("mpm_pro_portal_type", "trainer");
  }, []);

  const addClient = () => {
    if (!name.trim()) return;
    const c: ClientProfile = {
      id: crypto.randomUUID(),
      name: name.trim(),
      role: "trainer",
      workspace: "trainer",
    };
    proStore.upsertClient(c);
    setClients([c, ...clients]);
    setName("");
  };

  const archiveClient = (id: string) => {
    proStore.archiveClient(id);
    setClients([...proStore.listClients().filter(c => c.role === "trainer" || !c.role)]);
  };

  const restoreClient = (id: string) => {
    proStore.restoreClient(id);
    setClients([...proStore.listClients().filter(c => c.role === "trainer" || !c.role)]);
  };

  const deleteClient = (id: string) => {
    proStore.deleteClient(id);
    setClients([...proStore.listClients().filter(c => c.role === "trainer" || !c.role)]);
  };

  const openClient = (id: string) => {
    setLocation(`/procare/trainer/clients/${id}`);
  };

  const filteredClients = useMemo(() => 
    clients.filter(c => showArchived ? c.archived : !c.archived),
    [clients, showArchived]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a2e1a] to-[#2b3b2b] pb-safe-nav"
    >
      <div
        className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-lime-500/20"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setLocation("/procare")}
            className="flex items-center text-white hover:bg-white/10 p-2 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Dumbbell className="h-6 w-6 text-lime-500" />
          <h1 className="text-lg font-bold text-white flex-1">Trainer Portal</h1>
          <QuickTourButton onClick={quickTour.openTour} />
        </div>
      </div>

      <div
        className="max-w-4xl mx-auto px-4 space-y-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-lime-600/20 border border-lime-500/30 opacity-60">
            <CardContent className="p-4 flex items-center gap-3">
              <Target className="h-6 w-6 text-lime-400" />
              <div>
                <div className="font-semibold text-white">General Nutrition</div>
                <div className="text-xs text-white/70">Select athlete first</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-lime-600/20 border border-lime-500/30 opacity-60">
            <CardContent className="p-4 flex items-center gap-3">
              <Trophy className="h-6 w-6 text-lime-400" />
              <div>
                <div className="font-semibold text-white">Competition</div>
                <div className="text-xs text-white/70">Select athlete first</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white/5 border border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <User2 className="h-5 w-5 text-lime-400" />
              Your Athletes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input
                placeholder="Athlete name"
                className="bg-black/30 border-white/30 text-white flex-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addClient()}
              />
              <Button
                onClick={addClient}
                className="bg-lime-600 hover:bg-lime-700 text-white"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => setShowArchived(!showArchived)}
                variant="outline"
                size="sm"
                className="bg-white/5 border-white/20 text-white hover:bg-white/10"
              >
                {showArchived ? "Show Active" : "Show Archived"}
              </Button>
            </div>

            <div className="space-y-3">
              {filteredClients.length === 0 ? (
                <div className="text-white/60 text-center py-8">
                  {showArchived ? "No archived athletes." : "No athletes yet. Add one above."}
                </div>
              ) : (
                filteredClients.map((c) => (
                  <Card key={c.id} className="bg-white/5 border border-white/10">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-lime-500/20 border border-lime-500/30 flex items-center justify-center">
                          <User2 className="h-5 w-5 text-lime-400" />
                        </div>
                        <div className="font-semibold text-white">{c.name}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.archived ? (
                          <>
                            <Button
                              onClick={() => restoreClient(c.id)}
                              variant="outline"
                              size="sm"
                              className="bg-green-600/20 border-green-500/30 text-green-300"
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Restore
                            </Button>
                            <TrashButton
                              onClick={() => deleteClient(c.id)}
                              size="sm"
                              confirm
                              confirmMessage={`Delete ${c.name} permanently?`}
                              ariaLabel={`Delete ${c.name}`}
                            />
                          </>
                        ) : (
                          <>
                            <Button
                              onClick={() => archiveClient(c.id)}
                              variant="outline"
                              size="sm"
                              className="bg-orange-600/20 border-orange-500/30 text-orange-300"
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => openClient(c.id)}
                              className="bg-lime-600 hover:bg-lime-700 text-white"
                            >
                              Open <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <QuickTourModal
        isOpen={quickTour.shouldShow}
        onClose={quickTour.closeTour}
        title="Trainer Portal Guide"
        steps={TRAINER_TOUR_STEPS}
        onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
      />
    </motion.div>
  );
}
