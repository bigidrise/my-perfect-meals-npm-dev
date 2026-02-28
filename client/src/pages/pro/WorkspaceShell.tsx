import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Loader2, Activity, Target, UtensilsCrossed, CheckCircle2 } from "lucide-react";
import { getAuthToken } from "@/lib/auth";
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

function formatBuilder(value: string): string {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function cmToFeetInches(cm: number): string {
  const totalInches = Math.round(cm / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${inches}"`;
}

function formatCondition(condition: string): string {
  return condition.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function WorkspaceShell() {
  const { clientId } = useParams<{ clientId: string }>();
  const [, navigate] = useLocation();
  const token = getAuthToken();
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
  const hasMacros = client.dailyCalorieTarget || client.dailyProteinTarget || client.dailyCarbsTarget || client.dailyFatTarget;
  const conditions = (client.medicalConditions || []).filter((c) => c !== "none");

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
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{clientName}</h1>
            <p className="text-sm text-white/50">Client Workspace</p>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Active</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <UtensilsCrossed className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-medium text-white/50">Active Builder</h2>
          </div>
          <p className="text-lg font-semibold">{formatBuilder(builderLabel)}</p>
          {conditions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {conditions.map((c) => (
                <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                  {formatCondition(c)}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-medium text-white/50">Biometrics</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-white/40">Age</p>
              <p className="text-lg font-semibold">{client.age ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-white/40">Height</p>
              <p className="text-lg font-semibold">
                {client.height ? cmToFeetInches(client.height) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/40">Weight</p>
              <p className="text-lg font-semibold">
                {client.weight ? `${client.weight} lbs` : "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-green-400" />
            <h2 className="text-sm font-medium text-white/50">Macro Targets</h2>
          </div>
          {hasMacros ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-white/40">Calories</p>
                <p className="text-lg font-semibold">{client.dailyCalorieTarget ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-white/40">Protein</p>
                <p className="text-lg font-semibold">
                  {client.dailyProteinTarget ? `${client.dailyProteinTarget}g` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/40">Carbs</p>
                <p className="text-lg font-semibold">
                  {client.dailyCarbsTarget ? `${client.dailyCarbsTarget}g` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/40">Fat</p>
                <p className="text-lg font-semibold">
                  {client.dailyFatTarget ? `${client.dailyFatTarget}g` : "—"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/30">No macro targets set</p>
          )}
        </div>

        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <UtensilsCrossed className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-medium text-white/50">Meal Boards</h2>
          </div>
          <p className="text-sm text-white/30">Read-only view coming in Phase 4</p>
        </div>
      </div>
    </div>
  );
}
