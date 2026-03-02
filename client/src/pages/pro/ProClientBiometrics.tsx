import { useRoute } from "wouter";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProClient } from "@/contexts/ProClientContext";
import MyBiometrics from "@/pages/my-biometrics";

export default function ProClientBiometrics() {
  const [, params] = useRoute("/pro/clients/:id/biometrics");
  const clientId = params?.id || null;
  const { client } = useProClient();
  const [, setLocation] = useLocation();

  if (!clientId) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p>No client selected.</p>
      </div>
    );
  }

  return <MyBiometrics studioClientId={clientId} />;
}
