import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";

function parseParticipants(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const angle = line.match(/^(.*?)\s*<([^>]+)>$/);
    if (angle) return { name: angle[1].trim() || undefined, email: angle[2].trim() };
    const comma = line.split(",").map((item) => item.trim());
    if (comma.length > 1 && comma[1].includes("@")) return { name: comma[0] || undefined, email: comma[1] };
    return { email: line };
  });
}

export default function PilotProgramAdmin() {
  const { user } = useAuth();
  const [organizationName, setOrganizationName] = useState("");
  const [programName, setProgramName] = useState("");
  const [durationDays, setDurationDays] = useState(30);
  const [participantText, setParticipantText] = useState("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const participants = useMemo(() => parseParticipants(participantText), [participantText]);

  if (!user?.isAdmin && user?.role !== "admin") {
    return <div className="p-8 text-white">Administrator access is required.</div>;
  }

  const provision = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await apiRequest("/api/trial/admin/pilot-programs", {
        method: "POST",
        body: JSON.stringify({ organizationName, programName, durationDays, participants }),
      });
      setResult(response);
    } catch (reason: any) {
      setError(reason.message || "Pilot provisioning failed");
    } finally {
      setSaving(false);
    }
  };

  const startPilot = async () => {
    if (!result?.program?.id) return;
    setStarting(true);
    setError("");
    try {
      const started = await apiRequest(`/api/trial/admin/pilot-programs/${result.program.id}/start`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setResult({ ...result, program: started.program });
    } catch (reason: any) {
      setError(reason.message || "Pilot start failed");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-violet-300">Pilot administration</p>
        <h1 className="mt-2 text-3xl font-bold">Add pilot participants</h1>
        <p className="mt-2 text-white/65">Provision accounts and secure activation links without starting the pilot clock.</p>
        <div className="mt-7 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          <Input placeholder="Organization, e.g. Premier Health" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
          <Input placeholder="Program name, e.g. Premier Health 30-Day Pilot" value={programName} onChange={(e) => setProgramName(e.target.value)} />
          <Input type="number" min={1} max={365} value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} />
          <textarea
            className="min-h-56 rounded-md border border-white/15 bg-black/30 p-3 text-sm"
            placeholder={"One participant per line:\nAllison Pate <apate@example.com>\nTory Langhammer, tlanghammer@example.com\nspugh@example.com"}
            value={participantText}
            onChange={(e) => setParticipantText(e.target.value)}
          />
          <p className="text-sm text-white/60">{participants.length} participant{participants.length === 1 ? "" : "s"} ready</p>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <Button
            className="bg-violet-600 hover:bg-violet-500"
            disabled={saving || !organizationName || !programName || participants.length === 0}
            onClick={provision}
          >
            {saving ? "Provisioning…" : "Provision participants"}
          </Button>
        </div>
        {result?.participants && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="font-semibold">Provisioning results</h2>
            <p className="mt-2 text-sm text-white/65">
              Program status: <strong>{result.program?.status || "preparing"}</strong>
              {result.program?.pilotStartAt && ` · ends ${new Date(result.program.pilotEndAt).toLocaleDateString()}`}
            </p>
            {result.program?.status === "preparing" && (
              <Button className="mt-4 bg-emerald-600 hover:bg-emerald-500" disabled={starting} onClick={startPilot}>
                {starting ? "Starting…" : "Start 30-Day Pilot"}
              </Button>
            )}
            <ul className="mt-3 space-y-2 text-sm">
              {result.participants.map((item: any) => (
                <li key={item.email} className="flex justify-between gap-4">
                  <span>{item.email}</span>
                  <span className={item.status === "failed" ? "text-red-300" : "text-emerald-300"}>
                    {item.status}{item.emailSent === false ? " · email not sent" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}