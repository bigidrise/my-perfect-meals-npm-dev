import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Dumbbell, Stethoscope } from "lucide-react";
import { proStore, WorkspaceType } from "@/lib/proData";

interface WorkspaceSelectionModalProps {
  clientId: string;
  clientName: string;
  isOpen: boolean;
  onSelect: (workspace: WorkspaceType) => void;
}

export default function WorkspaceSelectionModal({
  clientId,
  clientName,
  isOpen,
  onSelect,
}: WorkspaceSelectionModalProps) {
  const [isSelecting, setIsSelecting] = useState(false);

  const handleSelect = async (workspace: WorkspaceType) => {
    setIsSelecting(true);
    
    const existingClient = proStore.getClient(clientId);
    if (existingClient) {
      proStore.upsertClient({
        ...existingClient,
        workspace,
      });
    } else {
      proStore.upsertClient({
        id: clientId,
        name: clientName,
        role: "trainer",
        workspace,
      });
    }
    
    onSelect(workspace);
    setIsSelecting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="bg-black/95 border border-white/20 max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center">
          <DialogTitle className="text-white text-xl">
            Select Your Workspace for {clientName}
          </DialogTitle>
          <DialogDescription className="text-white/70 text-sm mt-2">
            Choose how you'll manage this client. This only affects your professional tools — the client experience stays consistent.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 mt-6">
          <Button
            onClick={() => handleSelect("trainer")}
            disabled={isSelecting}
            className="h-auto py-6 bg-gradient-to-r from-lime-600 to-green-600 hover:from-lime-700 hover:to-green-700 border border-white/20 flex flex-col items-center gap-2 transition-all duration-200"
          >
            <Dumbbell className="h-8 w-8 text-white" />
            <span className="text-lg font-bold text-white">Trainer Workspace</span>
            <span className="text-xs text-white/80 font-normal">
              Macro targets, performance focus, and coaching notes
            </span>
          </Button>

          <Button
            onClick={() => handleSelect("clinician")}
            disabled={isSelecting}
            className="h-auto py-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 border border-white/20 flex flex-col items-center gap-2 transition-all duration-200"
          >
            <Stethoscope className="h-8 w-8 text-white" />
            <span className="text-lg font-bold text-white">Clinician Workspace</span>
            <span className="text-xs text-white/80 font-normal">
              Clinical context, guardrails, and medical oversight
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
