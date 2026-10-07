import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { DemoCareInvitation as Invitation } from "@shared/demoProfessional";

export default function DemoCareInvitation({ workspaceId, patientId }: { workspaceId: string; patientId: string }) {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const path = `/api/demo-professional/workspaces/${workspaceId}/patients/${patientId}/invitation`;
  useEffect(() => {
    let active = true;
    setInvitation(null); setKey(""); setError("");
    apiRequest<{ invitation: Invitation | null }>(path)
      .then(data => { if (active) { setInvitation(data.invitation); setKey(data.invitation?.code ?? ""); } })
      .catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [path]);
  async function submit(accept: boolean) {
    setBusy(true); setError("");
    try {
      const data = await apiRequest<{ invitation: Invitation }>(path + (accept ? "/accept" : ""), {
        method: "POST", body: JSON.stringify(accept ? { key } : {}),
      });
      setInvitation(data.invitation); setKey(data.invitation.code);
    } catch (error) { setError(error instanceof Error ? error.message : "Invitation could not be completed."); }
    finally { setBusy(false); }
  }
  return <section className="mb-4 rounded-xl border border-white/20 p-4 text-white" aria-label="Synthetic Care Team connection">
    <h2 className="font-semibold">Synthetic Care Team connection</h2>
    <p className="my-2 text-sm text-white/70">Isolated demonstration only. Delivery and client acceptance are simulated for this fictional case. No real email or live relationship is created.</p>
    {invitation?.state === "accepted" ? <p role="status">Connected to this isolated physician workspace.</p> : <>
      <button type="button" disabled={busy} onClick={() => submit(false)} className="rounded bg-purple-700 px-3 py-2 disabled:opacity-50">Create synthetic invitation</button>
      {invitation && <div className="mt-3">
        <label className="block text-sm" htmlFor="demo-invite-key">Synthetic client's code or token</label>
        <input id="demo-invite-key" value={key} onChange={event => setKey(event.target.value)} className="my-2 w-full rounded border border-white/30 bg-black p-2" />
        <p className="mb-2 break-all text-xs text-white/60">Synthetic email-link token: {invitation.token}</p>
        <button type="button" disabled={busy || !key.trim()} onClick={() => submit(true)} className="rounded bg-purple-700 px-3 py-2 disabled:opacity-50">Simulate client acceptance</button>
      </div>}
    </>}
    {error && <p role="alert" className="mt-2 text-red-300">{error}</p>}
  </section>;
}
