import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Building2, ChevronLeft, ChevronRight, Loader2, MapPin, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type WorkspaceLocation = {
  id: string;
  name: string;
  role: string;
  isDefault: boolean;
};

type WorkspaceOrganization = {
  id: string;
  name: string;
  role: string;
  locations: WorkspaceLocation[];
};

function roleLabel(role: string) {
  return role.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export default function OrganizationHub() {
  const [, setLocation] = useLocation();
  const [organizations, setOrganizations] = useState<WorkspaceOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/business/workspace/options", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load your organizations.");
        return response.json();
      })
      .then((data) => {
        if (active) setOrganizations(Array.isArray(data?.organizations) ? data.organizations : []);
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Could not load your organizations.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function openOrganization(organizationId: string, locationId: string) {
    const key = `${organizationId}:${locationId}`;
    setOpeningKey(key);
    setError(null);
    try {
      const response = await fetch("/api/business/workspace/select", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, locationId }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Could not open this organization.");
      }
      setLocation("/business-dashboard");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not open this organization.");
      setOpeningKey(null);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <button
            type="button"
            onClick={() => setLocation("/more")}
            className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Back to More"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold">Organization Hub</h1>
            <p className="text-xs text-white/50">Choose the organization you want to manage</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <div className="rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-950/45 via-white/[0.04] to-black p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-blue-400/25 bg-blue-500/15 p-2.5">
              <Building2 className="h-5 w-5 text-blue-300" />
            </div>
            <div>
              <h2 className="font-semibold">Your organizations</h2>
              <p className="mt-1 text-sm leading-relaxed text-white/60">
                Each workspace keeps its own invitations, team, clients, locations, policies, and reporting.
              </p>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading organizations
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
        )}

        {!loading && organizations.length === 0 && !error && (
          <Card className="border-white/10 bg-white/5 text-white">
            <CardContent className="p-6 text-center">
              <Building2 className="mx-auto h-8 w-8 text-white/25" />
              <h2 className="mt-3 font-semibold">No active organizations yet</h2>
              <p className="mt-1 text-sm text-white/50">Start or complete organization setup to create your first workspace.</p>
              <button
                type="button"
                onClick={() => setLocation("/business/start")}
                className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold hover:bg-blue-500"
              >
                Start Organization Setup
              </button>
            </CardContent>
          </Card>
        )}

        {organizations.map((organization) => (
          <Card key={organization.id} className="overflow-hidden border-white/10 bg-white/[0.05] text-white">
            <CardContent className="p-0">
              <div className="border-b border-white/10 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold">{organization.name}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full border border-green-500/25 bg-green-500/10 px-2.5 py-1 text-green-300">
                        <ShieldCheck className="h-3 w-3" />
                        Active
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/60">
                        {roleLabel(organization.role)}
                      </span>
                      <span className="text-white/40">
                        {organization.locations.length} location{organization.locations.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-white/10">
                {organization.locations.map((location) => {
                  const key = `${organization.id}:${location.id}`;
                  return (
                    <button
                      key={location.id}
                      type="button"
                      disabled={openingKey !== null}
                      onClick={() => openOrganization(organization.id, location.id)}
                      className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-white/[0.06] disabled:opacity-50"
                    >
                      <MapPin className="h-4 w-4 flex-shrink-0 text-blue-300" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{location.name}</p>
                        <p className="text-xs text-white/45">{roleLabel(location.role)}</p>
                      </div>
                      {openingKey === key ? (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-300" />
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-semibold text-blue-300">
                          Open Organization
                          <ChevronRight className="h-4 w-4" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}