import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WorkspaceClient {
  firstName: string | null;
  lastName: string | null;
  selectedMealBuilder: string | null;
  activeBoard: string | null;
  dailyCalorieTarget: number | null;
  dailyProteinTarget: number | null;
  dailyCarbsTarget: number | null;
  dailyFatTarget: number | null;
  height: number | null;
  weight: number | null;
  age: number | null;
  medicalConditions: string[] | null;
  healthConditions: string[] | null;
}

export default function WorkspaceShell() {
  const { clientId } = useParams<{ clientId: string }>();
  const { token } = useAuth();
  const [, navigate] = useLocation();
  const [client, setClient] = useState<WorkspaceClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId || !token) {
      setLoading(false);
      setError("Authentication required.");
      return;
    }

    async function fetchWorkspace() {
      try {
        const res = await fetch(`/api/pro/workspace/${clientId}`, {
          headers: { "x-auth-token": token! },
        });

        if (res.status === 403) {
          setError("You do not have access to this client's workspace.");
          return;
        }

        if (res.status === 404) {
          setError("Client not found.");
          return;
        }

        if (!res.ok) {
          setError("Failed to load workspace.");
          return;
        }

        const data = await res.json();
        setClient(data.client);
      } catch {
        setError("Failed to load workspace.");
      } finally {
        setLoading(false);
      }
    }

    fetchWorkspace();
  }, [clientId, token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-red-400 text-center">{error}</p>
        <Button
          variant="outline"
          onClick={() => navigate("/pro/clients")}
          className="bg-white/10 border-white/30 text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Clients
        </Button>
      </div>
    );
  }

  if (!client) return null;

  const clientName = [client.firstName, client.lastName].filter(Boolean).join(" ") || "Unknown Client";
  const builderLabel = client.selectedMealBuilder || client.activeBoard || "None assigned";

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm border-b border-white/10 p-4">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/pro/clients")}
            className="text-white/70 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{clientName}</h1>
            <p className="text-sm text-white/50">Client Workspace</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <h2 className="text-sm font-medium text-white/50 mb-2">Active Builder</h2>
          <p className="text-lg font-semibold capitalize">{builderLabel.replace(/[-_]/g, " ")}</p>
        </div>
      </div>
    </div>
  );
}
