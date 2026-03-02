import { useRoute } from "wouter";
import { useLocation } from "wouter";
import { useProClient } from "@/contexts/ProClientContext";
import MacroCounter from "@/pages/MacroCalculator";

export default function ProClientMacroCalculator() {
  const [, params] = useRoute("/pro/clients/:id/macro-calculator");
  const clientId = params?.id || null;
  const [, setLocation] = useLocation();

  if (!clientId) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p>No client selected.</p>
      </div>
    );
  }

  return <MacroCounter studioClientId={clientId} />;
}
