import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import PhysicianPortal from "@/pages/pro/PhysicianPortal";
import PhysicianCareTeam from "@/pages/care-team/PhysicianCareTeam";
import ProClients from "@/pages/pro/ProClients";
import ClinicianClientDashboard from "@/pages/pro/ClinicianClientDashboard";
import DevelopmentPatientFolder from "./DevelopmentPatientFolder";
import DemoCareInvitation from "./DemoCareInvitation";
import { StudioLoadingPanel } from "./StudioLoadingPanel";
import { acknowledgeDemoOnly, getDemoContext, getDemoPatients, getDemoMessages, getDemoPatient } from "@/lib/demoProfessional";
import { authorizedDevelopmentStudio, readDevelopmentDashboard, writeDevelopmentDashboard, type DevelopmentDashboardResult } from "@/lib/developmentPhysicianStudio";
import type { DemoContext, DemoPatient } from "@shared/demoProfessional";
import type { DevelopmentDashboard } from "@shared/developmentStudio";

/** Data adapter only: renders the established Physician pages, never a replacement Studio. */
export default function DevelopmentPhysicianStudio() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const [context, setContext] = useState<DemoContext | null>(null);
  const [patients, setPatients] = useState<Pick<DemoPatient, "id" | "label" | "scenario">[]>([]);
  const [result, setResult] = useState<DevelopmentDashboardResult | null>(null);
  const [messages, setMessages] = useState<DemoPatient["messages"]>([]);
  const [glucose, setGlucose] = useState<DemoPatient["glucose"]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const saveInFlight = useRef(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const patientId = /^\/pro\/clients\/([^/]+)\/clinician$/.exec(location)?.[1];
  const current = useRef(true);
  const saved = useRef<DevelopmentDashboardResult | null>(null);
  useEffect(() => {
    current.current = true;
    let active = true;
    setLoading(true); setError(""); setContext(null); setResult(null); saved.current = null;
    setPatients([]); setMessages([]); setGlucose([]);
    (async () => {
      const ctx = await getDemoContext();
      if (!user?.id || !authorizedDevelopmentStudio(ctx, user.id)) throw new Error("The existing Development physician authorization could not be verified. Live access remains blocked.");
      if (!active) return;
      setContext(ctx);
      if (ctx.acknowledgmentRequired) return;
      const list = await getDemoPatients(ctx.workspace.id);
      if (!active) return;
      setPatients(list.patients);
      if (patientId) {
        if (!list.patients.some(p => p.id === patientId)) throw new Error("This patient is not part of your authorized synthetic workspace.");
        const [dashboard, conversation, patient] = await Promise.all([
          readDevelopmentDashboard(ctx.workspace.id, patientId),
          ctx.grant.capabilities.includes("messages.read") ? getDemoMessages(ctx.workspace.id, patientId) : Promise.resolve({ messages: [] }),
          getDemoPatient(ctx.workspace.id, patientId),
        ]);
        if (!active) return;
        saved.current = dashboard; setResult(dashboard); setMessages(conversation.messages); setGlucose(patient.glucose);
      }
    })().catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to verify the Development workspace."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; current.current = false; };
  }, [user?.id, location, retry]);
  const save = async (patch: Partial<DevelopmentDashboard>) => {
    if (!context || !patientId || !saved.current || saveInFlight.current) throw new Error("A save is pending, or the test folder must be reopened.");
    saveInFlight.current = true;
    try {
      const next = await writeDevelopmentDashboard(context.workspace.id, patientId, saved.current.revision, { ...saved.current.dashboard, ...patch });
      if (!current.current) return;
      saved.current = next; setResult(next);
    } finally { saveInFlight.current = false; }
  };
  const refresh = () => setRetry(n => n + 1);
  if (loading) return <StudioLoadingPanel title="Opening your Physician Studio" detail="Verifying Development authorization and isolated patient data…" />;
  if (error || !context) return <div className="p-6 text-white"><p role="alert">{error || "Development authorization is unavailable."}</p><button onClick={refresh}>Retry access check</button></div>;
  const notice = <section className="rounded-xl border border-orange-300/40 bg-black/30 p-4 text-white space-y-3">
    <p className="font-semibold">{context.clinic?.name} · Development · synthetic patients only</p>
    <p className="text-sm">Original Physician Studio. Live patients, shared records, credentials, and billing remain inaccessible. Test changes are saved only in this Development workspace.</p>
    {context.acknowledgmentRequired && <button onClick={async () => {
      try { await acknowledgeDemoOnly(); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Acknowledgment failed."); }
    }} className="rounded-lg bg-orange-600 p-3">Acknowledge synthetic-only use</button>}
    <div className="flex gap-4 flex-wrap"><button onClick={() => navigate("/pro-portal")}>Portal</button><button onClick={() => navigate("/care-team/physician")}>Care Team</button><button onClick={() => navigate("/pro/physician-clients")}>Clients</button></div>
  </section>;
  if (patientId && result) {
    const patient = patients.find(p => p.id === patientId)!;
    return <ClinicianClientDashboard syntheticSource={{
      client: { id: patientId, name: patient.label, workspace: "clinician", role: "doctor", assignedBuilder: result.dashboard.assignedBuilder },
      dashboard: result.dashboard, save,
      notice: <>{notice}<div className="rounded-xl bg-black/20 p-4 space-y-3">
        <p>{patient.scenario}</p>
        <p>Synthetic glucose: {glucose.length ? glucose.map(g => `${g.value} ${g.unit} (${g.context})`).join("; ") : "No readings in this test case."}</p>
        <h2 className="font-semibold">Test messages (read-only)</h2>
        {messages.map(m => <p key={m.id}>{m.author}: {m.text}</p>)}
        {!messages.length && <p>No synthetic messages.</p>}
        <DemoCareInvitation workspaceId={context.workspace.id} patientId={patientId} />
      </div></>,
    }} />;
  }
  if (["/pro-portal", "/pro/physician"].includes(location) || context.acknowledgmentRequired) return <PhysicianPortal syntheticContent={notice} />;
  if (location.startsWith("/care-team")) return <PhysicianCareTeam syntheticContent={<>{notice}
    {patients.map(p => <article key={p.id} className="rounded-xl bg-black/20 p-4 space-y-3"><h2>{p.label}</h2><p>{p.scenario}</p>
      <DemoCareInvitation workspaceId={context.workspace.id} patientId={p.id} />
      <button onClick={() => navigate(`/pro/clients/${p.id}/clinician`)}>Open Client Dashboard</button>
    </article>)}</>} />;
  const folderPatient = patients.find(p => p.id === folderId);
  return <><ProClients workspace="clinician" syntheticSource={{
    patients, selectedPatientId: "", loading: false, error: "", onRefresh: refresh,
    onSelect: setFolderId, patientDetail: null, boundaryNotice: notice,
  }} />{folderPatient && <DevelopmentPatientFolder key={folderPatient.id}
    workspaceId={context.workspace.id} patient={folderPatient} onClose={() => setFolderId(null)} navigate={navigate} />}</>;
}
