import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClientProfile } from "@/lib/proData";
import { Activity, Target, LayoutDashboard, CheckCircle2, ArrowRight, MessageSquare, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import MessagesModal from "./MessagesModal";
import ProviderNotesModal from "./ProviderNotesModal";

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

export default function ProClientFolderModal({
  client,
  open,
  onOpenChange,
  onNavigate,
  isPhysician,
}: ProClientFolderModalProps) {
  const { user } = useAuth();
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  if (!client) return null;

  const clientId = client.clientUserId || client.userId || client.id;
  const builderLabel = getBuilderLabel(client);
  const workspace = isPhysician ? "clinician" : "trainer";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-white">{client.name}</DialogTitle>
            <DialogDescription className="text-white/50">
              {client.email || "No email on file"}
            </DialogDescription>
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

            <div className="border-t border-white/10 pt-3 space-y-2">
              <Button
                variant="outline"
                className="w-full justify-between bg-white/5 border-white/10 text-white hover:bg-white/10"
                onClick={() => setMessagesOpen(true)}
              >
                <span className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-purple-400" />
                  View Messages
                </span>
                <ArrowRight className="w-4 h-4 text-white/40" />
              </Button>

              <Button
                variant="outline"
                className="w-full justify-between bg-white/5 border-white/10 text-white hover:bg-white/10"
                onClick={() => setNotesOpen(true)}
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-zinc-400" />
                  View Provider Notes
                </span>
                <ArrowRight className="w-4 h-4 text-white/40" />
              </Button>

              <Button
                variant="outline"
                className="w-full justify-between bg-white/5 border-white/10 text-white hover:bg-white/10"
                onClick={() => {
                  onOpenChange(false);
                  localStorage.setItem("pro-client-id", clientId);
                  localStorage.setItem("pro-return-route", "/pro/clients");
                  localStorage.setItem("pro-session", "true");
                  onNavigate("/biometrics");
                }}
              >
                <span className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  View Biometrics
                </span>
                <ArrowRight className="w-4 h-4 text-white/40" />
              </Button>

              <Button
                variant="outline"
                className="w-full justify-between bg-white/5 border-white/10 text-white hover:bg-white/10"
                onClick={() => {
                  onOpenChange(false);
                  localStorage.setItem("pro-client-id", clientId);
                  localStorage.setItem("pro-return-route", "/pro/clients");
                  localStorage.setItem("pro-session", "true");
                  onNavigate("/macro-counter");
                }}
              >
                <span className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-green-400" />
                  Macro Calculator
                </span>
                <ArrowRight className="w-4 h-4 text-white/40" />
              </Button>

              <Button
                className="w-full justify-between bg-purple-600 text-white hover:bg-purple-700"
                onClick={() => {
                  onOpenChange(false);
                  const navId = client.clientUserId || client.userId || client.id;
                  onNavigate(`/pro/clients/${navId}/${workspace}`);
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

      <MessagesModal
        clientId={clientId}
        clientName={client.name}
        open={messagesOpen}
        onOpenChange={setMessagesOpen}
        currentUserId={user?.id || ""}
      />

      <ProviderNotesModal
        clientId={clientId}
        clientName={client.name}
        open={notesOpen}
        onOpenChange={setNotesOpen}
        currentUserId={user?.id || ""}
      />
    </>
  );
}
