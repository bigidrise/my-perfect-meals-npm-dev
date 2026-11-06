import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AntiInflammatorySupportControl } from "../../client/src/components/profile/AntiInflammatorySupportControl";

const fixture = {
  account: "synthetic-a", failNextSave: false, delay: false,
  records: {
    "synthetic-a": { enabled: false, legacyPreferenceSaved: true },
    "synthetic-b": { enabled: false, legacyPreferenceSaved: false },
  } as Record<string, { enabled: boolean; legacyPreferenceSaved: boolean }>,
  writes: [] as unknown[],
  async request(path: string, options: RequestInit = {}) {
    if (path !== "/api/health-context/support/anti_inflammatory") throw new Error("Unexpected fixture request");
    const account = this.account;
    if (this.delay) await new Promise(resolve => setTimeout(resolve, 800));
    if (options.method === "PUT") {
      if (this.failNextSave) { this.failNextSave = false; throw new Error("Synthetic save failure"); }
      const body = JSON.parse(String(options.body));
      if (Object.keys(body).join() !== "enabled" || typeof body.enabled !== "boolean") throw new Error("Unexpected write");
      this.writes.push({ account, body });
      this.records[account] = { enabled: body.enabled, legacyPreferenceSaved: body.enabled };
    }
    return { ...this.records[account] };
  },
};
(window as any).__antiReview = fixture;
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function Review() {
  const [account, setAccount] = useState(fixture.account);
  const [program, setProgram] = useState("General Nutrition");
  return <QueryClientProvider client={client}><main style={{ maxWidth: 640, margin: "auto", padding: 16 }}>
    <h1>Synthetic Anti-Inflammatory review</h1>
    <p>No real accounts, database, model calls, or outgoing API requests.</p>
    <label>Primary program <select aria-label="Primary program" value={program} onChange={event => setProgram(event.target.value)}>
      {["General Nutrition", "Diabetic", "GLP-1"].map(value => <option key={value}>{value}</option>)}
    </select></label>
    <p>Primary program remains: {program}</p>
    <label>Synthetic account <select aria-label="Synthetic account" value={account} onChange={event => {
      fixture.account = event.target.value; setAccount(event.target.value);
    }}><option value="synthetic-a">Account A</option><option value="synthetic-b">Account B</option></select></label>
    <label style={{ display: "block", margin: "16px 0" }}><input type="checkbox" onChange={e => { fixture.delay = e.target.checked; }} /> Delay responses</label>
    <label style={{ display: "block", margin: "16px 0" }}><input type="checkbox" onChange={e => { fixture.failNextSave = e.target.checked; }} /> Fail next save</label>
    <AntiInflammatorySupportControl userId={account} />
  </main></QueryClientProvider>;
}
createRoot(document.getElementById("root")!).render(<Review />);
