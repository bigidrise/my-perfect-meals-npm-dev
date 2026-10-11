import { useState } from "react";
import { getAuthHeaders } from "@/lib/auth";

export default function FounderPilotInvitation() {
  const [email, setEmail] = useState("");
  const [path, setPath] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  async function issue() {
    setBusy(true); setError(""); setPath(""); setCopied(false);
    try {
      const response = await fetch("/api/business/pilot-activation/issue", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not issue invitation.");
      // Relative path works in both approved Development and Production hosts.
      setPath(data.activationPath);
    } catch (error: any) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <section className="mt-7 space-y-3 rounded-2xl border border-orange-500/30 p-6">
    <h2 className="text-xl font-bold">Founder-issued 30-Day Business Pilot</h2>
    <p className="text-sm text-white/70">Email-bound invitation. Thirty days begin on activation; the linked new Organization uses the same end date. No payment or administrative privileges granted.</p>
    <label className="block">Physician email
      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
        className="mt-2 w-full rounded-lg bg-white/10 p-3" autoComplete="off" />
    </label>
    <button disabled={busy || !email.trim()} onClick={issue} className="rounded-xl bg-orange-600 px-4 py-3 disabled:opacity-50">{busy ? "Creating…" : "Generate Physician Invitation"}</button>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {path && <><p className="text-sm">Link generated. Share privately with the authorized physician. Redemption deadline: 14 days.</p>
      <button className="rounded-xl bg-white/10 px-4 py-3" onClick={async () => {
        try { await navigator.clipboard.writeText(new URL(path, window.location.origin).href); setCopied(true); }
        catch { setError("Clipboard access failed. Retry copying from a supported browser."); }
      }}>{copied ? "Copied" : "Copy Physician Invitation Link"}</button></>}
  </section>;
}
