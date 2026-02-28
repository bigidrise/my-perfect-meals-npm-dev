import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClientProfile } from "@/lib/proData";
import { Activity, Target, LayoutDashboard, Tablet, CheckCircle2, ArrowRight } from "lucide-react";

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
  if (!client) return null;

  const builderLabel = getBuilderLabel(client);
  const workspace = isPhysician ? "clinician" : "trainer";

  return (
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
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-2 text-white/40 text-xs mb-1">
                <Tablet className="w-3.5 h-3.5" />
                Tablet
              </div>
              <p className="text-sm text-white/30">Coming soon</p>
            </div>

            <Button
              variant="outline"
              className="w-full justify-between bg-white/5 border-white/10 text-white hover:bg-white/10"
              onClick={() => {
                onOpenChange(false);
                onNavigate(`/pro/clients/${client.id}/${workspace}`);
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
                onNavigate(`/pro/clients/${client.id}/${workspace}`);
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
  );
}
