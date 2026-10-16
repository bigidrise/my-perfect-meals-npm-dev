import { useEffect, useRef, useState } from "react";
import ProClientFolderModal from "./ProClientFolderModal";
import { getDemoMessages } from "@/lib/demoProfessional";
import { readDevelopmentDashboard, writeDevelopmentDashboard, type DevelopmentDashboardResult } from "@/lib/developmentPhysicianStudio";
import type { DemoPatient } from "@shared/demoProfessional";

export default function DevelopmentPatientFolder({ workspaceId, patient, onClose, navigate }: {
  workspaceId: string; patient: Pick<DemoPatient, "id" | "label" | "scenario">;
  onClose(): void; navigate(path: string): void;
}) {
  const [result, setResult] = useState<DevelopmentDashboardResult | null>(null);
  const [messages, setMessages] = useState<DemoPatient["messages"]>([]);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => {
    let active = true; mounted.current = true;
    Promise.all([readDevelopmentDashboard(workspaceId, patient.id), getDemoMessages(workspaceId, patient.id)])
      .then(([dashboard, conversation]) => { if (active) { setResult(dashboard); setMessages(conversation.messages); } })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Could not open the test folder."); });
    return () => { active = false; mounted.current = false; };
  }, [workspaceId, patient.id]);
  if (!result) return <div className="rounded-xl border border-orange-300/30 bg-black/50 p-4 text-white">
    <p role={error ? "alert" : "status"}>{error || "Opening authorized test folder…"}</p><button onClick={onClose}>Close folder</button>
  </div>;
  return <ProClientFolderModal
    client={{ id: patient.id, name: patient.label, role: "doctor", workspace: "clinician", assignedBuilder: result.dashboard.assignedBuilder }}
    open onOpenChange={open => { if (!open) onClose(); }} onNavigate={navigate} isPhysician
    syntheticSource={{
      messages, targets: result.dashboard.targets, note: result.dashboard.context.coachNote ?? "",
      onSaveNote: async body => {
        if (inFlight.current) throw new Error("A test note is already saving.");
        inFlight.current = true;
        try {
          const existing = result.dashboard.context.coachNote;
          const next = await writeDevelopmentDashboard(workspaceId, patient.id, result.revision, {
            ...result.dashboard, context: { ...result.dashboard.context, coachNote: existing ? `${existing}\n\n${body}` : body },
          });
          if (mounted.current) setResult(next);
        } finally { inFlight.current = false; }
      },
    }}
  />;
}
